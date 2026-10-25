const { randomInt } = require('node:crypto');
const { createStore } = require('../store');

const MODES = ['todos', 'letras', 'numeros', 'sin_simbolos'];
const INTERVAL_MS = 6000;
const AVAILABLE_TTL = 15 * 60_000;
const TAKEN_TTL = 60 * 60_000;
const MAX_CACHE = 25_000;
const BATCH_SIZE = 12;
const RAPIDAPI_HOST = 'discord-username-availability-checker-api.p.rapidapi.com';

function validName(type, value) {
  if (typeof value !== 'string') return false;
  return type === 'vanities' ? /^[a-z0-9-]{2,32}$/.test(value)
    : /^[a-z0-9_.]{2,32}$/.test(value) && !value.includes('..');
}

function alphabet(type, mode) {
  if (mode === 'letras') return 'abcdefghijklmnopqrstuvwxyz';
  if (mode === 'numeros') return '0123456789';
  const plain = 'abcdefghijklmnopqrstuvwxyz0123456789';
  return mode === 'sin_simbolos' ? plain : plain + (type === 'vanities' ? '-' : '_.');
}

function candidate({ type = 'usernames', length = 3, mode = 'todos', query = '' }) {
  const characters = alphabet(type, mode);
  const size = length ?? randomInt(Math.max(2, query.length), 33);
  if (query.length > size || [...query].some((character) => !characters.includes(character))) return null;
  let tail = '';
  for (let i = query.length; i < size; i += 1) tail += characters[randomInt(characters.length)];
  const offset = randomInt(tail.length + 1);
  const value = tail.slice(0, offset) + query + tail.slice(offset);
  return validName(type, value) ? value : null;
}

