const { createStore } = require('../store');

function createKissService(store = createStore('kiss-counts')) {
  let normalized = false;
  const key = (guild, a, b) => [guild, ...[a, b].sort()].join(':');
  function migrate() {
    if (normalized) return;
    const totals = {};
    for (const [oldKey, value] of Object.entries(store.read())) {
      const parts = oldKey.split(':');
      if (parts.length !== 3 || !Number.isSafeInteger(value) || value < 0) continue;
      const canonical = key(...parts);
      totals[canonical] = (totals[canonical] ?? 0) + value;
      if (canonical !== oldKey) store.delete(oldKey);
    }
    for (const [canonical, value] of Object.entries(totals)) {
      if (store.get(canonical) !== value) store.set(canonical, value);
    }
    normalized = true;
  }
  function get(guild, a, b) { migrate(); return store.get(key(guild, a, b)) ?? 0; }
  function add(guild, a, b) {
    const count = get(guild, a, b) + 1;
    store.set(key(guild, a, b), count);
    return count;
  }
  function claimResponse(messageId, now = Date.now()) {
    if (!messageId) return false;
    const handled = store.get('__responses') ?? {};
    if (handled[messageId]) return false;
    for (const [id, time] of Object.entries(handled)) if (now - time > 2 * 86400_000) delete handled[id];
    handled[messageId] = now;
    store.set('__responses', handled);
    return true;
  }
  function stats(guild, user) {
    migrate();
    let total = 0;
    let partners = 0;
    for (const [record, count] of Object.entries(store.read())) {
      const [g, a, b] = record.split(':');
      if (g === guild && (a === user || b === user) && typeof count === 'number') {
        total += count;
        if (count > 0) partners += 1;
      }
    }
    return { total, partners };
  }
  return { get, add, claimResponse, stats };
}
module.exports = { ...createKissService(), createKissService };
