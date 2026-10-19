const { createStore } = require('../store');
const profiles = require('./profiles');

const store = createStore('economy');
const COOLDOWNS = { work: 30 * 60_000, fish: 10 * 60_000, mine: 15 * 60_000, daily: 24 * 60 * 60_000 };
const FISH = [
  ['🐟 Pez común', 18], ['🐠 Pez tropical', 32], ['🦐 Camarón', 25], ['🦑 Calamar', 45],
  ['🐡 Pez globo', 60], ['🦈 Tiburón pequeño', 120], ['🐋 Tesoro del océano', 250],
];
const JOBS = [
  ['atendiste una cafetería', 70], ['arreglaste una PC', 95], ['paseaste perros', 65],
  ['entregaste paquetes', 80], ['programaste un bot', 125], ['ganaste una partida', 105],
];
const MINE_ORES = [
  ['🪨 Piedra brillante', 35], ['🪙 Pepita de cobre', 55], ['🔩 Hierro', 80],
  ['💎 Zafiro', 150], ['💠 Esmeralda', 260], ['🟡 Oro', 420], ['🔮 Cristal raro', 700],
];
const PICKAXE_UPGRADES = [
  { level: 1, name: '⛏️ Pico de piedra', price: 300, multiplier: 1 },
  { level: 2, name: '⛏️ Pico de hierro', price: 900, multiplier: 1.35 },
  { level: 3, name: '⛏️ Pico de oro', price: 2_500, multiplier: 1.8 },
  { level: 4, name: '⛏️ Pico de diamante', price: 6_000, multiplier: 2.4 },
  { level: 5, name: '⛏️ Pico legendario', price: 15_000, multiplier: 3.2 },
];
const BANK_UPGRADES = [
  { level: 1, name: '🏦 Bolsa bancaria I', price: 500, capacity: 500, description: '+500 de capacidad bancaria.' },
  { level: 2, name: '🏦 Bolsa bancaria II', price: 1_500, capacity: 1_000, description: '+1,000 de capacidad bancaria.' },
  { level: 3, name: '🏦 Bolsa bancaria III', price: 3_500, capacity: 1_500, description: '+1,500 de capacidad bancaria.' },
  { level: 4, name: '🏦 Bolsa bancaria IV', price: 7_000, capacity: 2_500, description: '+2,500 de capacidad bancaria.' },
  { level: 5, name: '🏦 Bolsa bancaria V', price: 12_000, capacity: 4_000, description: '+4,000 de capacidad bancaria.' },
  { level: 6, name: '🏦 Bolsa bancaria VI', price: 20_000, capacity: 6_000, description: '+6,000 de capacidad bancaria.' },
];
const ROD_UPGRADES = [
  { level: 1, name: '🎣 Caña reforzada', price: 900, risk: 0.04, description: 'Reduce el riesgo de accidente al pescar.' },
  { level: 2, name: '🎣 Caña profesional', price: 1_800, risk: 0.025, description: 'Reduce aún más el riesgo al pescar.' },
  { level: 3, name: '🎣 Caña experta', price: 3_500, risk: 0.012, description: 'Casi elimina los accidentes de pesca.' },
  { level: 4, name: '🎣 Caña legendaria', price: 7_500, risk: 0, description: 'Sin riesgo de accidente al pescar.' },
];
const SHOP = {
  bait: { name: '🪱 Carnada premium', price: 120, sell: 60, description: '+25% monedas al pescar una vez.' },
  rod: { name: '🎣 Caña reforzada', price: 900, sell: 450, description: 'Compra y mejora tu caña para reducir accidentes.' },
  insurance: { name: '🛡️ Seguro de bolsillo', price: 350, sell: 175, description: 'Evita una pérdida al morir una vez.' },
  pickaxe: { name: '⛏️ Pico de piedra', price: 300, sell: 0, description: 'Desbloquea `xyb mine`; se puede mejorar cinco veces.' },
  bank: { name: '🏦 Bolsa bancaria I', price: 500, sell: 0, description: 'Aumenta la capacidad de tu banco.' },
  egg: { name: '🥚 Huevo misterioso', price: 750, sell: 375, description: 'Incúbalo con `xyb pet hatch` para obtener una mascota.' },
  apple: { name: '🍎 Manzana', price: 45, sell: 22, description: 'Alimenta a tu mascota: +10 XP.' },
  banana: { name: '🍌 Banana', price: 75, sell: 37, description: 'Alimenta a tu mascota: +18 XP.' },
  strawberry: { name: '🍓 Fresa', price: 125, sell: 62, description: 'Alimenta a tu mascota: +30 XP.' },
  cake: { name: '🍰 Pastel de cumpleaños', price: 260, sell: 130, description: 'Alimenta a tu mascota: +60 XP.' },
};
const key = (guildId, userId) => `${guildId}:${userId}`;
const choose = (items) => items[Math.floor(Math.random() * items.length)];

