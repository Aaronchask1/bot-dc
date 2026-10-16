const crypto = require('node:crypto');
const { createStore } = require('../store');

const store = createStore('reminders');
const timers = new Map();
let client = null;

function parseDuration(value) {
  const match = String(value ?? '').trim().match(/^(\d{1,4})\s*(m|min|h|d)$/i);
  if (!match) return null;
  const amount = Number(match[1]);
  const unit = match[2].toLowerCase();
  const multiplier = unit === 'd' ? 86_400_000 : unit === 'h' ? 3_600_000 : 60_000;
  const ms = amount * multiplier;
  return ms >= 60_000 && ms <= 30 * 86_400_000 ? ms : null;
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
      const user = await client.users.fetch(current.userId);
      await user.send(`⏰ **Recordatorio:** ${current.text}`);
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

function create(userId, rawDuration, text) {
  const ms = parseDuration(rawDuration);
  if (!ms || !String(text ?? '').trim()) return null;
  const record = { id: crypto.randomUUID().slice(0, 8), userId, text: String(text).trim().slice(0, 500), at: Date.now() + ms };
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
