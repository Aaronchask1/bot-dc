const test = require('node:test');
const assert = require('node:assert/strict');
const { SlashCommandBuilder } = require('discord.js');
const calc = require('../src/commands/calc');
const timestamp = require('../src/commands/timestamp');
const color = require('../src/commands/color');
const userinfo = require('../src/commands/userinfo');
const { findCommand } = require('../src/commands');

test('calculadora respeta precedencia, signos y paréntesis sin ejecutar código', () => {
  assert.equal(calc.calculate('(12 + 8) / 2'), 10);
  assert.equal(calc.calculate('-2 * (3 + .5)'), -7);
  for (const invalid of ['1/0', 'process.exit()', '2**4', '1 +', '9'.repeat(151), '1e300', '((2)']) assert.throws(() => calc.calculate(invalid));
});

test('fechas exigen zona horaria y validan calendario, hora y rangos', () => {
  assert.equal(timestamp.parseTimestamp('2030-01-01T18:00Z'), 1893520800);
  assert.equal(timestamp.parseTimestamp('2030-01-01T13:00-05:00'), 1893520800);
  assert.equal(timestamp.parseTimestamp('0'), 0);
  for (const value of ['2030-01-01T18:00', '2030-02-29T12:00Z', '2028-02-30T12:00Z', '2028-01-01T24:00Z', 'abc', '-1']) assert.throws(() => timestamp.parseTimestamp(value));
});

test('color acepta hex de seis dígitos y rechaza contenido arbitrario', () => {
  assert.equal(color.parseColor('#a47bFa'), 0xA47BFA);
  assert.equal(color.parseColor('000000'), 0);
  assert.throws(() => color.parseColor('red'));
  assert.throws(() => color.parseColor('#fff'));
  const random = color.parseColor(''); assert.ok(random >= 0 && random <= 0xffffff);
});

test('comandos son descubribles y definiciones slash válidas', () => {
  for (const command of [calc, timestamp, color, userinfo]) {
    assert.equal(findCommand(command.name), command);
    const builder = new SlashCommandBuilder().setName(command.name).setDescription(command.slash.description);
    command.slash.setup(builder);
    assert.equal(builder.toJSON().name, command.name);
  }
  assert.equal(findCommand('calcular'), calc);
  assert.equal(findCommand('usuario'), userinfo);
});

test('userinfo funciona en DM y desactiva menciones en la respuesta', async () => {
  let result;
  await userinfo.execute({ user: { id: '123', username: '@everyone', createdTimestamp: 1700000000000 }, guild: null, reply: value => { result = value; } });
  assert.deepEqual(result.allowedMentions, { parse: [] });
  assert.equal(result.embeds[0].toJSON().fields[0].value, '123');
});
