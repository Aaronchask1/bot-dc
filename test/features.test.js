const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

process.env.XYB_DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'xyb-store-'));

const prefixes = require('../src/lib/prefixes');
const welcome = require('../src/lib/welcome');
const steal = require('../src/commands/steal');

test('los prefijos empiezan con xyb y !', () => {
  assert.deepEqual(prefixes.getPrefixes('1'), ['xyb', '!']);
  assert.deepEqual(prefixes.getPrefixes(undefined), ['xyb', '!']);
});

test('se agregan prefijos y nunca se quita xyb ni !', () => {
  const guild = `g-${Date.now()}`;
  assert.equal(prefixes.addPrefix(guild, '?').ok, true);
  assert.equal(prefixes.addPrefix(guild, '.').ok, true);
  assert.deepEqual(prefixes.getPrefixes(guild), ['?', '.', 'xyb', '!']);

  const removal = prefixes.removePrefix(guild, 'xyb');
  assert.equal(removal.ok, false);
  assert.equal(prefixes.removePrefix(guild, '!').ok, false);
  assert.deepEqual(prefixes.getPrefixes(guild), ['?', '.', 'xyb', '!']);

  assert.equal(prefixes.removePrefix(guild, '?').ok, true);
  assert.deepEqual(prefixes.getPrefixes(guild), ['.', 'xyb', '!']);
});

test('agregar un prefijo de fábrica no se rompe', () => {
  const guild = `g0-${Date.now()}`;
  assert.equal(prefixes.addPrefix(guild, '!').ok, false);
  assert.equal(prefixes.addPrefix(guild, 'xyb').ok, false);
});

test('se rechazan prefijos con espacios, vacíos o demasiado largos', () => {
  const guild = `g2-${Date.now()}`;
  for (const bad of ['', '   ', 'muy largo', 'con espacio', '123456']) {
    assert.equal(prefixes.addPrefix(guild, bad).ok, false, `debería rechazar: "${bad}"`);
  }
  assert.equal(prefixes.addPrefix(guild, '!@#$%').ok, true, 'cinco caracteres caben');
});

test('hay un máximo de prefijos activos', () => {
  const guild = `g3-${Date.now()}`;
  for (const prefix of ['!', '?', '.', ',']) prefixes.addPrefix(guild, prefix);
  const result = prefixes.addPrefix(guild, ';');
  assert.equal(result.ok, false);
  assert.equal(prefixes.getPrefixes(guild).length, prefixes.MAX_PREFIXES);
});

test('set reemplaza todo pero conserva los de fábrica', () => {
  const guild = `g4-${Date.now()}`;
  prefixes.setPrefixes(guild, ['?', '.']);
  assert.deepEqual(prefixes.getPrefixes(guild), ['?', '.', 'xyb', '!']);
  prefixes.setPrefixes(guild, [',']);
  assert.deepEqual(prefixes.getPrefixes(guild), [',', 'xyb', '!']);
});

test('las duraciones se leen como las del otro bot: con "y" antes de la última', () => {
  const { formatDuration } = require('../src/tenure');
  assert.equal(formatDuration({ years: 0, months: 2, days: 21, hours: 2 }), '2 meses, 21 días y 2 horas');
  assert.equal(formatDuration({ years: 1, months: 0, days: 0, hours: 0 }), '1 año');
  assert.equal(formatDuration({ years: 0, months: 0, days: 8, hours: 22 }), '8 días y 22 horas');
});

test('la bienvenida sustituye todas las variables', () => {
  const member = {
    id: '123',
    user: { username: 'akira', tag: 'akira#0001' },
    guild: { name: 'Servidor', memberCount: 42 },
  };
  const text = '{{user}} {{username}} {{tag}} {{id}} {{server}} {{members}} {{count}}';
  assert.equal(
    welcome.render(text, member),
    '<@123> akira akira#0001 123 Servidor 42 42',
  );
});

test('la configuración de bienvenida se guarda y se recupera', () => {
  const guild = `w-${Date.now()}`;
  const before = welcome.getConfig(guild);
  assert.equal(before.message.includes('{{user}}'), true);
  assert.equal(before.embed, true);

  welcome.setConfig(guild, { channel: '999', thumbnail: true, color: '#ff0000' });
  const after = welcome.getConfig(guild);
  assert.equal(after.channel, '999');
  assert.equal(after.thumbnail, true);
  assert.equal(after.color, '#ff0000');
  assert.equal(after.message, before.message, 'lo que no se toca se conserva');
});

test('steal reconoce emojis de Discord y URLs de sticker', () => {
  const parsed = steal.__test.parseEmoji('mira esto <:kissu:123456789012345678> 😘');
  assert.equal(parsed.url, 'https://cdn.discordapp.com/emojis/123456789012345678.png?size=320');
  assert.equal(parsed.name, 'kissu');
  assert.equal(steal.__test.parseEmoji('sin emoji aquí'), null);
  assert.equal(steal.__test.isAllowed('https://x.com/a.png'), true);
  assert.equal(steal.__test.isAllowed('https://x.com/a.apng?ex=1'), true);
  assert.equal(steal.__test.isAllowed('https://x.com/a.gif'), false);
  assert.equal(steal.__test.cleanName('Mi Sticker!'), 'Mi_Sticker_');
});