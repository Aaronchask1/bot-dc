const test = require('node:test');
const assert = require('node:assert/strict');
const spotify = require('../src/music/spotify');
const music = require('../src/music/manager');
const panel = require('../src/music/panel');

test('Spotify acepta enlaces regionales y rechaza hosts ajenos', () => {
  assert.deepEqual(spotify.parseSpotifyUrl('https://open.spotify.com/intl-es/playlist/abc?si=xyz'), { kind: 'playlist', id: 'abc' });
  assert.equal(spotify.parseSpotifyUrl('https://open.spotify.com.evil.test/playlist/abc'), null);
});

test('playlist conserva orden y excluye episodios', () => {
  const entity = { trackList: [
    { uri: 'spotify:track:a', title: 'Primera', subtitle: 'Artista', duration: 2000 },
    { uri: 'spotify:episode:b', title: 'Podcast' },
    { uri: 'spotify:track:c', title: 'Segunda', subtitle: 'Otro' },
  ] };
  const html = '<script id="__NEXT_DATA__" type="application/json">' +
    JSON.stringify({ props: { pageProps: { state: { data: { entity } } } } }) + '</script>';
  const result = spotify.parseEmbed(html, { kind: 'playlist' });
  assert.deepEqual(result.tracks.map(t => t.query), ['Primera Artista', 'Segunda Otro']);
  assert.ok(result.tracks.every(t => t.pendingResolve));
  assert.equal(result.tracks[0].duration, 2);
  assert.throws(() => spotify.parseEmbed('<html></html>', { kind: 'playlist' }), /público/);
});

test('fallos HTTP de Spotify se propagan sin devolver una cola vacía', async () => {
  await assert.rejects(spotify.read('https://open.spotify.com/playlist/abc',
    async () => ({ ok: false, status: 429 })), /429/);
});

test('panel ofrece los cinco controles', () => {
  assert.deepEqual(panel.payload('none').components.flatMap(row => row.components.map(b => b.data.custom_id)),
    ['music:previous', 'music:pause', 'music:next', 'music:down', 'music:up']);
});

test('panel niega controles fuera del canal de voz', async (t) => {
  t.mock.method(music, 'getSessionInfo', () => ({ channelId: 'voice' }));
  const skip = t.mock.method(music, 'skip');
  let denied;
  await panel.handleComponent({ isButton: () => true, customId: 'music:next', guildId: 'g',
    user: { id: 'u' }, guild: { members: { cache: new Map() } },
    reply: async value => { denied = value; },
  });
  assert.match(denied.content, /mismo canal/);
  assert.equal(skip.mock.callCount(), 0);
});

test('panel reanuda una pausa y ajusta volumen del servidor correcto', async (t) => {
  t.mock.method(music, 'getSessionInfo', () => ({ channelId: 'voice', paused: true, volume: 0.5, queue: [] }));
  const resume = t.mock.method(music, 'resume', () => true);
  const volume = t.mock.method(music, 'setVolume', () => 0.6);
  const interaction = { isButton: () => true, customId: 'music:pause', guildId: 'g',
    user: { id: 'u' }, guild: { members: { cache: new Map([['u', { voice: { channelId: 'voice' } }]]) } },
    deferUpdate: async () => {}, editReply: async () => {},
  };
  await panel.handleComponent(interaction);
  assert.deepEqual(resume.mock.calls[0].arguments, ['g']);
  interaction.customId = 'music:up';
  await panel.handleComponent(interaction);
  assert.deepEqual(volume.mock.calls[0].arguments, ['g', 0.6]);
});
