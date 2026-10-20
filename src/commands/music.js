const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const {
  AudioPlayerStatus,
  NoSubscriberBehavior,
  StreamType,
  VoiceConnectionStatus,
  createAudioPlayer,
  createAudioResource,
  entersState,
  getVoiceConnection,
  joinVoiceChannel,
} = require('@discordjs/voice');

const sessions = new Map();
const COOKIE_FILE = path.join(os.tmpdir(), `xyb-youtube-${process.pid}.cookies.txt`);

function formatTime(seconds) {
  if (!Number.isFinite(seconds) || seconds <= 0) return 'en directo';
  return `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;
}

function musicEmbed(title, description) {
  return new EmbedBuilder()
    .setColor(0x9b5cff)
    .setTitle(`🎵 ${title}`)
    .setDescription(description)
    .setFooter({ text: 'Xyb Music' });
}

// Railway recibe secretos como texto. Este valor es el archivo cookies.txt
// codificado en Base64; nunca se escribe en el repositorio ni se muestra en Discord.
function cookieArgs() {
  const encoded = String(process.env.YTDLP_COOKIES_B64 ?? '').trim();
  if (!encoded) return [];

  const content = Buffer.from(encoded, 'base64').toString('utf8');
  if (!content.startsWith('# Netscape HTTP Cookie File') && !content.startsWith('# HTTP Cookie File')) {
    const error = new Error('El secreto de cookies no tiene formato Netscape.');
    error.code = 'COOKIES_INVALID';
    throw error;
  }

  if (!fs.existsSync(COOKIE_FILE) || fs.readFileSync(COOKIE_FILE, 'utf8') !== content) {
    fs.writeFileSync(COOKIE_FILE, content, { encoding: 'utf8', mode: 0o600 });
  }
  return ['--cookies', COOKIE_FILE];
}

function ytdlpPath() {
  return process.env.YTDLP_PATH || 'yt-dlp';
}

function findTrack(query) {
  return new Promise((resolve, reject) => {
    const target = /^https?:\/\//i.test(query) ? query : `ytsearch1:${query}`;
    let output = ''; let errors = '';
    let child;
    try {
      child = spawn(ytdlpPath(), ['--dump-json', '--no-playlist', '--no-warnings', '--no-progress', ...cookieArgs(), target], { windowsHide: true });
    } catch (error) { reject(error); return; }
    const timer = setTimeout(() => { child.kill('SIGKILL'); reject(new Error('La búsqueda tardó demasiado.')); }, 25_000);
    child.stdout.on('data', (data) => { output += data; });
    child.stderr.on('data', (data) => { errors += data; });
    child.on('error', (error) => { clearTimeout(timer); reject(error); });
    child.on('close', (code) => {
      clearTimeout(timer);
      if (code !== 0) {
        const error = new Error(errors.trim().split('\n').slice(-3).join(' ') || `yt-dlp terminó con ${code}`);
        if (/Sign in to confirm|not a bot|login required/i.test(error.message)) error.code = 'YOUTUBE_AUTH';
        reject(error); return;
      }
      try {
        const result = JSON.parse(output);
        const item = result.entries?.find(Boolean) ?? result;
        const url = item.webpage_url || (item.id ? `https://www.youtube.com/watch?v=${item.id}` : null);
        if (!url) throw new Error('Sin resultados');
        resolve({ url, title: item.title || query, length: Number(item.duration || 0), uploader: item.uploader || item.channel || 'YouTube' });
      } catch (error) { reject(error); }
    });
  });
}

function openStream(url) {
  const ytdlp = spawn(ytdlpPath(), ['-f', 'bestaudio[acodec=opus]/bestaudio/best', '--no-playlist', '--no-warnings', '--no-progress', ...cookieArgs(), '-o', '-', url], { windowsHide: true });
  const ffmpeg = spawn(process.env.FFMPEG_PATH || 'ffmpeg', ['-hide_banner', '-loglevel', 'error', '-i', 'pipe:0', '-vn', '-c:a', 'libopus', '-b:a', '96k', '-ar', '48000', '-ac', '2', '-f', 'ogg', 'pipe:1'], { windowsHide: true });
  let lastError = '';
  ytdlp.stdout.pipe(ffmpeg.stdin);
  ytdlp.stderr.on('data', (data) => { lastError = String(data).trim().split('\n').slice(-2).join(' '); });
  ffmpeg.stderr.on('data', (data) => { lastError = String(data).trim().split('\n').slice(-2).join(' '); });
  ytdlp.on('close', () => { if (!ffmpeg.stdin.destroyed) ffmpeg.stdin.end(); });
  return { stream: ffmpeg.stdout, stop: () => { ytdlp.kill('SIGKILL'); ffmpeg.kill('SIGKILL'); }, error: () => lastError };
}

function destroyStream(session) { try { session.stream?.stop(); } catch {} session.stream = null; }

function advance(session) {
  destroyStream(session);
  const track = session.queue.shift();
  if (!track) { session.current = null; return; }
  session.current = track;
  try {
    session.stream = openStream(track.url);
    session.player.play(createAudioResource(session.stream.stream, { inputType: StreamType.OggOpus, metadata: track }));
  } catch (error) {
    session.textChannel?.send(`⚠️ No pude iniciar **${track.title}**.`).catch(() => {});
    advance(session);
  }
}

