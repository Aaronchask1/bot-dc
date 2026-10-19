const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
process.env.XYB_DATA_DIR ??= fs.mkdtempSync(path.join(os.tmpdir(), 'xyb-autoresponder-'));
const { createAutoresponder, addRule, getConfig, removeRule, setEnabled, setRule } = require('../src/lib/autoresponder');

function message(content, target = null) {
  const replies = [];
  return {
    replies,
    message: {
      content,
      guild: { id: 'guild-1' },
      author: { id: 'author-1', bot: false },
      mentions: { users: { first: () => target } },
      reply: async payload => replies.push(payload),
    },
  };
}

test('no tiene respuestas automáticas por defecto', async () => {
  const responder = createAutoresponder();
  const kemono = message('KEMONO!!!');
  const marrano = message('ese marrano');
  assert.equal(await responder.handle(kemono.message), false);
  assert.equal(await responder.handle(marrano.message), false);
  assert.equal(kemono.replies.length + marrano.replies.length, 0);
});

test('no responde automáticamente a menciones ni nombres', async () => {
  const responder = createAutoresponder();
  const ali = { id: 'ali', bot: false };
  const firstAli = message('@ali', ali);
  const plainName = message('ali');
  assert.equal(await responder.handle(firstAli.message), false);
  assert.equal(await responder.handle(plainName.message), false);
  assert.equal(firstAli.replies.length + plainName.replies.length, 0);
});

test('ignora bots, mensajes privados, menciones a sí mismo y comandos xyb', async () => {
  const responder = createAutoresponder();
  const target = { id: 'target', bot: false };
  const bot = message('kemono', target);
  bot.message.author.bot = true;
  const dm = message('kemono');
  dm.message.guild = null;
  const self = message('@yo', { id: 'author-1', bot: false });
  const command = message('xyb kemono');
  assert.equal(await responder.handle(bot.message), false);
  assert.equal(await responder.handle(dm.message), false);
  assert.equal(await responder.handle(self.message), false);
  assert.equal(await responder.handle(command.message), false);
  assert.equal(bot.replies.length + dm.replies.length + self.replies.length + command.replies.length, 0);
});

test('acepta @kemono literal y permite cambiar reglas por servidor', async () => {
  const guild = { id: `config-${Date.now()}` };
  const responder = createAutoresponder();
  setRule(guild.id, '@Kemono', 'respuesta personalizada');
  const taggedName = message('@kemono', null);
  taggedName.message.guild = guild;
  await responder.handle(taggedName.message);
  assert.equal(taggedName.replies[0].content, 'respuesta personalizada');
  setEnabled(guild.id, false);
  const disabled = message('kemono');
  disabled.message.guild = guild;
  assert.equal(await responder.handle(disabled.message), false);
  assert.equal(getConfig(guild.id).enabled, false);
  assert.equal(removeRule(guild.id, 'kemono').ok, true);
});

test('acumula múltiples respuestas y elige una de ellas', async () => {
  const guild = { id: `multi-reply-${Date.now()}` };
  assert.equal(addRule(guild.id, 'hola', 'qué onda | qué pasó | qué tal').ok, true);
  assert.deepEqual(getConfig(guild.id).rules.find(rule => rule.trigger === 'hola').replies,
    ['qué onda', 'qué pasó', 'qué tal']);
  const responder = createAutoresponder();
  const candidate = message('hola');
  candidate.message.guild = guild;
  await responder.handle(candidate.message);
  assert.ok(['qué onda', 'qué pasó', 'qué tal'].includes(candidate.replies[0].content));
});

test('slash autoresponder sin acción solo muestra configuración', async () => {
  const command = require('../src/commands/autoresponder');
  const replies = [];
  const options = {
    get: () => null,
    getString: () => null,
  };
  await command.execute({
    guild: { id: `slash-${Date.now()}` },
    isSlash: true,
    interaction: { options },
    reply: async value => replies.push(value),
    fail: async value => replies.push(value),
    command,
  });
  assert.match(String(replies[0].content), /Autoresponder activado/);
  assert.doesNotMatch(String(replies[0].content), /Autoresponder activado en este servidor/);
});

test('xyb add añade reglas y las activa automáticamente', async () => {
  const command = require('../src/commands/add');
  const replies = [];
  const guild = { id: `add-multi-${Date.now()}` };
  const context = (args) => ({
    guild,
    args,
    reply: async value => replies.push(value),
    fail: async value => replies.push(value),
  });
  await command.execute(context(['autoresponder', 'ali', 'voz de niña']));
  await command.execute(context(['autoresponder', 'ali', 'cara de tostada | rey del cringe']));
  await command.execute(context(['autoreact', 'ali', '🐷']));
  await command.execute(context(['autoreact', 'ali', '🔥 | 💀']));
  assert.match(String(replies[0]), /Añadido y activado/);
  assert.deepEqual(getConfig(guild.id).rules.find(rule => rule.trigger === 'ali').replies,
    ['voz de niña', 'cara de tostada', 'rey del cringe']);
  const autoreact = require('../src/lib/autoreact');
  assert.deepEqual(autoreact.getConfig(guild.id).rules.find(rule => rule.trigger === 'ali').emojis,
    ['🐷', '🔥', '💀']);
});
