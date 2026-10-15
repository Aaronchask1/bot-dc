const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

// Una segunda copia del bot con el mismo token responde TODO dos veces,
// porque Discord reparte cada evento entre todas las sesiones abiertas.
function isProcessAlive(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return error.code === 'EPERM';
  }
}

function readLock(lockFile) {
  try {
    const raw = JSON.parse(fs.readFileSync(lockFile, 'utf8'));
    return {
      pid: Number(raw.pid),
      host: typeof raw.host === 'string' ? raw.host : '',
      startedAt: Number(raw.startedAt) || 0,
    };
  } catch {
    return null;
  }
}

/**
 * Guarda un candado en disco para que solo pueda ejecutarse una copia por carpeta.
 * Si el candado pertenece a un proceso vivo de esta máquina, lanza un error.
 * Los candados de otras máquinas se consideran válidos durante `foreignTtlMs`.
 */
function acquireInstanceLock(lockFile, {
  maxAgeMs = 24 * 60 * 60_000,
  foreignTtlMs = 30 * 60_000,
  pid = process.pid,
} = {}) {
  fs.mkdirSync(path.dirname(lockFile), { recursive: true });
  const existing = readLock(lockFile);

  if (existing) {
    const sameHost = existing.host === os.hostname();
    const alive = sameHost && existing.pid !== pid && isProcessAlive(existing.pid);
    const recentForeign = !sameHost && Date.now() - existing.startedAt < foreignTtlMs;

    if (alive || recentForeign) {
      const detail = alive
        ? `PID ${existing.pid} en ${existing.host}`
        : `otra máquina (${existing.host || 'desconocida'})`;
      throw new Error(
        `Ya hay otra copia del bot corriendo (${detail}). `
        + 'Cada copia responde a todo lo que pasa, por eso el bot se repite. '
        + 'Cierra la otra copia y vuelve a ejecutar "npm start".',
      );
    }
  }

  const payload = { pid, host: os.hostname(), startedAt: Date.now() };
  fs.writeFileSync(lockFile, `${JSON.stringify(payload, null, 2)}\n`);

  let released = false;
  function release() {
    if (released) return;
    released = true;
    const current = readLock(lockFile);
    if (current?.pid === pid) {
      try {
        fs.rmSync(lockFile, { force: true });
      } catch {
        // Si no se puede borrar, el siguiente arranque lo toma por caduco.
      }
    }
  }

  return { release, payload };
}

/**
 * Evita responder dos veces al mismo mensaje o interacción, aunque Discord
 * reenvíe el evento o el proceso se reinicie a mitad de una respuesta.
 */
function createReplayGuard({ ttlMs = 15 * 60_000, max = 5000 } = {}) {
  const seen = new Map();

  function prune(now) {
    for (const [key, stamp] of seen) {
      if (now - stamp > ttlMs) seen.delete(key);
    }
    while (seen.size > max) {
      const oldest = seen.keys().next().value;
      seen.delete(oldest);
    }
  }

  return function claim(key, now = Date.now()) {
    prune(now);
    const previous = seen.get(key);
    if (previous !== undefined && now - previous < ttlMs) return false;
    seen.set(key, now);
    return true;
  };
}

module.exports = {
  acquireInstanceLock,
  createReplayGuard,
  isProcessAlive,
};
