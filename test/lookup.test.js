const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
process.env.XYB_DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'xyb-global-lookup-'));
const lib = require('../src/lib/username-lookup');
const lookup = require('../src/commands/lookup');
const { MessageFlags } = require('discord.js');
const filters = { type: 'usernames', length: 3, mode: 'todos', query: '' };
const response = (status, data) => ({ status, json: async () => data, headers: { get: () => null } });
function harness(responses = [], shared) {
  let clock = 1_000_000;
  const values = shared ?? {};
  const calls = [];
  const store = { get: (key) => values[key], set: (key, value) => { values[key] = value; } };
  const service = lib.createLookupService({ store, now: () => clock, sleep: async (ms) => { clock += ms; },
    fetchImpl: async (...args) => { calls.push({ args, time: clock }); return responses.shift() ?? response(200, { taken: false }); },
  });
  return { service, calls, values, advance: (ms) => { clock += ms; } };
}
const check = (service, name, type = 'usernames') => service.discover({ ...filters, type }, { exactName: name });
const makeSession = () => lookup.__test.createSession({ id: 'owner' }, 'guild', { ...filters });
const textOf = (payload) => JSON.stringify(payload.components.map((component) => component.toJSON()));

test('interpreta longitudes, todos, texto y comprobación exacta', () => {
  for (const size of [2, 3, 4, 5, 6, 32]) assert.equal(lookup.__test.parseArgs([String(size)]).length, size);
  assert.equal(lookup.__test.parseArgs([]).length, 3);
  assert.equal(lookup.__test.parseArgs(['todos']).length, null);
  assert.equal(lookup.__test.parseArgs(['vanity', 'check', 'abc']).exactName, 'abc');
  assert.equal(lookup.__test.parseArgs(['4', 'AB']).query, 'ab');
  for (const args of [['1'], ['33'], ['3', 'long'], ['3', 'a-b'], ['check', 'a..b'], ['add', '<@123>', 'mecos']]) {
    assert.ok(lookup.__test.parseArgs(args).error, JSON.stringify(args));
  }
});

test('genera candidatos válidos para todas las longitudes y caracteres', () => {
  for (const type of ['usernames', 'vanities']) for (const mode of lib.MODES) {
    for (const length of [2, 3, 4, 5, 6, 32, null]) for (let n = 0; n < 30; n++) {
      const name = lib.candidate({ type, mode, length });
      if (name === null) continue;
      assert.ok(lib.validName(type, name));
      if (length) assert.equal(name.length, length);
      assert.ok([...name].every((char) => lib.alphabet(type, mode).includes(char)));
    }
  }
  assert.equal(lib.candidate({ length: 3, query: 'long' }), null);
  assert.equal(lib.candidate({ length: 3, mode: 'numeros', query: 'ab' }), null);
  assert.ok(lib.candidate({ length: 6, query: 'ab' }).includes('ab'));
});

test('consulta global anónima, ocupados/libres e intervalo', async () => {
  const h = harness([response(200, { taken: true }), response(200, { taken: false })]);
  assert.equal((await check(h.service, 'abc')).last.status, 'taken');
  assert.equal((await check(h.service, 'xyz')).last.status, 'available');
  assert.equal(h.calls[1].time - h.calls[0].time, 6000);
  const options = h.calls[0].args[1];
  assert.equal(JSON.parse(options.body).username, 'abc');
  assert.equal(options.headers.Authorization, undefined);
  assert.equal(options.headers.Cookie, undefined);
  assert.deepEqual(h.service.search(filters).entries.map((entry) => entry.username), ['xyz']);
});

test('usa RapidAPI cuando hay clave configurada y normaliza su respuesta', async () => {
  const previousKey = process.env.RAPIDAPI_KEY;
  process.env.RAPIDAPI_KEY = 'test-key';
  const values = {};
  const calls = [];
  const service = lib.createLookupService({
    store: { get: (key) => values[key], set: (key, value) => { values[key] = value; } },
    now: () => 1_000_000,
    fetchImpl: async (url, options) => {
      calls.push({ url, options });
      return response(200, { username: 'abc', taken: false, available: true });
    },
  });
  try {
    const result = await service.discover(filters, { exactName: 'abc' });
    assert.equal(result.status, 'complete');
    assert.equal(result.last.status, 'available');
    assert.match(calls[0].url, /check_username\/abc$/);
    assert.equal(calls[0].options.headers['x-rapidapi-host'], lib.RAPIDAPI_HOST);
    assert.equal(calls[0].options.headers['x-rapidapi-key'], 'test-key');
  } finally {
    if (previousKey === undefined) delete process.env.RAPIDAPI_KEY;
    else process.env.RAPIDAPI_KEY = previousKey;
  }
});

test('caché reutilizable y caducidad de resultados', async () => {
  const h = harness();
  await check(h.service, 'abc');
  assert.equal((await check(h.service, 'abc')).last.cached, true);
  assert.equal(h.calls.length, 1);
  assert.equal(harness([], h.values).service.search(filters).total, 1);
  h.advance(16 * 60_000);
  assert.equal(h.service.search(filters).total, 0);
  await check(h.service, 'abc');
  assert.equal(h.calls.length, 2);
});

