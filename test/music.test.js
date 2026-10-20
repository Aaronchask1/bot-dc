const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

process.env.XYB_DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'xyb-music-'));

const ytdlp = require('../src/music/ytdlp');
const soundcloud = require('../src/music/soundcloud');
const music = require('../src/music/manager');
const { findCommand } = require('../src/commands');

test('el bitrate se limita a 32-128 kbps y usa 64 por defecto', () => {
  assert.equal(ytdlp.clampBitrate(undefined), 64);
  assert.equal(ytdlp.clampBitrate(0), 64);
  assert.equal(ytdlp.clampBitrate(8), 32);
  assert.equal(ytdlp.clampBitrate(64), 64);
  assert.equal(ytdlp.clampBitrate(96.4), 96);
  assert.equal(ytdlp.clampBitrate(999), 128);
});

test('el volumen acepta porcentajes (80) y ratios (0.8)', () => {
  assert.equal(music.normalizeVolume(100), 1);
  assert.equal(music.normalizeVolume(80), 0.8);
  assert.equal(music.normalizeVolume(0.8), 0.8);
  assert.equal(music.normalizeVolume(200), 2);
  assert.equal(music.normalizeVolume(0), 0);
  assert.equal(music.normalizeVolume('malo'), 1);
});

test('los alias de música resuelven sin pisar los comandos existentes', () => {
  assert.equal(findCommand('play').name, 'play');
  assert.equal(findCommand('p').name, 'play');
  assert.equal(findCommand('tocar').name, 'play');
  assert.equal(findCommand('cola').name, 'queue');
  assert.equal(findCommand('q').name, 'queue');
  assert.equal(findCommand('v').name, 'volume');
  assert.equal(findCommand('next').name, 'skip');
  assert.equal(findCommand('sonando').name, 'np');
  assert.equal(findCommand('musicbrainz').name, 'mb');
  assert.equal(findCommand('ytmusic').name, 'ytm');
  // `s` ya era el alias de snipe: skip no debe robarlo.
  assert.equal(findCommand('s').name, 'snipe');
});

test('las duraciones se formatean como en Discord', () => {
  assert.equal(music.formatDuration(65), '1:05');
  assert.equal(music.formatDuration(3725), '1:02:05');
  assert.equal(music.formatDuration(null), 'EN VIVO');
});

test('detecta URLs y rechaza búsquedas', () => {
  assert.equal(ytdlp.isUrl('https://www.youtube.com/watch?v=abc'), true);
  assert.equal(ytdlp.isUrl('http://ejemplo.com'), true);
  assert.equal(ytdlp.isUrl('bad bunny'), false);
});

test('solo acepta enlaces de SoundCloud para reproducir', async () => {
  assert.equal(soundcloud.isSoundCloudUrl('https://soundcloud.com/t3relemento/rafa-caro'), true);
  assert.equal(soundcloud.isSoundCloudUrl('https://www.youtube.com/watch?v=abc'), false);

  await assert.rejects(
    music.resolveTrack('https://www.youtube.com/watch?v=abc'),
    (error) => error.code === 'UNSUPPORTED_URL'
  );
});

test('sin canal de voz, play falla antes de tocar la red', async () => {
  const ctx = {
    guild: { id: 'g-music-test', members: { me: {} }, voiceAdapterCreator: () => ({}) },
    member: { voice: { channel: null } },
    channel: { id: 'c1' },
    client: {},
    user: { id: 'u1', username: 'akira' },
  };

  await assert.rejects(
    music.enqueue(ctx, 'cualquier canción'),
    (error) => error.code === 'NOVOICE'
  );
});

test('el estado de un servidor sin sesión es nulo y el volumen por defecto es 100 %', () => {
  assert.equal(music.getSessionInfo('g-sin-sesion'), null);
  assert.equal(music.getVolume('g-sin-sesion'), 1);
});

test('los comandos de música se registran para prefijo y slash', () => {
  for (const name of ['play', 'pause', 'resume', 'skip', 'queue', 'np', 'stop', 'volume']) {
    const command = findCommand(name);
    assert.ok(command, `falta ${name}`);
    assert.equal(command.guildOnly, true, `${name}: guildOnly`);
    assert.ok(command.slash, `${name}: slash`);
  }
});
