const { createStore } = require('../store');

const store = createStore('afk');
const NOTICE_COOLDOWN = 5 * 60_000;
const notices = new Map();
const key = (guildId, userId) => `${guildId}:${userId}`;

function set(guildId, userId, reason = '') {
  const record = { reason: String(reason).trim().slice(0, 180), since: Date.now() };
  store.set(key(guildId, userId), record);
  return record;
}

function get(guildId, userId) { return store.get(key(guildId, userId)) ?? null; }
function clear(guildId, userId) { return store.delete(key(guildId, userId)); }

async function handleMessage(message) {
  if (!message.guild) return;
  const own = get(message.guild.id, message.author.id);
  if (own) {
    clear(message.guild.id, message.author.id);
    await message.channel.send(`🌤️ ${message.author}, ya quité tu estado AFK.`).catch(() => {});
  }

  const mentioned = [...(message.mentions?.users?.values?.() ?? [])]
    .filter((person) => person.id !== message.author.id)
    .slice(0, 3);
  const now = Date.now();
  for (const person of mentioned) {
    const record = get(message.guild.id, person.id);
    if (!record) continue;
    const noticeKey = `${message.guild.id}:${message.author.id}:${person.id}`;
    if ((notices.get(noticeKey) ?? 0) + NOTICE_COOLDOWN > now) continue;
    notices.set(noticeKey, now);
    const reason = record.reason ? ` — ${record.reason}` : '';
    await message.channel.send(`💤 ${person} está AFK desde <t:${Math.floor(record.since / 1000)}:R>${reason}`).catch(() => {});
  }
}

module.exports = { set, get, clear, handleMessage };
