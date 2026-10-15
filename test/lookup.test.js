const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { MessageFlags } = require('discord.js');

process.env.XYB_DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'xyb-lookup-'));
const history = require('../src/lib/username-lookup');
const lookup = require('../src/commands/lookup');
const GUILD = '1494581763899396136';
const OWNER = '961823716273176698';
const id = (number) => String(700000000000000000n + BigInt(number));
const user = (number, username, extra = {}) => ({ id: id(number), username, discriminator: '0', ...extra });
const packet = (type, data) => history.handlePacket({ t: type, d: data });
const textOf = (payload) => JSON.stringify(payload.components.map((component) => component.toJSON()));

function interaction(session, action, fields, userId = OWNER) {
  const replies = [];
  const updates = [];
  const modals = [];
  return {
    customId: `lookup:${session.token}:${action}`,
    guildId: session.guildId,
    user: { id: userId },
    isButton: () => !fields,
    isModalSubmit: () => Boolean(fields),
    fields: { getTextInputValue: (key) => fields[key] ?? '' },
    reply: async (payload) => { replies.push(payload); },
    update: async (payload) => { updates.push(payload); },
    showModal: async (payload) => { modals.push(payload); },
    replies, updates, modals,
  };
}

test('solo detecta cambios de username, no primeras visitas, apodos ni bots', () => {
  const guild = id(100);
  packet('GUILD_CREATE', { id: guild, members: [{ user: user(1, 'abcd') }] });
  packet('GUILD_MEMBER_UPDATE', { guild_id: guild, user: user(1, 'abcd'), nick: 'otro apodo' });
  history.observe(guild, user(2, 'robot', { bot: true }));
  history.observe(guild, user(2, 'robot2', { bot: true }));
  history.observe(guild, user(3, 'legacy', { discriminator: '1234' }));
  history.observe(guild, user(3, 'nuevo'));
  assert.equal(history.search(guild).total, 0);
  packet('GUILD_MEMBER_UPDATE', { guild_id: guild, user: user(1, 'abcde') });
  packet('GUILD_MEMBER_UPDATE', { guild_id: guild, user: user(1, 'abcde') });
  assert.deepEqual(history.search(guild).entries.map((entry) => entry.username), ['abcd']);
  assert.equal(history.search(id(101)).total, 0, 'los nombres se consultan dentro del servidor');
});

test('salir del servidor no libera un username; los nombres reutilizados se retiran', () => {
  const guild = id(102);
  history.observe(guild, user(5, 'libre'));
  packet('GUILD_MEMBER_REMOVE', { guild_id: guild, user: user(5, 'libre') });
  assert.equal(history.search(guild).total, 0);
  history.observe(guild, user(6, 'libre'));
  history.observe(guild, user(6, 'actual'));
  assert.equal(history.search(guild).total, 1);
  packet('MESSAGE_CREATE', { guild_id: guild, author: user(7, 'libre') });
  assert.equal(history.search(guild).total, 0);
});

test('los webhooks no contaminan los nombres y usa la fecha de detección', () => {
  const guild = id(103);
  packet('MESSAGE_CREATE', { guild_id: guild, webhook_id: id(500), author: user(8, 'falso') });
  history.observe(guild, user(8, 'actual'), 1000);
  assert.equal(history.search(guild).total, 0);
  history.observe(guild, user(8, 'siguiente'), 2000);
  assert.equal(history.search(guild).entries[0].detectedAt, 2000);
});

test('vanities: primera visita, cambio, reutilización y salida del bot', () => {
  const guild = id(104);
  packet('GUILD_CREATE', { id: guild, vanity_url_code: 'casa' });
  assert.equal(history.search(guild, { type: 'vanities' }).total, 0);
  packet('GUILD_UPDATE', { id: guild, name: 'cambio de nombre' });
  assert.equal(history.search(guild, { type: 'vanities' }).total, 0);
  packet('GUILD_UPDATE', { id: guild, vanity_url_code: 'nuevo' });
  assert.deepEqual(history.search(guild, { type: 'vanities' }).entries.map((v) => v.username), ['casa']);
  packet('GUILD_CREATE', { id: id(105), vanity_url_code: 'casa' });
  assert.equal(history.search(guild, { type: 'vanities' }).total, 0);
  packet('GUILD_DELETE', { id: id(105), unavailable: false });
  assert.equal(history.search(guild, { type: 'vanities' }).total, 0);
  packet('GUILD_UPDATE', { id: guild, vanity_url_code: null });
  assert.deepEqual(history.search(guild, { type: 'vanities' }).entries.map((v) => v.username), ['nuevo']);
});

test('lookup admite 3, 4, 5 y 6 caracteres, texto y vanities; rechaza filtros inválidos', () => {
  for (const length of [2, 3, 4, 5, 6, 32]) {
    assert.equal(lookup.__test.parseArgs([String(length)]).length, length);
    assert.equal(lookup.__test.parseArgs(['vanity', String(length)]).type, 'vanities');
  }
  for (const args of [['0'], ['1'], ['33'], ['3', '<@123>'], ['3', 'dos', 'palabras']]) {
    assert.ok(lookup.__test.parseArgs(args).error);
  }
  assert.equal(lookup.__test.parseArgs(['4', 'Ab']).query, 'ab');
});

