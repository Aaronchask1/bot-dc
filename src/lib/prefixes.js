const { createStore } = require('../store');

const store = createStore('prefixes');
const DEFAULT_PREFIXES = ['xyb', '!'];
const FIXED_PREFIX = 'xyb';
const MAX_PREFIXES = 5;
const MAX_LENGTH = 5;

function isValidPrefix(prefix) {
  return typeof prefix === 'string'
    && prefix.length > 0
    && prefix.length <= MAX_LENGTH
    && !/\s/.test(prefix);
}

function clean(list) {
  const seen = new Set();
  for (const raw of list) {
    const prefix = String(raw).trim().toLowerCase();
    if (isValidPrefix(prefix)) seen.add(prefix);
  }
  for (const prefix of DEFAULT_PREFIXES) seen.add(prefix);
  return [...seen].slice(0, MAX_PREFIXES);
}

function getPrefixes(guildId) {
  if (!guildId) return [...DEFAULT_PREFIXES];
  const saved = store.get(guildId);
  if (!Array.isArray(saved) || saved.length === 0) return [...DEFAULT_PREFIXES];
  // Los prefijos propios primero y el del bot al final, siempre visible.
  const own = clean(saved).filter((prefix) => !DEFAULT_PREFIXES.includes(prefix));
  return [...own, ...DEFAULT_PREFIXES];
}

function setPrefixes(guildId, prefixes) {
  return store.set(guildId, clean(prefixes));
}

function addPrefix(guildId, prefix) {
  const candidate = String(prefix ?? '').trim().toLowerCase();
  if (!isValidPrefix(candidate)) {
    return { ok: false, reason: `El prefijo debe tener entre 1 y ${MAX_LENGTH} caracteres y sin espacios.` };
  }
  if (DEFAULT_PREFIXES.includes(candidate)) {
    return { ok: false, reason: `\`${candidate}\` ya viene activo de fábrica.` };
  }
  const current = getPrefixes(guildId);
  if (current.includes(candidate)) return { ok: false, reason: `\`${candidate}\` ya estaba activo.` };
  if (current.length >= MAX_PREFIXES) return { ok: false, reason: `Ya hay ${MAX_PREFIXES} prefijos activos.` };
  setPrefixes(guildId, [...current, candidate]);
  return { ok: true, prefixes: getPrefixes(guildId) };
}

function removePrefix(guildId, prefix) {
  const candidate = String(prefix ?? '').trim().toLowerCase();
  if (DEFAULT_PREFIXES.includes(candidate)) {
    return { ok: false, reason: `\`${candidate}\` viene por defecto y no se puede quitar.` };
  }
  const current = getPrefixes(guildId);
  if (!current.includes(candidate)) return { ok: false, reason: `\`${candidate}\` no estaba activo.` };
  setPrefixes(guildId, current.filter((item) => item !== candidate));
  return { ok: true, prefixes: getPrefixes(guildId) };
}

module.exports = {
  DEFAULT_PREFIXES,
  FIXED_PREFIX,
  MAX_PREFIXES,
  MAX_LENGTH,
  addPrefix,
  getPrefixes,
  isValidPrefix,
  removePrefix,
  setPrefixes,
  store,
};
