'use strict';

// Internal Railway bridge. The web service authenticates users independently;
// the bot repeats guild/permission checks using the claimed Discord user ID.
const http = require('node:http');
const { createHash, timingSafeEqual } = require('node:crypto');
const { ChannelType, PermissionFlagsBits } = require('discord.js');

const idPattern = /^\d{17,20}$/;
const tokenDigest = value => createHash('sha256').update(value).digest();
const eq = (a, b) => timingSafeEqual(tokenDigest(a), tokenDigest(b));
const validChannel = channel => channel && [ChannelType.GuildText, ChannelType.GuildAnnouncement].includes(channel.type);
const output = (res, code, data) => {
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
  res.end(JSON.stringify(data));
};

function createDashboardBridge({ client, secret, welcome, guildEvents, autorole }) {
  if (typeof secret !== 'string' || Buffer.byteLength(secret) < 32) throw new Error('El secreto del puente debe tener al menos 32 bytes.');
  return http.createServer(async (req, res) => {
    try {
      const authorization = req.headers.authorization ?? '';
      if (!authorization.startsWith('Bearer ') || !eq(authorization.slice(7), secret)) return output(res, 401, { error: 'No autorizado.' });
      const actorId = req.headers['x-xyb-actor'];
      if (typeof actorId !== 'string' || !idPattern.test(actorId)) return output(res, 403, { error: 'Usuario no autorizado.' });
      const pathname = new URL(req.url, 'http://localhost').pathname;
      const match = pathname.match(/^\/guilds\/(\d{17,20})\/(settings|channels|roles)$/);
      if (!match) return output(res, 404, { error: 'Ruta no encontrada.' });
      const guild = client.guilds.cache.get(match[1]);
      if (!guild) return output(res, 404, { error: 'El bot no está en este servidor.' });
      let member;
      try { member = await guild.members.fetch({ user: actorId, force: true }); }
      catch { return output(res, 403, { error: 'No se pudo comprobar el acceso al servidor.' }); }
      if (!member?.permissions?.has(PermissionFlagsBits.ManageGuild)) return output(res, 403, { error: 'Necesitas Gestionar servidor.' });
      const config = () => {
        const a = welcome.getConfig(guild.id), b = guildEvents.get(guild.id);
        return { guild: { id: guild.id, name: guild.name }, welcome: { channel: a.channel, message: a.message, embed: a.embed, mention: a.mention }, goodbye: { channel: b.goodbyeChannel, message: b.goodbyeMessage }, autorole: { role: autorole.getConfiguredRole(guild.id) } };
      };
      const checkChannel = id => id === null || (idPattern.test(id) && validChannel(guild.channels.cache.get(id)));
      if (req.method === 'GET' && match[2] === 'settings') return output(res, 200, config());
      if (req.method === 'GET' && match[2] === 'channels') {
        const channels = [...guild.channels.cache.values()].filter(validChannel).map(({ id, name }) => ({ id, name }));
        return output(res, 200, { channels });
      }
      if (req.method === 'GET' && match[2] === 'roles') {
        if (!member.permissions.has(PermissionFlagsBits.ManageRoles)) return output(res, 200, { roles: [], manageable: false });
        const roles = [...guild.roles.cache.values()].filter(role => !autorole.validateRole(guild, member, role)).map(({ id, name }) => ({ id, name }));
        return output(res, 200, { roles, manageable: true });
      }
      if (req.method !== 'POST' || match[2] !== 'settings') return output(res, 405, { error: 'Método no admitido.' });
      if (!(req.headers['content-type'] || '').toLowerCase().startsWith('application/json')) return output(res, 415, { error: 'Se esperaba JSON.' });
      let size = 0, tooLarge = false, chunks = [];
      for await (const chunk of req) { size += chunk.length; if (size > 8192) tooLarge = true; else chunks.push(chunk); }
      if (tooLarge) return output(res, 413, { error: 'Solicitud demasiado grande.' });
      let body;
      try { body = JSON.parse(Buffer.concat(chunks).toString('utf8')); }
      catch { return output(res, 400, { error: 'JSON inválido.' }); }
      if (!body || typeof body !== 'object' || Array.isArray(body) || !Object.keys(body).length || Object.keys(body).some(key => !['welcome', 'goodbye', 'autorole'].includes(key))) return output(res, 400, { error: 'Ajustes inválidos.' });
      for (const key of ['welcome', 'goodbye']) {
        const section = body[key];
        if (section === undefined) continue;
        if (!section || typeof section !== 'object' || Array.isArray(section) || Object.keys(section).some(k => !['channel', 'message'].includes(k)) || !Object.hasOwn(section, 'channel') || !checkChannel(section.channel) || typeof section.message !== 'string' || !section.message.trim() || section.message.length > 1000 || /@everyone|@here|<@!?\d+>|<@&\d+>/i.test(section.message)) return output(res, 400, { error: 'Canal o mensaje inválido.' });
      }
      if (body.autorole !== undefined) {
        const section = body.autorole;
        if (!section || typeof section !== 'object' || Array.isArray(section) || Object.keys(section).some(k => k !== 'role') || !Object.hasOwn(section, 'role') || (section.role !== null && (typeof section.role !== 'string' || !idPattern.test(section.role)))) return output(res, 400, { error: 'Rol inválido.' });
        if (!member.permissions.has(PermissionFlagsBits.ManageRoles)) return output(res, 403, { error: 'Necesitas Gestionar roles.' });
        if (section.role !== null && autorole.validateRole(guild, member, guild.roles.cache.get(section.role))) return output(res, 400, { error: 'El rol no se puede asignar automáticamente.' });
      }
      if (body.welcome) welcome.setConfig(guild.id, { channel: body.welcome.channel, message: body.welcome.message });
      if (body.goodbye) guildEvents.set(guild.id, { goodbyeChannel: body.goodbye.channel, goodbyeMessage: body.goodbye.message });
      if (body.autorole) autorole.setConfiguredRole(guild.id, body.autorole.role);
      return output(res, 200, config());
    } catch {
      if (!res.headersSent) output(res, 500, { error: 'No se pudo completar la operación.' });
      else res.end();
    }
  });
}

function startDashboardBridge(client, env = process.env) {
  if (!env.DASHBOARD_BRIDGE_PORT && !env.DASHBOARD_BRIDGE_SECRET) return null;
  const port = Number(env.DASHBOARD_BRIDGE_PORT);
  if (!Number.isInteger(port) || port < 1 || port > 65535 || !env.DASHBOARD_BRIDGE_SECRET) throw new Error('Configura un puerto y secreto válidos para el puente.');
  const server = createDashboardBridge({ client, secret: env.DASHBOARD_BRIDGE_SECRET, welcome: require('./welcome'), guildEvents: require('./guild-events'), autorole: require('../commands/autorole') });
  server.listen(port, '::');
  return server;
}

module.exports = { createDashboardBridge, startDashboardBridge };
