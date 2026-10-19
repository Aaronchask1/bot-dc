const { createStore } = require('../store');
const economy = require('./economy');

const store = createStore('pets');
const MAX_LEVEL = 30;
const CARE_COOLDOWN = 10 * 60_000;
const SPECIES = [
  { name: 'Conejito lunar', emoji: '🐰' }, { name: 'Gatito', emoji: '🐱' },
  { name: 'Perrito', emoji: '🐶' }, { name: 'Zorrito', emoji: '🦊' },
  { name: 'Pingüino', emoji: '🐧' }, { name: 'Dragón bebé', emoji: '🐉' },
];
const FOODS = {
  apple: { xp: 10, hunger: 35 }, banana: { xp: 18, hunger: 48 },
  strawberry: { xp: 30, hunger: 65 }, cake: { xp: 60, hunger: 100 },
};

const key = (guildId, userId) => `${guildId}:${userId}`;
const clone = (value) => JSON.parse(JSON.stringify(value));
function get(guildId, userId) {
  const record = store.get(key(guildId, userId));
  return { pets: [], activeId: null, ...(record ?? {}) };
}
function save(guildId, userId, record) { store.set(key(guildId, userId), record); return record; }
function active(record) { return record.pets.find((pet) => pet.id === record.activeId) ?? null; }
function levelNeed(level) { return Math.max(25, level * 50); }
function careState(pet, now = Date.now()) {
  const elapsed = Math.max(0, now - (pet.lastCareAt ?? now));
  const loss = Math.floor(elapsed / (60 * 60_000)) * 4;
  return { ...pet, hunger: Math.max(0, (pet.hunger ?? 100) - loss), hygiene: Math.max(0, (pet.hygiene ?? 100) - loss), affection: Math.max(0, (pet.affection ?? 100) - loss) };
}
function persistPet(record, pet) { record.pets = record.pets.map((item) => item.id === pet.id ? pet : item); return record; }
function gainXp(pet, amount) {
  pet.xp = (pet.xp ?? 0) + amount;
  let levels = 0;
  while (pet.level < MAX_LEVEL && pet.xp >= levelNeed(pet.level)) { pet.xp -= levelNeed(pet.level); pet.level += 1; levels += 1; }
  if (pet.level >= MAX_LEVEL) pet.xp = 0;
  return levels;
}
function hatch(guildId, userId, nickname = '') {
  const wallet = economy.get(guildId, userId);
  if ((wallet.inventory.egg ?? 0) < 1) return { ok: false, reason: 'egg' };
  wallet.inventory.egg -= 1;
  if (!wallet.inventory.egg) delete wallet.inventory.egg;
  economy.store.set(`${guildId}:${userId}`, wallet);
  const record = get(guildId, userId);
  const species = SPECIES[Math.floor(Math.random() * SPECIES.length)];
  const pet = { id: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`, species: species.name, emoji: species.emoji, name: String(nickname).trim().slice(0, 32) || species.name, level: 1, xp: 0, hunger: 100, hygiene: 100, affection: 100, lastCareAt: Date.now(), lastActionAt: 0 };
  record.pets.push(pet); record.activeId = pet.id; save(guildId, userId, record);
  return { ok: true, pet: clone(pet) };
}
function care(guildId, userId, action, food = null, now = Date.now()) {
  const record = get(guildId, userId); let pet = active(record);
  if (!pet) return { ok: false, reason: 'pet' };
  pet = careState(pet, now);
  if (action === 'feed') {
    const details = FOODS[food];
    if (!details) return { ok: false, reason: 'food', pet };
    const wallet = economy.get(guildId, userId);
    if ((wallet.inventory[food] ?? 0) < 1) return { ok: false, reason: 'missing-food', food, pet };
    wallet.inventory[food] -= 1; if (!wallet.inventory[food]) delete wallet.inventory[food];
    economy.store.set(`${guildId}:${userId}`, wallet);
    pet.hunger = Math.min(100, pet.hunger + details.hunger);
    pet.lastCareAt = now;
    const levels = gainXp(pet, details.xp); persistPet(record, pet); save(guildId, userId, record);
    return { ok: true, pet, xp: details.xp, levels, food };
  }
  if (!['play', 'clean'].includes(action)) return { ok: false, reason: 'action', pet };
  const wait = Math.max(0, (pet.lastActionAt ?? 0) + CARE_COOLDOWN - now);
  if (wait) return { ok: false, reason: 'wait', wait, pet };
  if (action === 'play') pet.affection = 100; else pet.hygiene = 100;
  pet.lastActionAt = now; pet.lastCareAt = now;
  const levels = gainXp(pet, 12); persistPet(record, pet); save(guildId, userId, record);
  return { ok: true, pet, xp: 12, levels, action };
}

module.exports = { store, get, active, careState, levelNeed, hatch, care, FOODS, MAX_LEVEL, CARE_COOLDOWN };
