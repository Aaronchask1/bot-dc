const { randomInt } = require('node:crypto');
let cache;
let expires = 0;
async function search(query, { fetchImpl = fetch, now = Date.now } = {}) {
  if (!cache || now() >= expires) {
    const response = await fetchImpl('https://api.imgflip.com/get_memes', { signal: AbortSignal.timeout(12_000) });
    if (!response.ok) throw new Error('Imgflip no está disponible.');
    const data = await response.json();
    if (!data.success || !Array.isArray(data.data?.memes)) throw new Error('No se pudo cargar el catálogo de memes.');
    cache = data.data.memes.filter(m => /^https:\/\/i\.imgflip\.com\//.test(m.url) && /^\d+$/.test(m.id));
    expires = now() + 3600_000;
  }
  const synonyms = { gato: 'cat', perro: 'dog', novia: 'girlfriend', novio: 'boyfriend', drake: 'drake' };
  const words = query.toLowerCase().split(/\s+/).filter(Boolean).map(w => synonyms[w] || w);
  const matches = cache.filter(m => words.every(w => m.name.toLowerCase().includes(w)));
  return matches.length ? matches[randomInt(matches.length)] : null;
}
module.exports = { search };
