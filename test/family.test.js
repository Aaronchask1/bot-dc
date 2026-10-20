const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

process.env.XYB_DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'xyb-family-'));
process.env.XYB_GIFS_OFFLINE = '1';

const marriage = require('../src/lib/marriage');
const { findCommand, listCommands } = require('../src/commands');

const GUILD = `g-${Date.now()}`;

test('casarse guarda la pareja y los dos la ven igual', () => {
  const a = 'u1';
  const b = 'u2';
  const result = marriage.marry(GUILD, a, b, a);
  assert.equal(result.ok, true);
  assert.equal(marriage.getPartner(GUILD, a).id, b);
  assert.equal(marriage.getPartner(GUILD, b).id, a, 'da igual en qué orden se guarde');
});

test('no se puede casar dos veces sin divorciarse', () => {
  const a = 'u3';
  const b = 'u4';
  const c = 'u5';
  assert.equal(marriage.marry(GUILD, a, b, a).ok, true);

  const otro = marriage.marry(GUILD, a, c, a);
  assert.equal(otro.ok, false);
  assert.equal(otro.reason, 'ya_estaba_casado');
  assert.equal(marriage.getPartner(GUILD, a).id, b, 'sigue con el de antes');

  assert.equal(marriage.marry(GUILD, c, b, c).ok, false, 'la otra persona tampoco');
});

test('el divorcio libera a los dos', () => {
  const a = 'u6';
  const b = 'u7';
  marriage.marry(GUILD, a, b, a);
  const roto = marriage.divorce(GUILD, a);
  assert.equal(roto.ok, true);
  assert.equal(roto.partner, b);
  assert.equal(marriage.getPartner(GUILD, a), null);
  assert.equal(marriage.getPartner(GUILD, b), null, 'quedan libres los dos');
  assert.equal(marriage.divorce(GUILD, a).ok, false, 'ya no está casado');
});

test('después del divorcio se puede volver a casar', () => {
  const a = 'u8';
  const b = 'u9';
  const c = 'u10';
  marriage.marry(GUILD, a, b, a);
  marriage.divorce(GUILD, a);
  assert.equal(marriage.marry(GUILD, a, c, a).ok, true);
  assert.equal(marriage.getPartner(GUILD, a).id, c);
});

test('los matrimonios no se mezclan entre servidores', () => {
  const otroGuild = `otro-${Date.now()}`;
  const a = 'u11';
  const b = 'u12';
  marriage.marry(otroGuild, a, b, a);
  assert.equal(marriage.getPartner(GUILD, a), null, 'en el otro servidor sigue soltero');
  assert.equal(marriage.getPartner(otroGuild, a).id, b);
});

test('members cuenta las dos personas de cada matrimonio', () => {
  const guild = `miembros-${Date.now()}`;
  marriage.marry(guild, 'u20', 'u21', 'u20');
  marriage.marry(guild, 'u22', 'u23', 'u22');
  assert.equal(marriage.members(guild), 4);
});

test('los comandos nuevos están registrados con lo que pediste', () => {
  for (const nombre of ['rol', 'hug', 'marry', 'wife', 'divorce']) {
    assert.equal(findCommand(nombre).name, nombre, `falta ${nombre}`);
  }
  assert.equal(findCommand('abrazo').name, 'hug');
  assert.equal(findCommand('esposa').name, 'wife');
  assert.equal(findCommand('role').name, 'rol');
  // Los que ya teníamos viven en index.js, no en este registro.
  assert.equal(findCommand('kiss'), null, 'kiss sigue en index.js');
  assert.equal(findCommand('mute'), null, 'mute sigue en index.js');
});

test('las interacciones nuevas viven en act y tienen alias', () => {
  for (const nombre of ['slap', 'hi', 'highfive', 'pat', 'cuddle', 'poke', 'wave', 'dance', 'bonk', 'bite', 'lick', 'handhold', 'feed', 'heal', 'blush', 'cry', 'laugh']) {
    assert.equal(findCommand(nombre)?.name, 'act', `falta ${nombre}`);
  }
  assert.equal(findCommand('hola').name, 'act');
  assert.equal(findCommand('cachetada').name, 'act');
});

test('act busca a la persona después del nombre de la acción', () => {
  const act = findCommand('act');
  assert.equal(act.targetArgs(['slap', 'csr'], 'act'), 'csr');
  assert.equal(act.targetArgs(['csr'], 'slap'), 'csr');
  assert.equal(act.targetArgs(['hi'], 'act'), '');
});

test('los abrazos usan GIFs de anime', () => {
  const { HUG_IMAGES } = require('../src/lib/hugs');
  assert.ok(HUG_IMAGES.length >= 3);
  for (const url of HUG_IMAGES) {
    assert.ok(url.startsWith('https://'), url);
    assert.match(url, /\.gif($|\?)/, url);
  }
  assert.equal(new Set(HUG_IMAGES).size, HUG_IMAGES.length, 'sin repetidas');
});

test('el matrimonio solo existe después de aceptar', () => {
  const props = require('../src/lib/marriage-props');
  for (const [nombre, lista] of Object.entries({
    propuesta: props.PROPOSE_IMAGES,
    acepto: props.ACCEPT_IMAGES,
    rechazo: props.REJECT_IMAGES,
  })) {
    assert.ok(lista.length >= 2, `${nombre}: pocas imágenes`);
    for (const url of lista) assert.ok(url.startsWith('https://'), url);
  }
  // La propuesta y el rechazo no pueden ser la misma imagen.
  assert.equal(
    props.PROPOSE_IMAGES.some((url) => props.REJECT_IMAGES.includes(url)),
    false,
  );
  const allImages = [
    ...require('../src/index').KISS_IMAGES,
    ...require('../src/index').KISS_GIFT_IMAGES,
    ...require('../src/index').KISS_REJECT_IMAGES,
    ...require('../src/lib/hugs').HUG_IMAGES,
    ...props.PROPOSE_IMAGES,
    ...props.ACCEPT_IMAGES,
    ...props.REJECT_IMAGES,
  ];
  assert.equal(new Set(allImages).size, allImages.length, 'cada acción usa imágenes exclusivas');
});

test('rol pide permiso de roles y el resto de la lista sigue viva', () => {
  const { PermissionFlagsBits } = require('discord.js');
  assert.equal(findCommand('rol').permissions[0], PermissionFlagsBits.ManageRoles);
  assert.ok(listCommands().length >= 15);
});
