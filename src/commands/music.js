const { EmbedBuilder } = require('discord.js');
const { Connectors, LoadType, Shoukaku } = require('shoukaku');
const logger = require('../logger');

let playerManager = null;
const sessions = new Map();

function configured() {
  return Boolean(process.env.LAVALINK_URL && process.env.LAVALINK_PASSWORD);
}

function initialize(client) {
  if (!configured() || playerManager) return playerManager;
  const url = process.env.LAVALINK_URL.replace(/^wss?:\/\//, '').replace(/\/$/, '');
  playerManager = new Shoukaku(new Connectors.DiscordJS(client), [{
    name: 'xyb-audio', url, auth: process.env.LAVALINK_PASSWORD, secure: process.env.LAVALINK_SECURE === 'true',
  // Railway puede tardar más de medio minuto al reconstruir Lavalink y sus
  // plugins. Conservamos la conexión durante diez minutos en vez de rendirnos
  // tras los seis intentos predeterminados.
  }], { reconnectTries: 120, reconnectInterval: 5, restTimeout: 20 });
  playerManager.on('ready', (name) => logger.info(`[music] Nodo ${name} listo.`));
  playerManager.on('error', (name, error) => logger.error(`[music] Nodo ${name}: ${error.message}`, error));
  return playerManager;
}

function formatTime(milliseconds) {
  if (!Number.isFinite(milliseconds) || milliseconds <= 0) return 'En directo';
  const seconds = Math.floor(milliseconds / 1000); const minutes = Math.floor(seconds / 60);
  return `${minutes}:${String(seconds % 60).padStart(2, '0')}`;
}

function currentSession(guildId) { return sessions.get(guildId); }

async function advance(session) {
  const next = session.queue.shift();
  if (!next) { session.current = null; return; }
  session.current = next;
  await session.player.playTrack({ track: { encoded: next.encoded } });
}

function installPlayerEvents(session) {
  session.player.on('end', async (event) => {
    if (event.reason === 'replaced' || event.reason === 'stopped' || event.reason === 'cleanup') return;
    try {
      if (session.repeat && session.current) session.queue.unshift(session.current);
      await advance(session);
    } catch (error) { logger.error('[music] No pude continuar la cola', error); }
  });
  session.player.on('exception', (event) => logger.error(`[music] Error reproduciendo: ${event.exception?.message ?? 'desconocido'}`));
}

function musicEmbed(title, description) {
  return new EmbedBuilder().setColor(0x9b5cff).setTitle(`🎵 ${title}`).setDescription(description).setFooter({ text: 'Xyb Music · audio en alta calidad' });
}

function voiceChannel(ctx) { return ctx.member?.voice?.channel ?? null; }

async function getSession(ctx) {
  const channel = voiceChannel(ctx);
  if (!channel) { await ctx.fail('Entra primero a un canal de voz.'); return null; }
  if (!playerManager) { await ctx.fail('El servidor de música aún está iniciando. Inténtalo en unos segundos.'); return null; }
  let session = currentSession(ctx.guild.id);
  if (session) return session;
  const player = await playerManager.joinVoiceChannel({ guildId: ctx.guild.id, channelId: channel.id, shardId: ctx.guild.shardId ?? 0, deaf: true });
  session = { player, channelId: channel.id, queue: [], current: null, repeat: false };
  sessions.set(ctx.guild.id, session); installPlayerEvents(session);
  return session;
}

function trackList(result) {
  if (!result) return [];
  if (result.loadType === LoadType.TRACK) return [result.data];
  if (result.loadType === LoadType.SEARCH) return result.data.slice(0, 1);
  if (result.loadType === LoadType.PLAYLIST) return result.data.tracks.slice(0, 100);
  return [];
}

async function play(ctx) {
  const query = ctx.text.trim();
  if (!query) return ctx.fail('Uso: `xyb play canción o enlace`');
  const session = await getSession(ctx); if (!session) return;
  if (session.channelId !== voiceChannel(ctx).id) return ctx.fail('Entra al mismo canal de voz que Xyb para controlar la música.');
  const node = playerManager.getIdealNode();
  if (!node) return ctx.fail('El nodo de música aún no está listo. Prueba de nuevo en unos segundos.');
  const identifier = /^https?:\/\//i.test(query) ? query : `ytsearch:${query}`;
  const result = await node.rest.resolve(identifier);
  const tracks = trackList(result);
  if (!tracks.length) return ctx.fail('No encontré música con esa búsqueda. Prueba con otro título o enlace.');
  session.queue.push(...tracks);
  const first = tracks[0];
  if (!session.current) await advance(session);
  const added = tracks.length === 1 ? `**${first.info.title}**` : `**${tracks.length} canciones** de la lista`;
  return ctx.send({ embeds: [musicEmbed(session.current === first ? 'Reproduciendo' : 'Añadido a la cola', `${added}\nDuración: \`${formatTime(first.info.length)}\` · pedido por <@${ctx.user.id}>`)] });
}

async function controls(ctx, action) {
  const session = currentSession(ctx.guild?.id);
  if (!session) return ctx.fail('No hay música reproduciéndose en este servidor.');
  if (voiceChannel(ctx)?.id !== session.channelId) return ctx.fail('Entra al canal de voz de Xyb para usar los controles.');
  if (action === 'pause') { await session.player.setPaused(true); return ctx.send({ embeds: [musicEmbed('En pausa', 'Usa `xyb resume` para continuar.')] }); }
  if (action === 'resume') { await session.player.setPaused(false); return ctx.send({ embeds: [musicEmbed('Reanudado', `Sigue: **${session.current?.info.title ?? 'la cola'}**`)] }); }
  if (action === 'skip') { await session.player.stopTrack(); return ctx.send({ embeds: [musicEmbed('Saltado', 'Pasando a la siguiente canción…')] }); }
  if (action === 'stop') { sessions.delete(ctx.guild.id); await session.player.destroy(); return ctx.send({ embeds: [musicEmbed('Música detenida', 'Limpié la cola y salí del canal de voz.')] }); }
  if (action === 'loop') { session.repeat = !session.repeat; return ctx.send({ embeds: [musicEmbed('Repetición', session.repeat ? 'Repetiré la canción actual.' : 'La repetición quedó desactivada.')] }); }
  if (action === 'volume') {
    const amount = Number(ctx.args[0]);
    if (!Number.isInteger(amount) || amount < 0 || amount > 150) return ctx.fail('Uso: `xyb volume 0-150`');
    await session.player.setGlobalVolume(amount);
    return ctx.send({ embeds: [musicEmbed('Volumen', `Volumen ajustado a **${amount}%**.`)] });
  }
  const items = [session.current, ...session.queue].filter(Boolean).slice(0, 10);
  const queueText = items.length
    ? items.map((track, index) => `${index === 0 ? '▶️' : `${index}.`} **${track.info.title}** · ${formatTime(track.info.length)}`).join('\n')
    : 'La cola está vacía.';
  return ctx.send({ embeds: [musicEmbed('Cola', queueText)] });
}

module.exports = {
  name: 'play', aliases: ['p', 'pause', 'resume', 'skip', 'stop', 'queue', 'q', 'volume', 'vol', 'loop', 'np', 'nowplaying'],
  description: 'Reproduce música en voz con cola, volumen y controles.', usage: 'xyb play <canción o enlace>', guildOnly: true,
  botPermissions: ['Connect', 'Speak'],
  slash: { description: 'Reproduce una canción o enlace en tu canal de voz.', setup: (builder) => builder.addStringOption((option) => option.setName('busqueda').setDescription('Canción, artista o enlace').setRequired(true)) },
  initialize,
  async execute(ctx) {
    if (!configured()) return ctx.fail('La música está configurándose. El administrador debe añadir LAVALINK_URL y LAVALINK_PASSWORD.');
    if (ctx.isSlash) ctx.text = ctx.interaction.options.getString('busqueda', true);
    const action = ctx.invokedName;
    if (action === 'play' || action === 'p') return play(ctx);
    if (action === 'q' || action === 'queue' || action === 'np' || action === 'nowplaying') return controls(ctx, 'queue');
    return controls(ctx, action === 'vol' ? 'volume' : action);
  },
};
