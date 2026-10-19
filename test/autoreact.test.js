const test = require('node:test');
const assert = require('node:assert/strict');
const { createAutoReact, addRule, setRule, setEnabled, getConfig } = require('../src/lib/autoreact');

test('autoreact reacciona a una palabra configurada y permite apagarlo', async () => {
  const guild = { id: `react-${Date.now()}` };
  setRule(guild.id, 'kemono', '🐷');
  const calls = [];
  const react = createAutoReact();
  const message = { guild, author: { bot: false }, content: '@kemono', react: async emoji => calls.push(emoji) };
  assert.equal(await react.handle(message), true);
  assert.deepEqual(calls, ['🐷']);
  setEnabled(guild.id, false);
  assert.equal(await react.handle(message), false);
  assert.equal(getConfig(guild.id).enabled, false);
});

test('autoreact ignora bots, comandos y reglas ausentes', async () => {
  const react = createAutoReact();
  const calls = [];
  const base = { guild: { id: `react-empty-${Date.now()}` }, author: { bot: false }, react: async () => calls.push(true) };
  assert.equal(await react.handle({ ...base, content: 'xyb kemono' }), false);
  assert.equal(await react.handle({ ...base, author: { bot: true }, content: 'kemono' }), false);
  assert.equal(await react.handle({ ...base, content: 'otra cosa' }), false);
  assert.equal(calls.length, 0);
});

test('autoreact añade múltiples reacciones y las aplica todas', async () => {
  const guild = { id: `react-multi-${Date.now()}` };
  assert.equal(addRule(guild.id, 'hola', '🐷 | 🔥 | 🐷').ok, true);
  assert.deepEqual(getConfig(guild.id).rules[0].emojis, ['🐷', '🔥']);
  const calls = [];
  const react = createAutoReact();
  const message = { guild, author: { bot: false }, content: 'hola', react: async emoji => calls.push(emoji) };
  assert.equal(await react.handle(message), true);
  assert.deepEqual(calls, ['🐷', '🔥']);
});
