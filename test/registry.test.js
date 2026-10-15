const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

process.env.XYB_DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'xyb-registry-'));

const { SlashCommandBuilder } = require('discord.js');
const { listCommands, findCommand } = require('../src/commands');

const EXISTING = ['help', 'kiss', 'server', 'kick', 'ban', 'unban', 'mute', 'unmute', 'lock', 'unlock', 'purge', 'pg'];

test('cada comando tiene nombre, descripción y uso', () => {
  for (const command of listCommands()) {
    assert.equal(typeof command.name, 'string', 'nombre');
    assert.ok(command.description?.length, `${command.name}: descripción`);
    assert.ok(command.usage?.startsWith('xyb'), `${command.name}: uso`);
    assert.equal(typeof command.execute, 'function', `${command.name}: execute`);
  }
});

test('no se repiten nombres ni alias con comandos que ya existían', () => {
  // `purge`, `c`, `pg` y `apg` sí existen en index.js, pero el comando nuevo
  // solo atiende la forma "bots" y deja el resto al original.
  const conMismoNombre = new Set(['purge', 'c', 'pg', 'apg', 'unban', 'sacarban']);
  for (const command of listCommands()) {
    const pisa = EXISTING.includes(command.name);
    if (pisa) assert.equal(conMismoNombre.has(command.name), true, `${command.name} pisa un comando existente`);
    for (const alias of command.aliases ?? []) {
      if (EXISTING.includes(alias)) {
        assert.equal(conMismoNombre.has(alias), true, `el alias ${alias} pisa un comando existente`);
      }
    }
  }
});

test('todo comando que repite un nombre existente declara cuándo interviene', () => {
  for (const command of listCommands()) {
    if (EXISTING.includes(command.name) || (command.aliases ?? []).some((alias) => EXISTING.includes(alias))) {
      assert.equal(typeof command.match, 'function', `${command.name}: falta el match()`);
    }
  }
});

test('los alias resuelven al comando correcto', () => {
  assert.equal(findCommand('pfp').name, 'avatar');
  assert.equal(findCommand('AVATAR').name, 'avatar');
  assert.equal(findCommand('ms').name, 'ping');
  assert.equal(findCommand('s').name, 'snipe');
  assert.equal(findCommand('noexiste'), null);
});

test('todos los comandos slash se construyen sin errores', () => {
  for (const command of listCommands()) {
    if (!command.slash) continue;
    const builder = new SlashCommandBuilder().setName(command.name).setDescription(command.slash.description);
    if (command.permissions?.length) builder.setDefaultMemberPermissions(command.permissions[0]);
    if (command.slash.setup) command.slash.setup(builder);
    const json = builder.toJSON();
    assert.equal(json.name, command.name);
    assert.ok(json.description.length <= 100, `${command.name}: descripción demasiado larga`);
    if (command.permissions?.length) {
      assert.equal(json.default_member_permissions, String(command.permissions[0]), `${command.name}: permisos slash`);
    }
  }
});

test('el registro carga todos los comandos esperados', () => {
  const names = listCommands().map((command) => command.name).sort();
  for (const expected of ['avatar', 'banner', 'ping', 'botinfo', 'prefix', 'snipe', 'welcome', 'welcomevars', 'welcometest', 'steal']) {
    assert.ok(names.includes(expected), `falta ${expected}`);
  }
});
