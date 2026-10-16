const { createStore } = require('../store');
const store = createStore('profiles');
const COOLDOWN = 60_000;
function get(guildId, userId, now = Date.now()) {
  const key = `${guildId}:${userId}`;
  let record = store.get(key);
  if (!record) {
    record = { registeredAt: now, xp: 0, lastXpAt: null, phrase: '', profession: '' };
    store.set(key, record);
  }
  return { ...record };
}
function observe(guildId, userId, now = Date.now()) {
  const record = get(guildId, userId, now);
  if (record.lastXpAt !== null && now - record.lastXpAt < COOLDOWN) return record;
  record.xp += 15;
  record.lastXpAt = now;
  store.set(`${guildId}:${userId}`, record);
  return record;
}
function update(guildId, userId, { phrase, profession }) {
  const record = get(guildId, userId);
  record.phrase = String(phrase ?? '').trim().slice(0, 160);
  record.profession = String(profession ?? '').trim().slice(0, 40);
  store.set(`${guildId}:${userId}`, record);
  return record;
}
function progress(xp) {
  const level = Math.floor(Math.sqrt(Math.max(0, xp) / 100));
  return { level, current: xp - 100 * level * level, needed: 100 * (2 * level + 1) };
}
function rank(guildId, userId) {
  const record = get(guildId, userId);
  const entries = Object.entries(store.read()).filter(([key]) => key.startsWith(`${guildId}:`));
  return { position: 1 + entries.filter(([, value]) => value.xp > record.xp).length, total: entries.length };
}
module.exports = { get, observe, update, progress, rank };
