const { createStore } = require('../store');

const store = createStore('economy');
const COOLDOWNS = { work: 30 * 60_000, fish: 10 * 60_000, daily: 24 * 60 * 60_000 };
const FISH = [
  ['🐟 Pez común', 18], ['🐠 Pez tropical', 32], ['🦐 Camarón', 25], ['🦑 Calamar', 45],
  ['🐡 Pez globo', 60], ['🦈 Tiburón pequeño', 120], ['🐋 Tesoro del océano', 250],
];
const JOBS = [
  ['atendiste una cafetería', 70], ['arreglaste una PC', 95], ['paseaste perros', 65],
  ['entregaste paquetes', 80], ['programaste un bot', 125], ['ganaste una partida', 105],
];
const key = (guildId, userId) => `${guildId}:${userId}`;
const choose = (items) => items[Math.floor(Math.random() * items.length)];

function get(guildId, userId) {
  const record = store.get(key(guildId, userId));
  return { wallet: 0, bank: 0, fish: {}, catches: 0, lastWork: 0, lastFish: 0, lastDaily: 0, ...(record ?? {}) };
}
function save(guildId, userId, record) { store.set(key(guildId, userId), record); return record; }
function total(record) { return record.wallet + record.bank; }
function remaining(record, action, now = Date.now()) { return Math.max(0, (record[`last${action[0].toUpperCase()}${action.slice(1)}`] ?? 0) + COOLDOWNS[action] - now); }
function relative(ms) {
  const seconds = Math.ceil(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.ceil(seconds / 60)} min`;
  return `${Math.ceil(seconds / 3600)} h`;
}
function claim(guildId, userId, action, now = Date.now()) {
  const record = get(guildId, userId);
  const wait = remaining(record, action, now);
  if (wait) return { ok: false, wait };
  const field = `last${action[0].toUpperCase()}${action.slice(1)}`;
  if (action === 'work') {
    const [text, coins] = choose(JOBS);
    record.wallet += coins; record[field] = now; save(guildId, userId, record);
    return { ok: true, record, coins, text };
  }
  if (action === 'fish') {
    const [fish, coins] = choose(FISH);
    record.wallet += coins; record.catches += 1; record.fish[fish] = (record.fish[fish] ?? 0) + 1; record[field] = now; save(guildId, userId, record);
    return { ok: true, record, coins, fish };
  }
  const coins = 250;
  record.wallet += coins; record[field] = now; save(guildId, userId, record);
  return { ok: true, record, coins };
}
function amount(value, available) {
  if (['all', 'todo'].includes(String(value).toLowerCase())) return available;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 && parsed <= available ? parsed : null;
}
function deposit(guildId, userId, value) {
  const record = get(guildId, userId); const coins = amount(value, record.wallet);
  if (!coins) return null; record.wallet -= coins; record.bank += coins; save(guildId, userId, record); return { coins, record };
}
function withdraw(guildId, userId, value) {
  const record = get(guildId, userId); const coins = amount(value, record.bank);
  if (!coins) return null; record.bank -= coins; record.wallet += coins; save(guildId, userId, record); return { coins, record };
}
function transfer(guildId, fromId, toId, value) {
  if (fromId === toId) return null;
  const from = get(guildId, fromId); const coins = amount(value, from.wallet);
  if (!coins) return null;
  const to = get(guildId, toId); from.wallet -= coins; to.wallet += coins;
  save(guildId, fromId, from); save(guildId, toId, to);
  return { coins, from, to };
}
function leaderboard(guildId, limit = 10) {
  return Object.entries(store.read()).filter(([id]) => id.startsWith(`${guildId}:`))
    .map(([id, value]) => ({ userId: id.slice(guildId.length + 1), ...get(guildId, id.slice(guildId.length + 1)), ...value }))
    .sort((a, b) => total(b) - total(a)).slice(0, limit);
}
module.exports = { COOLDOWNS, get, total, remaining, relative, claim, deposit, withdraw, transfer, leaderboard };
