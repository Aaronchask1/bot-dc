const { createStore } = require('../store');

// Datos que una persona decide guardar para su propio perfil UID. No se intenta
// deducir ni obtener información privada de Discord.
const profiles = createStore('uid-profiles', {});

function get(userId) {
  const current = profiles.get(userId);
  if (current) return current;
  return profiles.set(userId, { registeredAt: Date.now(), nitroStartedAt: null });
}

function register(userId) {
  const current = get(userId);
  const next = { ...current, lastUsedAt: Date.now() };
  return profiles.set(userId, next);
}

function setNitroStart(userId, date) {
  const current = get(userId);
  return profiles.set(userId, { ...current, nitroStartedAt: date.toISOString(), lastUsedAt: Date.now() });
}

function clearNitroStart(userId) {
  const current = get(userId);
  return profiles.set(userId, { ...current, nitroStartedAt: null, lastUsedAt: Date.now() });
}

module.exports = { get, register, setNitroStart, clearNitroStart };