function createLookupService({
  fetchImpl = (...args) => fetch(...args),
  now = () => Date.now(),
  sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  store = createStore('lookup-cache'),
  intervalMs = INTERVAL_MS,
} = {}) {
  let nextRequestAt = 0;
  let blockedUntil = 0;
  let active = false;

  const records = () => store.get('records') ?? {};
  const fresh = (record) => record && now() - record.checkedAt < (record.status === 'taken' ? TAKEN_TTL : AVAILABLE_TTL);
  function remember(record) {
    const values = records();
    values[`${record.type}:${record.username}`] = record;
    if (Object.keys(values).length > MAX_CACHE) {
      const oldest = Object.entries(values).sort((a, b) => a[1].checkedAt - b[1].checkedAt).slice(0, 1000);
      for (const [key] of oldest) delete values[key];
    }
    store.set('records', values);
    return record;
  }

  async function requestRapidApi(username, shouldStop = () => false) {
    const key = String(process.env.RAPIDAPI_KEY || '').trim();
    if (!key || shouldStop()) return null;
    if (blockedUntil > now()) return { status: 'limited', retryAt: blockedUntil };
    if (nextRequestAt > now()) await sleep(nextRequestAt - now());
    if (shouldStop()) return { status: 'cancelled' };
    nextRequestAt = now() + intervalMs;
    try {
      const response = await fetchImpl(`https://${RAPIDAPI_HOST}/check_username/${encodeURIComponent(username)}`, {
        method: 'GET',
        headers: {
          'x-rapidapi-key': key,
          'x-rapidapi-host': RAPIDAPI_HOST,
        },
        signal: AbortSignal.timeout(12_000),
      });
      const data = await response.json().catch(() => null);
      if (response.status === 429) {
        blockedUntil = now() + 60_000;
        return { status: 'limited', retryAt: blockedUntil };
      }
      if ([401, 403].includes(response.status)) {
        blockedUntil = now() + 15 * 60_000;
        return { status: 'restricted' };
      }
      const available = typeof data?.available === 'boolean'
        ? data.available
        : typeof data?.taken === 'boolean' ? !data.taken : null;
      if (response.status === 200 && available !== null) {
        return remember({ type: 'usernames', username, status: available ? 'available' : 'taken', checkedAt: now() });
      }
    } catch {
      // El endpoint directo de Discord queda como respaldo si RapidAPI falla.
    }
    return null;
  }

  async function request(type, username, shouldStop = () => false) {
    if (!validName(type, username)) return { status: 'invalid', username };
    if (blockedUntil > now()) return { status: 'limited', retryAt: blockedUntil };
    const cached = records()[`${type}:${username}`];
    if (fresh(cached)) return { ...cached, cached: true };
    if (nextRequestAt > now()) await sleep(nextRequestAt - now());
    if (shouldStop()) return { status: 'cancelled' };
    if (type === 'usernames' && process.env.RAPIDAPI_KEY) {
      const rapidResult = await requestRapidApi(username, shouldStop);
      if (rapidResult) return rapidResult;
    }
    nextRequestAt = now() + intervalMs;
    const url = type === 'vanities'
      ? `https://discord.com/api/v10/invites/${encodeURIComponent(username)}?with_counts=false&with_expiration=false`
      : 'https://discord.com/api/v9/unique-username/username-attempt-unauthed';
    try {
      // Consulta pública anónima: nunca envía tokens. Este endpoint de
      // usernames no pertenece a la API documentada de bots y puede cambiar.
      const response = await fetchImpl(url, {
        method: type === 'vanities' ? 'GET' : 'POST',
        headers: { 'Content-Type': 'application/json', 'User-Agent': 'XYB-Lookup/1.0' },
        ...(type === 'usernames' ? { body: JSON.stringify({ username }) } : {}),
        signal: AbortSignal.timeout(12_000),
      });
      const data = await response.json().catch(() => null);
      if (response.status === 429) {
        const seconds = Number(data?.retry_after ?? response.headers.get('retry-after'));
        blockedUntil = now() + Math.max(intervalMs, Number.isFinite(seconds) && seconds > 0 ? seconds * 1000 : 60_000);
        return { status: 'limited', retryAt: blockedUntil };
      }
      if ([401, 403].includes(response.status) || data?.captcha_key) {
        blockedUntil = now() + 15 * 60_000;
        return { status: 'restricted' };
      }
      let status;
      if (type === 'usernames' && response.status === 200 && typeof data?.taken === 'boolean') {
        status = data.taken ? 'taken' : 'available';
      } else if (type === 'vanities' && response.status === 200 && typeof data?.code === 'string') {
        status = 'taken';
      } else if (type === 'vanities' && response.status === 404 && data?.code === 10006) {
        // Una invitación inexistente no demuestra que la vanity sea asignable.
        status = 'unlinked';
      } else {
        blockedUntil = now() + 60_000;
        return { status: 'unavailable' };
      }
      return remember({ type, username, status, checkedAt: now() });
    } catch {
      blockedUntil = now() + 60_000;
      return { status: 'unavailable' };
    }
  }

  function search({ type = 'usernames', length = 3, query = '', mode = 'todos', page = 0, pageSize = 8 } = {}) {
    const matches = Object.values(records()).filter((entry) => entry.type === type && fresh(entry)
      && entry.status === (type === 'vanities' ? 'unlinked' : 'available')
      && (!length || entry.username.length === length) && entry.username.includes(query)
      && [...entry.username].every((character) => alphabet(type, mode).includes(character)))
      .sort((a, b) => b.checkedAt - a.checkedAt || a.username.localeCompare(b.username));
    const pages = Math.max(1, Math.ceil(matches.length / pageSize));
    const currentPage = Math.max(0, Math.min(Number.isInteger(page) ? page : 0, pages - 1));
    return { entries: matches.slice(currentPage * pageSize, (currentPage + 1) * pageSize), page: currentPage, pages, total: matches.length };
  }

  async function discover(filters, { onProgress = async () => {}, shouldStop = () => false, exactName = null, limit = BATCH_SIZE } = {}) {
    if (active) return { status: 'busy', checked: 0, found: 0 };
    if (blockedUntil > now()) return { status: 'limited', retryAt: blockedUntil, checked: 0, found: 0 };
    active = true;
    let checked = 0;
    let found = 0;
    let last = null;
    const tried = new Set();
    try {
      const count = exactName ? 1 : Math.min(BATCH_SIZE, Math.max(1, limit));
      while (checked < count && !shouldStop()) {
        let name = exactName;
        if (!name) {
          for (let attempt = 0; attempt < 300; attempt += 1) {
            const generated = candidate(filters);
            if (generated && !tried.has(generated) && !fresh(records()[`${filters.type}:${generated}`])) {
              name = generated; break;
            }
          }
        }
        if (!name) return { status: 'exhausted', checked, found };
        tried.add(name);
        last = await request(filters.type, name, shouldStop);
        if (!['available', 'taken', 'unlinked'].includes(last.status)) return { ...last, checked, found };
        checked += 1;
        if (last.status !== 'taken') found += 1;
        await onProgress({ checked, found, total: count, last });
      }
      return { status: shouldStop() ? 'cancelled' : 'complete', checked, found, last };
    } finally { active = false; }
  }

  return { search, discover, isBusy: () => active };
}

module.exports = { ...createLookupService(), createLookupService, candidate, alphabet, validName, MODES, BATCH_SIZE, RAPIDAPI_HOST };
