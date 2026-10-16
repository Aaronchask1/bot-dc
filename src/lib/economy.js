const { createStore } = require('../store');
const profiles = require('./profiles');

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
const SHOP = {
  bait: { name: '🪱 Carnada premium', price: 120, sell: 60, description: '+25% monedas al pescar una vez.' },
  rod: { name: '🎣 Caña reforzada', price: 900, sell: 450, description: 'Reduce el riesgo de accidente al pescar.' },
  insurance: { name: '🛡️ Seguro de bolsillo', price: 350, sell: 175, description: 'Evita una pérdida al morir una vez.' },
};
const key = (guildId, userId) => `${guildId}:${userId}`;
const choose = (items) => items[Math.floor(Math.random() * items.length)];

function get(guildId, userId) {
  const record = store.get(key(guildId, userId));
  return { wallet: 0, bank: 0, fish: {}, inventory: {}, catches: 0, deaths: 0, lastWork: 0, lastFish: 0, lastDaily: 0, ...(record ?? {}) };
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
function bankCapacity(guildId, userId) {
  const level = profiles.progress(profiles.get(guildId, userId).xp).level;
  return 1000 + (level * 500);
}
function addItem(record, item, quantity = 1) { record.inventory[item] = (record.inventory[item] ?? 0) + quantity; }
function takeItem(record, item, quantity = 1) {
  if ((record.inventory[item] ?? 0) < quantity) return false;
  record.inventory[item] -= quantity;
  if (!record.inventory[item]) delete record.inventory[item];
  return true;
}
function risk(record, activity) {
  let chance = activity === 'fish' ? 0.1 : 0.08;
  if (activity === 'fish' && record.inventory.rod) chance = 0.04;
  if (Math.random() >= chance) return null;
  if (takeItem(record, 'insurance')) return { protected: true, lost: 0 };
  const lost = Math.floor(record.wallet * 0.2);
  record.wallet -= lost; record.deaths += 1;
  return { protected: false, lost };
}
function claim(guildId, userId, action, now = Date.now()) {
  const record = get(guildId, userId);
  const wait = remaining(record, action, now);
  if (wait) return { ok: false, wait };
  const field = `last${action[0].toUpperCase()}${action.slice(1)}`;
  if (action === 'work') {
    const [text, coins] = choose(JOBS);
    const accident = risk(record, 'work');
    record.wallet += coins; record[field] = now; save(guildId, userId, record);
    return { ok: true, record, coins, text, accident };
  }
  if (action === 'fish') {
    const [fish, coins] = choose(FISH);
    const bait = takeItem(record, 'bait');
    const earned = bait ? Math.round(coins * 1.25) : coins;
    const accident = risk(record, 'fish');
    record.wallet += earned; record.catches += 1; record.fish[fish] = (record.fish[fish] ?? 0) + 1; record[field] = now; save(guildId, userId, record);
    return { ok: true, record, coins: earned, fish, bait, accident };
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
  const record = get(guildId, userId); const capacity = bankCapacity(guildId, userId); const space = Math.max(0, capacity - record.bank);
  const requested = amount(value, record.wallet); const coins = requested === null ? null : Math.min(requested, space);
  if (!coins) return { ok: false, reason: space ? 'amount' : 'full', capacity, record };
  record.wallet -= coins; record.bank += coins; save(guildId, userId, record); return { ok: true, coins, capacity, record, limited: coins !== requested };
}
function withdraw(guildId, userId, value) {
  const record = get(guildId, userId); const coins = amount(value, record.bank);
  if (!coins) return { ok: false, reason: 'amount', capacity: bankCapacity(guildId, userId), record };
  record.bank -= coins; record.wallet += coins; save(guildId, userId, record); return { ok: true, coins, capacity: bankCapacity(guildId, userId), record };
}
function buy(guildId, userId, item) {
  const product = SHOP[item]; if (!product) return null;
  const record = get(guildId, userId); if (record.wallet < product.price) return { ok: false, record, product };
  record.wallet -= product.price; addItem(record, item); save(guildId, userId, record); return { ok: true, record, product };
}
function sell(guildId, userId, item, value = 'all') {
  const record = get(guildId, userId);
  if (item === 'fish' || item === 'peces') {
    const count = Object.values(record.fish).reduce((sum, amount) => sum + amount, 0);
    if (!count) return { ok: false, reason: 'empty' };
    const coins = Object.entries(record.fish).reduce((sum, [, amount]) => sum + amount * 18, 0);
    record.fish = {}; record.wallet += coins; save(guildId, userId, record); return { ok: true, coins, count, record, fish: true };
  }
  const product = SHOP[item]; const quantity = product ? amount(value, record.inventory[item] ?? 0) : null;
  if (!product || !quantity) return { ok: false, reason: 'item' };
  takeItem(record, item, quantity); const coins = product.sell * quantity; record.wallet += coins; save(guildId, userId, record); return { ok: true, coins, quantity, record, product };
}
function exchange(guildId, fromId, toId, offered, wanted) {
  const from = get(guildId, fromId); const to = get(guildId, toId);
  if (!SHOP[offered] || !SHOP[wanted] || !takeItem(from, offered) || !takeItem(to, wanted)) return null;
  addItem(from, wanted); addItem(to, offered); save(guildId, fromId, from); save(guildId, toId, to); return { from, to };
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
module.exports = { COOLDOWNS, SHOP, get, total, remaining, relative, bankCapacity, claim, deposit, withdraw, transfer, buy, sell, exchange, leaderboard };