function get(guildId, userId) {
  const record = store.get(key(guildId, userId));
  return { wallet: 0, bank: 0, fish: {}, minerals: {}, inventory: {}, pickaxeLevel: 0, bankLevel: 0, rodLevel: 0, catches: 0, mines: 0, deaths: 0, lastWork: 0, lastFish: 0, lastMine: 0, lastDaily: 0, ...(record ?? {}) };
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
  const profileLevel = profiles.progress(profiles.get(guildId, userId).xp).level;
  const record = get(guildId, userId);
  const level = Math.max(0, Math.min(BANK_UPGRADES.length, Number(record.bankLevel) || 0));
  const bonus = BANK_UPGRADES.slice(0, level).reduce((sum, upgrade) => sum + upgrade.capacity, 0);
  return 1000 + (profileLevel * 500) + bonus;
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
  if (activity === 'fish' && rodLevelFor(record)) chance = ROD_UPGRADES[rodLevelFor(record) - 1]?.risk ?? 0.04;
  if (Math.random() >= chance) return null;
  if (takeItem(record, 'insurance')) return { protected: true, lost: 0 };
  const lost = Math.floor(record.wallet * 0.2);
  record.wallet -= lost; record.deaths += 1;
  return { protected: false, lost };
}
function pickaxeForLevel(level) { return PICKAXE_UPGRADES[Math.max(0, Math.min(PICKAXE_UPGRADES.length - 1, level - 1))] ?? null; }
function bankLevelFor(record) { return Math.max(0, Math.min(BANK_UPGRADES.length, Number(record.bankLevel) || 0)); }
function rodLevelFor(record) { return Math.max(0, Math.min(ROD_UPGRADES.length, Number(record.rodLevel) || (record.inventory?.rod ? 1 : 0))); }
function productFor(item, record = { pickaxeLevel: 0 }) {
  if (item === 'bank') {
    const current = bankLevelFor(record);
    if (current >= BANK_UPGRADES.length) return { ...BANK_UPGRADES.at(-1), item, maxed: true, description: 'Nivel máximo alcanzado.' };
    return { ...BANK_UPGRADES[current], item, description: `Mejora tu banco del nivel ${current} al ${current + 1}.` };
  }
  if (item === 'rod') {
    const current = rodLevelFor(record);
    if (current >= ROD_UPGRADES.length) return { ...ROD_UPGRADES.at(-1), item, maxed: true, description: 'Nivel máximo alcanzado.' };
    return { ...ROD_UPGRADES[current], item, description: current ? `Mejora tu caña del nivel ${current} al ${current + 1}.` : ROD_UPGRADES[0].description };
  }
  if (item !== 'pickaxe') return SHOP[item] ?? null;
  const current = Number(record.pickaxeLevel) || 0;
  if (current >= PICKAXE_UPGRADES.length) return { ...PICKAXE_UPGRADES.at(-1), item, maxed: true, description: 'Nivel máximo alcanzado.' };
  return { ...PICKAXE_UPGRADES[current], item, description: current ? `Mejora tu pico del nivel ${current} al ${current + 1}.` : SHOP.pickaxe.description };
}
function shopProducts(record) { return Object.fromEntries(Object.keys(SHOP).map((item) => [item, productFor(item, record)])); }
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
  if (action === 'mine') {
    const level = Number(record.pickaxeLevel) || 0;
    if (!level) return { ok: false, reason: 'pickaxe', record };
    const [ore, baseCoins] = choose(MINE_ORES);
    const tool = pickaxeForLevel(level);
    const coins = Math.round(baseCoins * (tool?.multiplier ?? 1));
    record.wallet += coins; record.mines += 1; record.minerals[ore] = (record.minerals[ore] ?? 0) + 1; record[field] = now;
    save(guildId, userId, record);
    return { ok: true, record, coins, ore, level, tool };
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
  const record = get(guildId, userId); const product = productFor(item, record); if (!product) return null;
  if (['pickaxe', 'bank', 'rod'].includes(item) && product.maxed) return { ok: false, reason: 'max', record, product };
  if (record.wallet < product.price) return { ok: false, record, product };
  if (item === 'pickaxe') {
    record.wallet -= product.price; record.pickaxeLevel = product.level; save(guildId, userId, record);
    return { ok: true, record, product, level: product.level };
  }
  if (item === 'bank') {
    record.wallet -= product.price; record.bankLevel = product.level; save(guildId, userId, record);
    return { ok: true, record, product, level: product.level, capacity: bankCapacity(guildId, userId) };
  }
  if (item === 'rod') {
    record.wallet -= product.price; record.rodLevel = product.level; record.inventory.rod = 1; save(guildId, userId, record);
    return { ok: true, record, product, level: product.level };
  }
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
  takeItem(record, item, quantity);
  if (item === 'rod') record.rodLevel = 0;
  const coins = product.sell * quantity; record.wallet += coins; save(guildId, userId, record); return { ok: true, coins, quantity, record, product };
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
module.exports = { COOLDOWNS, MINE_ORES, PICKAXE_UPGRADES, BANK_UPGRADES, ROD_UPGRADES, SHOP, get, total, remaining, relative, bankCapacity, bankLevelFor, rodLevelFor, claim, deposit, withdraw, transfer, buy, sell, exchange, leaderboard, mine: (guildId, userId, now = Date.now()) => claim(guildId, userId, 'mine', now), productFor, shopProducts, store };
