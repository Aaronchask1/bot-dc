const { createStore } = require('../store');
const logger = require('../logger');

function createController(store, log = logger) {
  function get(guildId) { return { logsChannel: null, goodbyeChannel: null, goodbyeMessage: 'Hasta pronto, {{username}}. 💜', ...(store.get(guildId) || {}) }; }
  function set(guildId, patch) { const config = { ...get(guildId), ...patch }; store.set(guildId, config); return config; }
  function render(template, member) {
    const values = { username: member.user?.username || member.id, user: member.user?.username || member.id, id: member.id, server: member.guild.name, members: String(member.guild.memberCount ?? '?') };
    return String(template).replace(/\{\{(username|user|id|server|members)\}\}/g, (_, key) => values[key]);
  }
  async function send(guild, id, content) {
    if (!id) return;
    const channel = guild.channels?.cache?.get(id);
    if (!channel?.isTextBased?.() || typeof channel.send !== 'function') return;
    try { await channel.send({content: String(content).slice(0, 2000), allowedMentions: {parse: []}}); }
    catch (error) { log.warn('No pude enviar el evento de miembros.', error); }
  }
  async function handleMemberAdd(member) {
    const config = get(member.guild.id);
    await send(member.guild, config.logsChannel, `📥 Se unió **${member.user?.username || 'Un miembro'}** (ID: \`${member.id}\`).`);
  }
  async function handleMemberRemove(member) {
    const config = get(member.guild.id), username = member.user?.username || 'Un miembro';
    await Promise.all([
      send(member.guild, config.logsChannel, `📤 Salió **${username}** (ID: \`${member.id}\`).`),
      send(member.guild, config.goodbyeChannel, render(config.goodbyeMessage, member)),
    ]);
  }
  return { get, set, render, handleMemberAdd, handleMemberRemove };
}

module.exports = { createController, ...createController(createStore('guild-events')) };
