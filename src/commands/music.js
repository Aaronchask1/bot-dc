const { EmbedBuilder } = require('discord.js');
const { AudioPlayerStatus, NoSubscriberBehavior, StreamType, VoiceConnectionStatus, createAudioPlayer, createAudioResource, entersState, joinVoiceChannel } = require('@discordjs/voice');
const { spawn } = require('node:child_process');
const { canonicalize } = require('../music/catalog');
const logger = require('../logger');

const sessions = new Map();
const initialize = () => null;
const voiceChannel = (ctx) => ctx.member?.voice?.channel ?? null;
const currentSession = (guildId) => sessions.get(guildId);
function formatTime(milliseconds) { if (!Number.isFinite(milliseconds) || milliseconds <= 0) return 'En directo'; const seconds = Math.floor(milliseconds / 1000); return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`; }
function embed(title, description) { return new EmbedBuilder().setColor(0x9b5cff).setTitle(`🎵 ${title}`).setDescription(description).setFooter({ text: 'Xyb Music · MusicBrainz + yt-dlp' }); }

async function findTrack(query) {
  const isUrl = /^https?:\/\//i.test(query); let search = query;
  if (!isUrl) try { const match = await canonicalize(query); if (match) search = match.query; } catch (error) { logger.warn(`[music] MusicBrainz: ${error.message}`); }
  return new Promise((resolve, reject) => {
    const child = spawn(process.env.YTDLP_PATH || 'yt-dlp', ['--dump-single-json', '--flat-playlist', '--no-playlist', '--no-warnings', '--no-progress', isUrl ? search : `ytsearch1:${search}`]);
    let output = ''; let errors = ''; const timer = setTimeout(() => { child.kill('SIGKILL'); reject(new Error('La búsqueda tardó demasiado.')); }, 20_000);
    child.stdout.on('data', (data) => { output += data; }); child.stderr.on('data', (data) => { errors += data; });
    child.on('error', (error) => { clearTimeout(timer); reject(error); });
    child.on('close', (code) => { clearTimeout(timer); if (code !== 0) return reject(new Error(errors.trim() || `yt-dlp terminó con ${code}`)); try { const result = JSON.parse(output); const item = result.entries?.find(Boolean) ?? result; const url = item.webpage_url || (item.id ? `https://www.youtube.com/watch?v=${item.id}` : null); if (!url) throw new Error('Sin resultados'); resolve({ url, title: item.title || search, length: Number(item.duration || 0) * 1000 }); } catch (error) { reject(error); } });
  });
}
function openStream(url) {
  const ytdlp = spawn(process.env.YTDLP_PATH || 'yt-dlp', ['-f', 'bestaudio/best', '--no-playlist', '--no-warnings', '--no-progress', '-o', '-', url]);
  const ffmpeg = spawn('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-i', 'pipe:0', '-vn', '-f', 's16le', '-ar', '48000', '-ac', '2', 'pipe:1']);
  ytdlp.stdout.pipe(ffmpeg.stdin);
  ytdlp.on('error', (error) => logger.error('[music] No pude iniciar yt-dlp', error));
  ffmpeg.on('error', (error) => logger.error('[music] No pude iniciar FFmpeg', error));
  return { stream: ffmpeg.stdout, stop: () => { ytdlp.kill('SIGKILL'); ffmpeg.kill('SIGKILL'); } };
}
function destroyStream(session) { try { session.stream?.stop(); } catch {} session.stream = null; }
function advance(session) { destroyStream(session); const track = session.queue.shift(); if (!track) { session.current = null; return; } session.current = track; session.stream = openStream(track.url); session.player.play(createAudioResource(session.stream.stream, { inputType: StreamType.Raw })); }

