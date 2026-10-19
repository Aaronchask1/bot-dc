const crypto = require('node:crypto');
const { createStore } = require('../store');

const store = createStore('reminders');
const timers = new Map();
let client = null;

function parseDuration(value) {
  const match = String(value ?? '').trim().match(/^(\d{1,4})\s*(m|min|mins?|minutos?|h|hrs?|horas?|d|días?)$/i);
  if (!match) return null;
  const amount = Number(match[1]);
  const unit = match[2].toLowerCase();
  const multiplier = /^d|día/i.test(unit) ? 86_400_000 : /^h|hora/i.test(unit) ? 3_600_000 : 60_000;
  const ms = amount * multiplier;
  return ms >= 60_000 && ms <= 24 * 60 * 60_000 ? ms : null;
}

function recordsFor(userId) {
  return Object.values(store.read()).filter((record) => record.userId === userId).sort((a, b) => a.at - b.at);
}

function schedule(record) {
  if (!client) return;
  clearTimeout(timers.get(record.id));
  const delay = Math.max(0, record.at - Date.now());
  const timer = setTimeout(async () => {
    timers.delete(record.id);
    const current = store.get(record.id);
    if (!current) return;
    store.delete(record.id);
    try {
      const channel = await client.channels.fetch(current.channelId);
      if (!channel?.isTextBased?.()) return;
      await channel.send({ content: `<@${current.userId}> ⏰ **Recordatorio:** ${current.text}`, allowedMentions: { users: [current.userId] } });
    } catch {
      // Los DM pueden estar cerrados; se elimina para no enviarlo infinitamente.
    }
  }, Math.min(delay, 2_147_000_000));
  timer.unref?.();
  timers.set(record.id, timer);
}

function start(discordClient) {
  client = discordClient;
  for (const record of Object.values(store.read())) schedule(record);
}

function create(userId, rawDuration, text, location = {}) {
  const ms = parseDuration(rawDuration);
  if (!ms || !location.guildId || !location.channelId) return null;
  const message = String(text ?? '').trim().slice(0, 500) || 'Recordatorio';
  const record = { id: crypto.randomUUID().slice(0, 8), userId, text: message, guildId: location.guildId, channelId: location.channelId, at: Date.now() + ms };
  store.set(record.id, record);
  schedule(record);
  return record;
}

function remove(userId, id) {
  const record = store.get(id);
  if (!record || record.userId !== userId) return false;
  clearTimeout(timers.get(id)); timers.delete(id);
  return store.delete(id);
}

module.exports = { parseDuration, recordsFor, start, create, remove };
