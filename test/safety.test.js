const test = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { acquireInstanceLock, createReplayGuard } = require('../src/safety');

function tempLockFile() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'xyb-lock-'));
  return path.join(dir, 'bot.lock');
}

// Un proceso real y vivo, para comprobar la detección de duplicados de verdad.
function startIdleProcess() {
  const child = spawn(process.execPath, ['-e', 'setTimeout(() => {}, 30000)'], { stdio: 'ignore' });
  return child;
}

test('el candado bloquea una segunda copia mientras la primera sigue viva', () => {
  const lockFile = tempLockFile();
  const child = startIdleProcess();
  const first = acquireInstanceLock(lockFile, { pid: child.pid });

  assert.throws(() => acquireInstanceLock(lockFile), /otra copia del bot/);
  assert.throws(() => acquireInstanceLock(lockFile), new RegExp(String(child.pid)));

  first.release();
  const second = acquireInstanceLock(lockFile);
  second.release();
  child.kill();
});

test('un candado de un proceso muerto no bloquea el arranque', () => {
  const lockFile = tempLockFile();
  fs.writeFileSync(lockFile, JSON.stringify({ pid: 999_999_999, host: os.hostname(), startedAt: Date.now() }));

  const lock = acquireInstanceLock(lockFile);
  assert.equal(fs.existsSync(lockFile), true);
  lock.release();
  assert.equal(fs.existsSync(lockFile), false);
});

test('un candado reciente de otra máquina también bloquea', () => {
  const lockFile = tempLockFile();
  fs.writeFileSync(lockFile, JSON.stringify({ pid: 42, host: 'otra-maquina', startedAt: Date.now() }));

  assert.throws(() => acquireInstanceLock(lockFile), /otra copia del bot/);
});

test('release es idempotente y no borra el candado de otra copia', () => {
  const lockFile = tempLockFile();
  const lock = acquireInstanceLock(lockFile);
  lock.release();
  lock.release();

  const other = acquireInstanceLock(lockFile);
  fs.writeFileSync(lockFile, JSON.stringify({ pid: 999_999_999, host: os.hostname(), startedAt: Date.now() }));
  lock.release();
  assert.equal(fs.existsSync(lockFile), true);
  other.release();
});

test('el guardia de repeticiones bloquea la segunda entrega del mismo id', () => {
  const claim = createReplayGuard({ ttlMs: 1000, max: 10 });

  assert.equal(claim('msg:1', 0), true);
  assert.equal(claim('msg:1', 500), false);
  assert.equal(claim('msg:2', 500), true);
  assert.equal(claim('msg:1', 1500), true, 'caduca tras el ttl');
});

test('el guardia de repeticiones no crece sin límite', () => {
  const claim = createReplayGuard({ ttlMs: 10_000, max: 5 });
  for (let index = 0; index < 50; index += 1) claim(`msg:${index}`, 0);
  assert.equal(claim('msg:0', 1), true, 'las entradas viejas se purgaron');
});
