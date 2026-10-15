const { createStore } = require('../store');

// Los matrimonios se guardan por pareja (ordenada) para que A con B y B con A
// sean el mismo matrimonio.
const store = createStore('marriages');

function key(guildId, first, second) {
  const [a, b] = [first, second].sort();
  return `${guildId}:${a}:${b}`;
}

function pairOf(recordKey) {
  const [, a, b] = recordKey.split(':');
  return [a, b];
}

/** Quita cualquier matrimonio previo de esa persona antes de casarla de nuevo. */
function clearUser(guildId, userId) {
  const all = store.get(guildId) ?? {};
  let changed = false;
  for (const [recordKey, record] of Object.entries(all)) {
    const [a, b] = pairOf(recordKey);
    if (a === userId || b === userId) {
      delete all[recordKey];
      changed = true;
    }
  }
  if (changed) store.set(guildId, all);
  return changed;
}

function marry(guildId, first, second, by) {
  const previous = getPartner(guildId, first);
  if (previous) return { ok: false, reason: 'ya_estaba_casado', partner: previous };
  if (getPartner(guildId, second)) return { ok: false, reason: 'ya_esta_casada' };

  clearUser(guildId, first);
  clearUser(guildId, second);
  const record = { since: Date.now(), by };
  store.set(guildId, { ...(store.get(guildId) ?? {}), [key(guildId, first, second)]: record });
  return { ok: true, since: record.since };
}

function getPartner(guildId, userId) {
  const all = store.get(guildId) ?? {};
  for (const [recordKey, record] of Object.entries(all)) {
    const [a, b] = pairOf(recordKey);
    if (a === userId) return { id: b, since: record.since };
    if (b === userId) return { id: a, since: record.since };
  }
  return null;
}

function divorce(guildId, userId) {
  const partner = getPartner(guildId, userId);
  if (!partner) return { ok: false, reason: 'no_casado' };
  clearUser(guildId, userId);
  return { ok: true, partner: partner.id };
}

function members(guildId) {
  return Object.keys(store.get(guildId) ?? {}).length * 2;
}

module.exports = { clearUser, divorce, getPartner, marry, members };