async function getSession(ctx) {
  const channel = voiceChannel(ctx); if (!channel) { await ctx.fail('Entra primero a un canal de voz.'); return null; }
  let session = currentSession(ctx.guild.id); if (session) return session;
  const connection = joinVoiceChannel({ channelId: channel.id, guildId: ctx.guild.id, adapterCreator: ctx.guild.voiceAdapterCreator, selfDeaf: true, daveEncryption: false });
  try { await entersState(connection, VoiceConnectionStatus.Ready, 20_000); } catch { connection.destroy(); await ctx.fail('No pude conectarme al canal de voz.'); return null; }
  const player = createAudioPlayer({ behaviors: { noSubscriber: NoSubscriberBehavior.Pause } }); session = { connection, player, channelId: channel.id, queue: [], current: null, repeat: false, stream: null }; sessions.set(ctx.guild.id, session); connection.subscribe(player);
  player.on(AudioPlayerStatus.Idle, () => { if (session.repeat && session.current) session.queue.unshift(session.current); advance(session); });
  player.on('error', (error) => { logger.error('[music] Reproducción directa', error); advance(session); }); connection.on(VoiceConnectionStatus.Destroyed, () => { destroyStream(session); sessions.delete(ctx.guild.id); }); return session;
}
async function play(ctx) {
  const query = ctx.text.trim(); if (!query) return ctx.fail('Uso: `xyb play canción o enlace`'); const session = await getSession(ctx); if (!session) return;
  if (session.channelId !== voiceChannel(ctx).id) return ctx.fail('Entra al mismo canal de voz que Xyb para controlar la música.');
  let track; try { track = await findTrack(query); } catch (error) { logger.warn(`[music] ${error.message}`); return ctx.fail('No encontré música con esa búsqueda. Prueba con otro título o enlace.'); }
  session.queue.push(track); if (!session.current) advance(session); return ctx.send({ embeds: [embed(session.current === track ? 'Reproduciendo' : 'Añadido a la cola', `**${track.title}**\nDuración: \`${formatTime(track.length)}\` · pedido por <@${ctx.user.id}>`)] });
}
async function controls(ctx, action) {
  const session = currentSession(ctx.guild?.id); if (!session) return ctx.fail('No hay música reproduciéndose en este servidor.'); if (voiceChannel(ctx)?.id !== session.channelId) return ctx.fail('Entra al canal de voz de Xyb para usar los controles.');
  if (action === 'volume') return ctx.fail('El volumen directo usa el nivel de Discord por ahora.');
  if (action === 'pause') { session.player.pause(); return ctx.send({ embeds: [embed('En pausa', 'Usa `xyb resume` para continuar.')] }); } if (action === 'resume') { session.player.unpause(); return ctx.send({ embeds: [embed('Reanudado', `Sigue: **${session.current?.title ?? 'la cola'}**`)] }); } if (action === 'skip') { session.player.stop(); return ctx.send({ embeds: [embed('Saltado', 'Pasando a la siguiente canción…')] }); } if (action === 'stop') { destroyStream(session); session.player.stop(true); session.connection.destroy(); sessions.delete(ctx.guild.id); return ctx.send({ embeds: [embed('Música detenida', 'Limpié la cola y salí del canal de voz.')] }); } if (action === 'loop') { session.repeat = !session.repeat; return ctx.send({ embeds: [embed('Repetición', session.repeat ? 'Repetiré la canción actual.' : 'La repetición quedó desactivada.')] }); }
  const items = [session.current, ...session.queue].filter(Boolean).slice(0, 10); return ctx.send({ embeds: [embed('Cola', items.length ? items.map((track, index) => `${index ? `${index}.` : '▶️'} **${track.title}** · ${formatTime(track.length)}`).join('\n') : 'La cola está vacía.')] });
}
module.exports = { name: 'play', aliases: ['p', 'pause', 'resume', 'skip', 'stop', 'queue', 'q', 'volume', 'vol', 'loop', 'np', 'nowplaying'], description: 'Reproduce música en voz con cola y controles.', usage: 'xyb play <canción o enlace>', guildOnly: true, botPermissions: ['Connect', 'Speak'], slash: { description: 'Reproduce una canción o enlace en tu canal de voz.', setup: (builder) => builder.addStringOption((option) => option.setName('busqueda').setDescription('Canción, artista o enlace').setRequired(true)) }, initialize, async execute(ctx) { if (ctx.isSlash) ctx.text = ctx.interaction.options.getString('busqueda', true); const action = ctx.invokedName; return action === 'play' || action === 'p' ? play(ctx) : controls(ctx, action === 'vol' ? 'volume' : action); } };
