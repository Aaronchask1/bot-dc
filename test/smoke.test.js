const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

process.env.XYB_DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'xyb-smoke-'));

const welcome = require('../src/lib/welcome');
const { helpCommands, helpText, KISS_IMAGES, KISS_GIFT_IMAGES, KISS_REJECT_IMAGES } = require('../src/index');
const { listCommands } = require('../src/commands');

// Esto no abre conexión: index.js solo arranca si se ejecuta directamente.
test('la ayuda se arma y sus categorías incluyen los comandos nuevos', () => {
  const text = helpText();
  assert.ok(text.includes('Elige una categoría'));
  const listed = helpCommands().map((command) => command.usage);
  for (const command of listCommands()) {
    assert.ok(listed.some((usage) => usage.includes(command.name)), `la ayuda no menciona ${command.name}`);
  }
  assert.ok(text.length <= 4096, `la ayuda quedó con ${text.length} caracteres (Discord corta a 4096)`);
});

test('el panel de bienvenida es válido para Discord', () => {
  const config = welcome.getConfig('smoke');
  const embed = welcome.panelEmbed(config).toJSON();
  assert.equal(embed.title, '👋 Panel de bienvenida');

  const rows = welcome.panelRows().map((row) => row.toJSON());
  assert.equal(rows.length, 3);
  for (const row of rows) {
    assert.ok(row.components.length <= 5, 'máximo 5 botones por fila');
    for (const button of row.components) {
      assert.ok(button.custom_id.startsWith('wlc:'));
      assert.equal(button.style !== undefined, true);
    }
  }
});

test('la bienvenida genera un embed válido con y sin embed', () => {
  const member = {
    id: '42',
    user: { username: 'akira', tag: 'akira#0001', displayAvatarURL: () => 'https://cdn.discordapp.com/embed/avatars/1.png' },
    guild: { name: 'Servidor', memberCount: 7 },
  };
  const withEmbed = welcome.buildPayload(member, {
    ...welcome.getConfig('smoke'),
    message: 'Bienvenido {{username}} a {{server}}',
  });
  assert.equal(withEmbed.embeds.length, 1);
  const json = withEmbed.embeds[0].toJSON();
  assert.equal(json.description, 'Bienvenido akira a Servidor');
  assert.ok(json.description.length <= 4096);

  const plain = welcome.buildPayload(member, { ...welcome.getConfig('smoke'), embed: false, mention: true });
  assert.equal(plain.embeds, undefined);
  assert.ok(plain.content.startsWith('<@42>'));

  const emptyPlain = welcome.buildPayload(member, { ...welcome.getConfig('smoke'), embed: false, mention: false, message: null });
  assert.equal(emptyPlain.content, '👋');
});

test('el beso adjunta la imagen y la muestra dentro del embed', () => {
  // El adjunto evita depender de que Discord pueda resolver una URL externa;
  // attachment:// la conserva debajo del texto dentro del embed.
  const { kissPayload } = require('../src/index');
  for (const mode of ['send', 'gift', 'reject']) {
    const payload = kissPayload('<@1>', '<@2>', 3, mode);
    assert.equal(payload.files.length, 1, `${mode}: debe adjuntar la imagen`);
    const embed = payload.embeds[0].toJSON();
    assert.match(embed.image?.url ?? '', /^attachment:\/\//, `${mode}: la imagen va dentro del embed`);
    assert.match(embed.description, /<@1>|<@2>/);
  }
});

test('las tres listas de imágenes de besos están llenas y sin repetir', () => {
  for (const [name, list] of Object.entries({ beso: KISS_IMAGES, regalo: KISS_GIFT_IMAGES, rechazo: KISS_REJECT_IMAGES })) {
    assert.ok(list.length >= 5, `${name} tiene muy pocas imágenes`);
    assert.equal(new Set(list).size, list.length, `${name} tiene repetidas`);
    for (const url of list) assert.ok(url.startsWith('https://'), `${name}: ${url}`);
  }
});

test('los besos usan imágenes grandes: Discord las dibuja a su tamaño real', () => {
  // No basta con que la URL exista: si mide 220 px se ve diminuta en el chat.
  // De Tenor solo se conserva el PNG grande; el resto del GIF de Tenor es de 220 px.
  const grandesPermitidos = ['https://media.tenor.com/bUDe38Y7hLMAAAAe/my-little-monster-anime.png'];
  const chicas = KISS_IMAGES.concat(KISS_GIFT_IMAGES)
    .filter((url) => /media\.tenor\.com/.test(url) && !grandesPermitidos.includes(url));
  assert.deepEqual(chicas, [], 'no debe quedar ningún GIF de 220 px de Tenor');
});

test('ninguna imagen de beso es un regalo de Papá Noel', () => {
  const todo = [...KISS_IMAGES, ...KISS_GIFT_IMAGES, ...KISS_REJECT_IMAGES].join(' ').toLowerCase();
  for (const prohibido of ['santa', 'christmas', 'present', 'gift']) {
    assert.equal(todo.includes(prohibido), false, `aparece "${prohibido}"`);
  }
});
