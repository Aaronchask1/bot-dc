const { test } = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const { install, delayFor } = require('../src/lib/auto-delete');
const { search } = require('../src/lib/image-search');

test('only own messages expire after five minutes, duplicate events do not reset timers', async () => {
  const records = {};
  const scheduled = [];
  const deleted = [];
  const client = new EventEmitter();
  client.user = { id: 'bot' };
  client.rest = { delete: async route => deleted.push(route) };
  const store = { read: () => records, get: id => records[id], set: (id, r) => { records[id] = r; }, delete: id => { delete records[id]; } };
  const cleaner = install(client, { store, now: () => 1000, schedule: (fn, ms) => { scheduled.push({ fn, ms }); return {}; } });
  const msg = { id: '1', channelId: 'channel', guildId: 'guild', author: { id: 'bot' }, createdTimestamp: 1000, content: 'purge listo' };
  cleaner.track({ ...msg, author: { id: 'human' } });
  cleaner.track({ ...msg, author: { id: 'other-bot' } });
  assert.equal(scheduled.length, 0);
  cleaner.track(msg); cleaner.track(msg);
  assert.equal(scheduled.length, 1);
  assert.equal(scheduled[0].ms, 300000);
  assert.equal(delayFor('<@123> pongase el puto uniforme o lo voy a banear mierda tienes 5'), 300000);
  await scheduled[0].fn();
  assert.equal(deleted.length, 1);
  assert.equal(store.get('1'), undefined);
});

test('image search encodes query and returns attribution with image', async () => {
  const result = await search('perro & gato', { fetchImpl: async url => {
    if (url.hostname === 'api.openverse.org') return { ok: true, json: async () => ({ results: [] }) };
    assert.equal(url.searchParams.get('gsrsearch'), 'dog & cat filetype:bitmap');
    return { ok: true, json: async () => ({ query: { pages: { 1: { title: 'File:Cat and dog.jpg', imageinfo: [{ mime: 'image/jpeg', url: 'https://upload.wikimedia.org/dog.jpg', descriptionurl: 'https://commons.wikimedia.org/wiki/File:Dog.jpg', extmetadata: { Artist: { value: '<a>Author</a>' }, LicenseShortName: { value: 'CC BY-SA' } } }] } } } }) };
  } });
  assert.equal(result.artist, 'Author');
  assert.equal(result.license, 'CC BY-SA');
});

test('image search handles no results and HTTP errors', async () => {
  assert.equal(await search('nothing', { fetchImpl: async () => ({ ok: true, json: async () => ({}) }) }), null);
  await assert.rejects(search('dog', { fetchImpl: async () => ({ ok: false, status: 429 }) }), /buscadores/);
});

test('Openverse fallback works when Commons fails and filters unrelated images', async () => {
  const result = await search('gato encima de perro', { fetchImpl: async url => {
    if (url.hostname === 'commons.wikimedia.org') throw new Error('offline');
    return { ok: true, json: async () => ({ results: [
      { title: 'map of city', thumbnail: 'https://api.openverse.org/map', foreign_landing_url: 'https://example.com/map' },
      { title: 'cat on dog', thumbnail: 'https://api.openverse.org/cat', foreign_landing_url: 'https://example.com/cat', creator: 'Author', license: 'cc0' },
    ] }) };
  } });
  assert.equal(result.provider, 'Openverse');
  assert.equal(result.source, 'https://example.com/cat');
  assert.equal(result.related, true);
});

test('img scenes never invoke OpenAI and return browser link when nothing matches', async () => {
  const images = require('../src/lib/image-search');
  const original = images.search;
  images.search = async () => null;
  try {
    let payload;
    await require('../src/commands/img').execute({ text: 'perro encima de gato', reply: async p => { payload = p; } });
    assert.match(payload.content, /google.com\/search/);
    assert.doesNotMatch(payload.content, /API_KEY|saldo|IA/);
    assert.deepEqual(payload.allowedMentions, { parse: [] });
  } finally { images.search = original; }
});