async function getSession(ctx) {
  const voice = ctx.member?.voice?.channel;
  if (!voice) { await ctx.fail('❌ Entra primero a un canal de voz.'); return null; }
  let session = sessions.get(ctx.guild.id);
  if (session) {
    if (session.connection.joinConfig.channelId !== voice.id) { await ctx.fail('❌ Entra al mismo canal de voz que Xyb para controlar la música.'); return null; }
    session.textChannel = ctx.channel;
    return session;
  }

  let connection = getVoiceConnection(ctx.guild.id);
  if (connection && connection.joinConfig.channelId !== voice.id) { await ctx.fail(`❌ Ya estoy en <#${connection.joinConfig.channelId}>. Únete a ese canal o usa \`xyb vc salir\`.`); return null; }
  if (!connection) {
    connection = joinVoiceChannel({ channelId: voice.id, guildId: ctx.guild.id, adapterCreator: ctx.guild.voiceAdapterCreator, selfDeaf: true, selfMute: false });
  } else {
    connection.rejoin({ selfDeaf: true, selfMute: false });
  }
  try { await entersState(connection, VoiceConnectionStatus.Ready, 20_000); }
  catch { await ctx.fail('❌ No pude conectarme al canal de voz.'); return null; }

  const player = createAudioPlayer({ behaviors: { noSubscriber: NoSubscriberBehavior.Play } });
  session = { connection, player, queue: [], current: null, stream: null, textChannel: ctx.channel };
  sessions.set(ctx.guild.id, session);
  connection.subscribe(player);
  player.on(AudioPlayerStatus.Idle, () => advance(session));
  player.on('error', () => advance(session));
  connection.on(VoiceConnectionStatus.Destroyed, () => { destroyStream(session); sessions.delete(ctx.guild.id); });
  return session;
}

async function play(ctx) {
  const query = String(ctx.isSlash ? ctx.interaction.options.getString('busqueda') : ctx.text).trim();
  if (!query) return ctx.fail('❌ Uso: `xyb play <canción o enlace>`');
  if (ctx.isSlash) await ctx.defer();
  const loading = ctx.isSlash ? null : await ctx.reply('🔎 Buscando música…');
  try {
    const session = await getSession(ctx); if (!session) return;
    const track = await findTrack(query);
    session.queue.push(track);
    const starting = !session.current;
    if (starting) advance(session);
    const payload = { content: null, embeds: [musicEmbed(starting ? 'Reproduciendo' : 'Añadida a la cola', `**${track.title}**\n> ${track.uploader} · \`${formatTime(track.length)}\``)] };
    if (loading) return loading.edit(payload);
    return ctx.reply(payload);
  } catch (error) {
    const message = error.code === 'COOKIES_INVALID' ? '❌ El secreto `YTDLP_COOKIES_B64` no es válido.'
      : error.code === 'YOUTUBE_AUTH' ? '❌ YouTube rechazó la sesión. Actualiza las cookies privadas de Railway.'
        : /ENOENT/.test(error.message) ? '❌ Falta instalar el reproductor en el servidor.'
          : '❌ No encontré música con esa búsqueda. Prueba con otro título o enlace.';
    if (loading) return loading.edit({ content: message });
    return ctx.fail(message);
  }
}

async function control(ctx, action) {
  const session = sessions.get(ctx.guild?.id);
  if (!session) return ctx.fail('❌ No hay música reproduciéndose en este servidor.');
  if (ctx.member?.voice?.channel?.id !== session.connection.joinConfig.channelId) return ctx.fail('❌ Entra al canal de voz de Xyb para usar los controles.');
  if (action === 'pause') { session.player.pause(); return ctx.reply({ embeds: [musicEmbed('En pausa', 'Usa `xyb resume` para continuar.')] }); }
  if (action === 'resume') { session.player.unpause(); return ctx.reply({ embeds: [musicEmbed('Reanudado', `Sigue: **${session.current?.title ?? 'la cola'}**`)] }); }
  if (action === 'skip') { session.player.stop(); return ctx.reply({ embeds: [musicEmbed('Saltado', 'Pasando a la siguiente canción…')] }); }
  if (action === 'stop') { destroyStream(session); session.queue = []; session.current = null; session.player.stop(true); return ctx.reply({ embeds: [musicEmbed('Música detenida', 'Limpié la cola. Xyb se queda en voz 24/7.')] }); }
  const tracks = [session.current, ...session.queue].filter(Boolean).slice(0, 10);
  return ctx.reply({ embeds: [musicEmbed(action === 'np' ? 'Sonando ahora' : 'Cola', tracks.length ? tracks.map((track, index) => `${index ? `${index}.` : '▶️'} **${track.title}** · \`${formatTime(track.length)}\``).join('\n') : 'La cola está vacía.')] });
}

module.exports = {
  name: 'play', aliases: ['p', 'tocar', 'reproducir', 'pause', 'pausa', 'resume', 'reanudar', 'skip', 'saltar', 'queue', 'cola', 'q', 'stop', 'detener', 'np', 'nowplaying'],
  description: 'Reproduce música de YouTube en tu canal de voz.', usage: 'xyb play <canción o enlace>', guildOnly: true,
  botPermissions: [PermissionFlagsBits.Connect, PermissionFlagsBits.Speak],
  slash: { description: 'Reproduce música de YouTube en tu canal de voz.', setup: (builder) => builder.addStringOption((option) => option.setName('busqueda').setDescription('Canción, artista o enlace').setRequired(true).setMaxLength(200)) },
  async execute(ctx) { return ['play', 'p', 'tocar', 'reproducir'].includes(ctx.invokedName) || ctx.isSlash ? play(ctx) : control(ctx, ctx.invokedName); },
};
