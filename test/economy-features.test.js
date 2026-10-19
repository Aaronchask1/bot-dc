const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

process.env.XYB_DATA_DIR ??= fs.mkdtempSync(path.join(os.tmpdir(), 'xyb-economy-'));
const economy = require('../src/lib/economy');
const reminders = require('../src/lib/reminders');
const deposit = require('../src/commands/deposit');
const shop = require('../src/commands/shop');
const remind = require('../src/commands/remind');
const bag = require('../src/commands/bag');
const pets = require('../src/lib/pets');

test('rm acepta minutos/horas y limita recordatorios a 24 horas', () => {
  assert.equal(reminders.parseDuration('30 minutos'), 30 * 60_000);
  assert.equal(reminders.parseDuration('2 horas'), 2 * 60 * 60_000);
  assert.equal(reminders.parseDuration('24h'), 24 * 60 * 60_000);
  assert.equal(reminders.parseDuration('25h'), null);
  assert.equal(reminders.parseDuration('2d'), null);
});

test('rm confirma con un embed visual y permite omitir el texto', async () => {
  const replies = [];
  await remind.execute({
    args: ['10m'], text: '10m', user: { id: 'reminder-user', username: 'n', displayAvatarURL: () => 'https://example.com/avatar.png' },
    guild: { id: 'reminder-guild' }, channel: { id: 'reminder-channel' }, isSlash: false, reply: async payload => replies.push(payload),
  });
  const embed = replies[0].embeds[0].toJSON();
  assert.equal(embed.title, '⏰ Recordatorio registrado');
  assert.match(embed.description, /Te recordaré aquí/);
  assert.ok(embed.fields.some(field => field.name === '📌 Fijado para'));
});

test('el banco mueve monedas y el menú muestra bolsillo, banco y capacidad', () => {
  const guildId = `economy-${Date.now()}`;
  const userId = 'u1';
  const record = economy.get(guildId, userId);
  record.wallet = 500;
  economy.store.set(`${guildId}:${userId}`, record);
  const deposited = economy.deposit(guildId, userId, '300');
  assert.equal(deposited.ok, true);
  assert.equal(deposited.record.bank, 300);
  const payloads = [];
  return deposit.execute({ guild: { id: guildId }, user: { id: userId }, reply: async payload => payloads.push(payload) }).then(() => {
    const embed = payloads[0].embeds[0].toJSON();
    assert.match(embed.title, /Banco XYB/);
    assert.match(embed.fields.map(field => field.name).join(' '), /Bolsillo/);
    assert.equal(payloads[0].components[0].toJSON().components.length, 4);
  });
});

test('el pico cuesta 300, se mejora y habilita mine', () => {
  const guildId = `mine-${Date.now()}`;
  const userId = 'u1';
  const record = economy.get(guildId, userId);
  record.wallet = 20_000;
  economy.store.set(`${guildId}:${userId}`, record);
  const first = economy.buy(guildId, userId, 'pickaxe');
  assert.equal(first.ok, true);
  assert.equal(first.level, 1);
  const mined = economy.mine(guildId, userId, Date.now() - economy.COOLDOWNS.mine);
  assert.equal(mined.ok, true);
  assert.ok(mined.coins > 0);
  const upgrade = economy.buy(guildId, userId, 'pickaxe');
  assert.equal(upgrade.ok, true);
  assert.equal(upgrade.level, 2);
  const products = economy.shopProducts(economy.get(guildId, userId));
  assert.match(products.pickaxe.name, /Pico/);
  const view = shop.catalog(guildId, userId);
  assert.match(view.embeds[0].toJSON().title, /Tienda XYB/);
  assert.equal(view.components[0].toJSON().components.length, 5);
});

test('la tienda permite mejorar capacidad del banco y niveles de caña', () => {
  const guildId = `upgrades-${Date.now()}`;
  const userId = 'u1';
  const record = economy.get(guildId, userId);
  record.wallet = 20_000;
  economy.store.set(`${guildId}:${userId}`, record);
  const before = economy.bankCapacity(guildId, userId);
  const bankOne = economy.buy(guildId, userId, 'bank');
  assert.equal(bankOne.ok, true);
  assert.equal(bankOne.level, 1);
  assert.equal(economy.bankCapacity(guildId, userId), before + 500);
  const bankTwo = economy.buy(guildId, userId, 'bank');
  assert.equal(bankTwo.ok, true);
  assert.equal(bankTwo.level, 2);
  assert.equal(economy.productFor('bank', economy.get(guildId, userId)).price, 3_500);
  const rodOne = economy.buy(guildId, userId, 'rod');
  assert.equal(rodOne.ok, true);
  assert.equal(rodOne.level, 1);
  assert.equal(economy.rodLevelFor(rodOne.record), 1);
  const rodTwo = economy.buy(guildId, userId, 'rod');
  assert.equal(rodTwo.ok, true);
  assert.equal(rodTwo.level, 2);
  assert.match(economy.productFor('rod', economy.get(guildId, userId)).name, /Caña/);
  assert.equal(economy.productFor('rod', { rodLevel: economy.ROD_UPGRADES.length }).maxed, true);
});

test('bag crea el panel paginado con selector, iconos y navegación', () => {
  const guildId = `bag-${Date.now()}`;
  const userId = 'u1';
  const data = economy.get(guildId, userId);
  data.minerals = { '💎 Zafiro': 3, '🟡 Oro': 1 };
  data.fish = { '🐟 Pez común': 2 };
  data.inventory = { bait: 1, insurance: 1 };
  economy.store.set(`${guildId}:${userId}`, data);
  const payload = bag.render(guildId, { id: userId });
  assert.equal(payload.content, 'Página 1 de 1');
  assert.match(payload.embeds[0].toJSON().title, /Tu mochila/);
  assert.match(payload.embeds[0].toJSON().description, /Lista de objetos \(5\)/);
  assert.equal(payload.components.length, 2);
  assert.equal(payload.components[0].toJSON().components[0].type, 3);
  assert.equal(payload.components[1].toJSON().components.length, 5);
});

test('huevo, frutas y pastel permiten incubar y subir una mascota', () => {
  const guildId = `pet-${Date.now()}`;
  const userId = 'u1';
  const wallet = economy.get(guildId, userId);
  wallet.wallet = 5_000;
  economy.store.set(`${guildId}:${userId}`, wallet);
  assert.equal(economy.buy(guildId, userId, 'egg').ok, true);
  assert.equal(economy.buy(guildId, userId, 'apple').ok, true);
  assert.equal(economy.buy(guildId, userId, 'cake').ok, true);
  const hatched = pets.hatch(guildId, userId, 'Mochi');
  assert.equal(hatched.ok, true);
  assert.equal(hatched.pet.name, 'Mochi');
  const fed = pets.care(guildId, userId, 'feed', 'cake');
  assert.equal(fed.ok, true);
  assert.equal(fed.xp, 60);
  assert.equal(pets.active(pets.get(guildId, userId)).level, 2);
  assert.equal(pets.care(guildId, userId, 'feed', 'apple').ok, true);
});