test('paginación, filtros y nombres especiales no rompen el almacén', () => {
  const guild = id(106);
  for (const [index, name] of ['abc', 'abcd', 'abcde', 'abcdef', '1234', 'a_bc', '__proto__', 'constructor'].entries()) {
    history.observe(guild, user(50 + index, name), 1000 + index);
    history.observe(guild, user(50 + index, `actual${index}`), 2000 + index);
  }
  for (const length of [3, 4, 5, 6]) {
    assert.ok(history.search(guild, { length }).entries.every((item) => item.username.length === length));
  }
  assert.deepEqual(history.search(guild, { mode: 'numeros' }).entries.map((v) => v.username), ['1234']);
  assert.equal(history.search(guild, { mode: 'letras', query: 'abc' }).total, 4);
  assert.equal(history.search(guild, { pageSize: 3, page: 99 }).page, 2);
  assert.equal(history.search(guild, { pageSize: 3, page: -1 }).page, 0);
});

test('panel vacío honesto, botones válidos, avatar y modales construibles', () => {
  const session = lookup.__test.createSession({ id: OWNER }, id(107), lookup.__test.parseArgs(['3']));
  const payload = lookup.__test.panel(session);
  assert.equal(payload.flags, MessageFlags.IsComponentsV2);
  assert.match(textOf(payload), /Todavía no he detectado/);
  const container = payload.components[0].toJSON();
  assert.equal(container.type, 17);
  assert.equal(container.components[0].accessory.type, 11);
  assert.equal(container.components.at(-1).components.length, 5);
  assert.equal(container.components.at(-1).components[0].disabled, true);
  assert.equal(container.components.at(-1).components[1].disabled, true);
  assert.equal(lookup.__test.modal(session, 'search').toJSON().components.length, 1);
  assert.equal(lookup.__test.modal(session, 'filter').toJSON().components.length, 3);
});

test('botones: autorización, búsqueda, filtros, cierre y panel caducado', async () => {
  const session = lookup.__test.createSession({ id: OWNER }, id(106), lookup.__test.parseArgs([]));
  const unauthorized = interaction(session, 'next', null, id(99));
  await lookup.handleComponent(unauthorized);
  assert.equal(unauthorized.replies[0].flags, MessageFlags.Ephemeral);
  assert.equal(unauthorized.updates.length, 0);
  const searchButton = interaction(session, 'search');
  await lookup.handleComponent(searchButton);
  assert.equal(searchButton.modals.length, 1);
  const searchSubmit = interaction(session, 'search-submit', { query: 'abc' });
  await lookup.handleComponent(searchSubmit);
  assert.equal(session.query, 'abc');
  assert.match(textOf(searchSubmit.updates[0]), /4 resultados/);
  const badFilter = interaction(session, 'filter-submit', { type: 'nombres', length: '999', mode: 'todos' });
  await lookup.handleComponent(badFilter);
  assert.equal(badFilter.updates.length, 0);
  const filter = interaction(session, 'filter-submit', { type: 'vanities', length: '5', mode: 'letras' });
  await lookup.handleComponent(filter);
  assert.equal(session.type, 'vanities');
  assert.equal(session.length, 5);
  const close = interaction(session, 'close');
  await lookup.handleComponent(close);
  assert.ok(close.updates[0].components[0].toJSON().components.at(-1).components.every((b) => b.disabled));
  const expired = interaction(session, 'next');
  await lookup.handleComponent(expired);
  assert.match(expired.replies[0].content, /terminó/);
});

test('slash permite buscar números sin confundirlos con la longitud', async () => {
  const replies = [];
  await lookup.execute({
    isSlash: true,
    interaction: { options: { getString: (key) => key === 'texto' ? '1234' : null, getInteger: () => null } },
    user: { id: OWNER }, guild: { id: id(106) }, reply: async (payload) => replies.push(payload),
    fail: (error) => assert.fail(error),
  });
  assert.match(textOf(replies[0]), /1 resultados/);
});

test('los nombres sobreviven a reinicios en un almacén aislado', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'xyb-lookup-persist-'));
  const options = { cwd: path.join(__dirname, '..'), env: { ...process.env, XYB_DATA_DIR: directory }, encoding: 'utf8' };
  execFileSync(process.execPath, ['-e', `const h=require('./src/lib/username-lookup'); h.observe('${GUILD}',{id:'${OWNER}',username:'antes'}); h.observe('${GUILD}',{id:'${OWNER}',username:'ahora'});`], options);
  const saved = execFileSync(process.execPath, ['-e', `console.log(JSON.stringify(require('./src/lib/username-lookup').search('${GUILD}')));`], options);
  assert.equal(JSON.parse(saved).entries[0].username, 'antes');
});

test('10 000 primeras observaciones no crean nombres abandonados', () => {
  const guild = id(108);
  for (let index = 0; index < 10_000; index += 1) history.observe(guild, user(1000 + index, `persona${index}`));
  assert.equal(history.search(guild).total, 0);
  history.observe(guild, user(1000, 'cambio_real'));
  assert.deepEqual(history.search(guild).entries.map((v) => v.username), ['persona0']);
});

test('.lookup conserva los argumentos y no convierte otros comandos con punto', () => {
  const { normalizeCustomPrefix } = require('../src/index');
  const message = { content: '.lookup vanity 6', guild: { id: GUILD } };
  assert.equal(normalizeCustomPrefix(message), true);
  assert.equal(message.content, 'xyb lookup vanity 6');
  assert.equal(normalizeCustomPrefix({ content: '.lookupmal 3', guild: { id: GUILD } }), false);
});

test('lookup no hace una búsqueda remota de miembros para interpretar el filtro', async () => {
  const { handlePrefixCommand } = require('../src/commands');
  const replies = [];
  await handlePrefixCommand({
    content: 'xyb lookup 4', author: { id: OWNER },
    guild: { id: GUILD, members: { fetch: () => assert.fail('no debe buscar miembros') } },
    mentions: { users: { first: () => null } }, reply: async (payload) => replies.push(payload),
  });
  assert.equal(replies.length, 1);
  assert.match(textOf(replies[0]), /4 caracteres/);
});