test('429 detiene la tanda y mantiene el bloqueo', async () => {
  const h = harness([response(429, { retry_after: 120 })]);
  const result = await h.service.discover(filters);
  assert.equal(result.status, 'limited');
  assert.equal(result.checked, 0);
  assert.equal((await check(h.service, 'abc')).status, 'limited');
  assert.equal(h.calls.length, 1);
  h.advance(120_001);
  assert.equal((await check(h.service, 'abc')).status, 'complete');
});

test('restricciones, CAPTCHA y respuestas desconocidas nunca producen libres', async () => {
  for (const reply of [response(403, {}), response(400, { captcha_key: ['required'] }), response(200, {}), response(500, {})]) {
    const h = harness([reply]);
    assert.ok(['restricted', 'unavailable'].includes((await check(h.service, 'abc')).status));
    assert.equal(h.service.search(filters).total, 0);
  }
});

test('vanity sin invitación no equivale a disponibilidad garantizada', async () => {
  const h = harness([response(200, { code: 'abc' }), response(404, { code: 10006 }), response(404, { code: 999 })]);
  assert.equal((await check(h.service, 'abc', 'vanities')).last.status, 'taken');
  assert.equal((await check(h.service, 'xyz', 'vanities')).last.status, 'unlinked');
  assert.equal((await check(h.service, 'def', 'vanities')).status, 'unavailable');
  assert.equal(h.service.search({ ...filters, type: 'vanities' }).total, 1);
  assert.match(textOf(lookup.__test.panel({ ...makeSession(), type: 'vanities' })), /NO garantiza/);
});

test('una búsqueda a la vez, cancelación y límite de doce candidatos', async () => {
  const h = harness();
  let stopped = false;
  const result = await h.service.discover(filters, { shouldStop: () => stopped, onProgress: async () => {
    assert.equal((await check(h.service, 'abc')).status, 'busy');
    stopped = true;
  } });
  assert.equal(result.status, 'cancelled');
  assert.equal(h.calls.length, 1);
  assert.equal((await h.service.discover(filters, { limit: 1000 })).checked, 12);
});

test('panel V2: cinco botones válidos, avatar y modales', () => {
  const session = makeSession();
  const payload = lookup.__test.panel(session);
  assert.equal(payload.flags, MessageFlags.IsComponentsV2);
  const components = payload.components[0].toJSON().components;
  assert.equal(components[0].accessory.type, 11);
  assert.equal(components.at(-1).components.length, 5);
  assert.match(textOf(payload), /comprobadas/);
  assert.doesNotMatch(textOf(payload), /Dropped|abandonado/);
  assert.equal(lookup.__test.modal(session, 'search').toJSON().components.length, 1);
  assert.equal(lookup.__test.modal(session, 'filter').toJSON().components.length, 3);
});

test('progreso y resultado exacto se editan en el mismo panel', async () => {
  const h = harness([response(200, { taken: true })]);
  const session = { ...makeSession(), exactName: 'abc' };
  const edits = [];
  await lookup.__test.runSearch(session, async (payload) => edits.push(textOf(payload)), h.service);
  assert.equal(session.running, false);
  assert.match(edits.at(-1), /Ocupado/);
  assert.ok(edits.length >= 2);
});

test('botones restringidos al autor y cierre cancela consultas', async () => {
  const session = makeSession();
  const replies = [], edits = [];
  const interaction = { customId: `lookup:${session.token}:close`, user: { id: 'otro' }, guildId: 'guild',
    isButton: () => true, reply: async (payload) => replies.push(payload),
    deferUpdate: async () => {}, editReply: async (payload) => edits.push(payload) };
  await lookup.handleComponent(interaction);
  assert.equal(replies[0].flags, MessageFlags.Ephemeral);
  assert.equal(edits.length, 0);
  interaction.user.id = 'owner';
  await lookup.handleComponent(interaction);
  assert.equal(session.cancelled, true);
  assert.ok(edits[0].components[0].toJSON().components.at(-1).components.every((button) => button.disabled));
  await lookup.handleComponent(interaction);
  assert.match(replies.at(-1).content, /terminó/);
});

test('prefijo .lookup y omisión de búsqueda remota de miembros', () => {
  const { normalizeCustomPrefix } = require('../src/index');
  const message = { content: '.lookup vanity 6', guild: { id: 'guild' } };
  assert.equal(normalizeCustomPrefix(message), true);
  assert.equal(message.content, 'xyb lookup vanity 6');
  assert.equal(lookup.resolveMember, false);
});

test('ejecución prefijo y slash responde una sola vez y edita', async () => {
  const original = lib.discover;
  lib.discover = async () => ({ status: 'complete', checked: 0, found: 0 });
  try {
    for (const isSlash of [false, true]) {
      const replies = [], edits = [];
      await lookup.execute({ args: ['4'], isSlash, user: { id: 'owner' }, guild: { id: 'guild' },
        interaction: { options: { getString: (key) => key === 'texto' ? '1234' : null, getInteger: () => null }, editReply: async (payload) => edits.push(payload) },
        reply: async (payload) => { replies.push(payload); return { edit: async (edited) => edits.push(edited) }; },
        fail: (error) => assert.fail(error),
      });
      assert.equal(replies.length, 1);
      assert.equal(edits.length, 2);
      assert.match(textOf(replies[0]), /4 caracteres/);
    }
  } finally { lib.discover = original; }
});
