const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { execFileSync } = require('node:child_process');
process.env.XYB_DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'xyb-social-'));
const { createStore } = require('../src/store');
const { createKissService } = require('../src/lib/kisses');
const profiles = require('../src/lib/profiles');
const profile = require('../src/commands/profile');
const members = require('../src/lib/members');
const { prepareKissPayload } = require('../src/lib/kiss-media');

test('beso + respuesta + beso inverso + respuesta = 1, 2, 3, 4 compartidos', () => {
  const service = createKissService(createStore('pair-test'));
  assert.equal(service.add('g', 'a', 'b'), 1);
  assert.equal(service.add('g', 'b', 'a'), 2);
  assert.equal(service.add('g', 'b', 'a'), 3);
  assert.equal(service.add('g', 'a', 'b'), 4);
  assert.equal(service.get('g', 'a', 'b'), 4);
  assert.equal(service.get('g', 'b', 'a'), 4);
  assert.equal(service.get('other', 'a', 'b'), 0);
  assert.deepEqual(service.stats('g', 'b'), { total: 4, partners: 1 });
});

test('migra ambos sentidos una sola vez y persiste sin duplicar al reiniciar', () => {
  const store = createStore('migration-test');
  store.set('g:a:b', 7);
  store.set('g:b:a', 9);
  const service = createKissService(store);
  assert.equal(service.get('g', 'a', 'b'), 16);
  assert.equal(store.get('g:b:a'), undefined);
  assert.equal(service.add('g', 'b', 'a'), 17);
  store.flush();
  const result = execFileSync(process.execPath, ['-e', "const {createStore}=require('./src/store');const {createKissService}=require('./src/lib/kisses');console.log(createKissService(createStore('migration-test')).get('g','b','a'));"], {
    cwd: path.join(__dirname, '..'), env: process.env, encoding: 'utf8',
  });
  assert.equal(Number(result.trim()), 17);
});

test('responder dos veces al mismo mensaje no suma dos respuestas', () => {
  const service = createKissService(createStore('response-test'));
  assert.equal(service.claimResponse('message'), true);
  assert.equal(service.claimResponse('message'), false);
  assert.equal(createKissService(createStore('response-test')).claimResponse(null), false);
});

test('XP por servidor, cooldown y progresión exacta', () => {
  assert.equal(profiles.observe('xp', 'a', 1000).xp, 15);
  assert.equal(profiles.observe('xp', 'a', 2000).xp, 15);
  assert.equal(profiles.observe('xp', 'a', 61000).xp, 30);
  assert.equal(profiles.get('other', 'a').xp, 0);
  assert.deepEqual(profiles.progress(99), { level: 0, current: 99, needed: 100 });
  assert.deepEqual(profiles.progress(100), { level: 1, current: 0, needed: 300 });
  assert.deepEqual(profiles.progress(400), { level: 2, current: 0, needed: 500 });
  profiles.get('xp', 'b');
  assert.equal(profiles.rank('xp', 'a').position, 1);
  assert.equal(profiles.rank('xp', 'b').position, 2);
});

test('perfil real, selector válido y aislamiento de datos', () => {
  profiles.update('profile', 'a', { phrase: '**hola**', profession: 'Developer' });
  const payload = profile.panel({ id: 'profile' }, { id: 'a', username: 'user' });
  const embed = payload.embeds[0].toJSON();
  assert.match(embed.description, /Developer/);
  assert.match(embed.fields[0].value, /\\\*/);
  assert.match(embed.footer.text, /Registrado en XYB/);
  assert.equal(payload.components[0].toJSON().components[0].options.length, 3);
  assert.deepEqual(payload.allowedMentions, { parse: [] });
  assert.equal(profiles.get('other', 'a').phrase, '');
});

test('solo el titular puede modificar frase y profesión', async () => {
  const replies = [];
  await profile.handleComponent({ customId: 'profile:owner:save', guild: { id: 'g' }, user: { id: 'other' },
    isModalSubmit: () => true, reply: async (payload) => replies.push(payload),
  });
  assert.match(replies[0].content, /Solo puedes editar/);
});

test('no consulta miembros para texto vacío y usa REST para nombres', async () => {
  const guild = { members: { cache: new Map(), fetch: () => assert.fail('No debe usar gateway'),
    search: async ({ query }) => new Map([['id', { id: 'id', user: { username: query } }]]),
  } };
  assert.equal((await members.resolveMemberAsync(guild, '')).member, null);
  assert.equal((await members.resolveMemberAsync(guild, 'ana')).member.id, 'id');
});

test('medios se descargan una sola vez y fallos usan URL sin bloquear', async () => {
  const { EmbedBuilder } = require('discord.js');
  let calls = 0;
  const payload = { files: [{ attachment: 'https://example.com/test-image.gif', name: 'image.gif' }],
    embeds: [new EmbedBuilder().setImage('attachment://image.gif')] };
  const fetcher = async () => {
    calls++;
    return { ok: true, headers: new Map([['content-type', 'image/gif']]), body: [Buffer.from('GIF89a')] };
  };
  assert.ok(Buffer.isBuffer((await prepareKissPayload(payload, fetcher)).files[0].attachment));
  await prepareKissPayload(payload, fetcher);
  assert.equal(calls, 1);
  const bad = { ...payload, files: [{ attachment: 'https://example.com/fail.gif', name: 'image.gif' }] };
  const fallback = await prepareKissPayload(bad, async () => { throw new Error('offline'); });
  assert.equal(fallback.files.length, 0);
  assert.equal(fallback.embeds[0].toJSON().image.url, bad.files[0].attachment);
});
