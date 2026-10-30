const test = require('node:test');
const assert = require('node:assert/strict');
const { SlashCommandBuilder } = require('discord.js');
process.env.XYB_GIFS_OFFLINE = '1';
const act = require('../src/commands/act');
const gifs = require('../src/lib/interaction-gifs');
const { findCommand } = require('../src/commands');

test('nuevas interacciones son descubribles y mantienen opciones slash válidas', () => {
  const names = ['wink', 'smile', 'tickle', 'punch', 'happy', 'sleep', 'stare', 'scared'];
  for (const name of names) {
    assert.equal(findCommand(name), act);
    assert.match(gifs.FALLBACK_GIFS[gifs.ACTIONS[name].gif][0], /^https:\/\/cdn\.otakugifs\.xyz\/gifs\//);
  }
  const slash = act.slash.setup(new SlashCommandBuilder().setName('act').setDescription('acción')).toJSON();
  assert.ok(slash.options[0].choices.length <= 25);
  for (const name of names) assert.ok(slash.options[0].choices.some(choice => choice.value === name));
  assert.equal(findCommand('cosquillas'), act);
});

test('una interacción menciona solo con texto, usa GIF correcto y rechaza bots', async () => {
  const user = { id: '1', username: 'Ana', bot: false }, target = { id: '2', username: 'Luis', bot: false };
  let result;
  await act.execute({ invokedName: 'tickle', args: [], target, user, isSlash: false,
    reply: async payload => { result = payload; }, fail: async () => assert.fail('No debía fallar') });
  const embed = result.embeds[0].toJSON();
  assert.match(embed.description, /Ana.*cosquillas.*Luis/);
  assert.match(embed.image.url, /\/tickle\//);
  assert.deepEqual(result.allowedMentions, { parse: [] });
  let failed = '';
  await act.execute({ invokedName: 'wink', args: [], target: { ...target, bot: true }, user, isSlash: false,
    reply: async () => assert.fail('No debía enviar interacción'), fail: async message => { failed = message; } });
  assert.match(failed, /solo para personas/i);
});
