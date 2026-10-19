const cache = new Map();
const WORDS = { gato: 'cat', gatos: 'cats', perro: 'dog', perros: 'dogs', encima: 'on', debajo: 'under', sobre: 'on', de: '', del: '', un: '', una: '', el: '', la: '', en: 'in', con: 'with', paisaje: 'landscape', playa: 'beach', bosque: 'forest', coche: 'car', carro: 'car', rojo: 'red', negro: 'black', blanco: 'white', luna: 'moon', galaxia: 'galaxy', flores: 'flowers', ciudad: 'city', caballo: 'horse', meme: 'meme', gracioso: 'funny' };
const STOP = new Set('de del la las el los un una unos unas a con en encima debajo sobre on under in with of the and y photo foto imagen realista muy'.split(' '));
function normalized(value) { return plain(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase(); }
function translated(query) { return normalized(query).split(/\s+/).map(w => WORDS[w] ?? w).filter(Boolean).join(' '); }
function terms(query) { return [...new Set(normalized(query).split(/[^\p{L}\p{N}]+/u).filter(w => w && !STOP.has(w)).map(w => WORDS[w] || w))]; }
function score(text, wanted) {
  const found = new Set(terms(text));
  return wanted.reduce((sum, word) => sum + Number(found.has(word)), 0);
}

function plain(value = '') {
  return String(value).replace(/<[^>]*>/g, '').replace(/&amp;/g, '&').replace(/&quot;/g, '"').slice(0, 350);
}

async function commons(query, fetchImpl) {
  const url = new URL('https://commons.wikimedia.org/w/api.php');
  url.search = new URLSearchParams({ action: 'query', format: 'json', generator: 'search',
    gsrsearch: `${query} filetype:bitmap`, gsrnamespace: '6', gsrlimit: '12',
    prop: 'imageinfo', iiprop: 'url|mime|extmetadata', iiurlwidth: '1000' });
  const response = await fetchImpl(url, { signal: AbortSignal.timeout(12_000), headers: { 'User-Agent': 'XybDiscordBot/1.0 (image search; Wikimedia Commons)' } });
  if (!response.ok) throw new Error(`Búsqueda HTTP ${response.status}`);
  const data = await response.json();
  if (data.error) throw new Error('El buscador devolvió un error');
  return Object.values(data.query?.pages ?? {}).sort((a, b) => (a.index ?? 0) - (b.index ?? 0)).flatMap(p => {
    const item = p.imageinfo?.[0];
    if (!item || !['image/jpeg', 'image/png', 'image/webp'].includes(item.mime)
      || !(item.thumburl || item.url)?.startsWith('https://upload.wikimedia.org/')
      || !item.descriptionurl?.startsWith('https://commons.wikimedia.org/')) return [];
    return [{ image: item.thumburl || item.url, source: item.descriptionurl,
      title: p.title || item.descriptionurl, text: `${p.title || item.descriptionurl} ${plain(item.extmetadata?.ImageDescription?.value)}`,
      artist: plain(item.extmetadata?.Artist?.value) || 'Autor en la fuente',
      license: plain(item.extmetadata?.LicenseShortName?.value) || 'Licencia en la fuente', provider: 'Wikimedia Commons' }];
  });
}

async function openverse(query, fetchImpl) {
  const url = new URL('https://api.openverse.org/v1/images/');
  url.search = new URLSearchParams({ q: query, page_size: '20', mature: 'false', extension: 'jpg,png,webp' });
  const response = await fetchImpl(url, { signal: AbortSignal.timeout(12_000) });
  if (!response.ok) throw new Error(`Openverse HTTP ${response.status}`);
  const data = await response.json();
  return (data.results ?? []).filter(i => !i.mature && i.thumbnail?.startsWith('https://api.openverse.org/')
    && /^https:\/\//.test(i.foreign_landing_url)).map(i => ({
    image: i.thumbnail, source: i.foreign_landing_url, title: i.title,
    text: `${i.title || ''} ${(i.tags ?? []).map(t => t.name).join(' ')}`,
    artist: plain(i.creator) || 'Autor en la fuente', license: plain(i.license) || 'Licencia en la fuente', provider: 'Openverse',
  }));
}

async function search(query, { fetchImpl = fetch } = {}) {
  const key = query.toLowerCase();
  if (fetchImpl === fetch && cache.get(key)?.until > Date.now()) return cache.get(key).result;
  // Animal names in Spanish can also be place names (e.g. Gato, Puerto Rico).
  // Prefer the translated search and score actual title matches above metadata.
  const variants = [...new Set([translated(query), query])];
  const wanted = terms(query);
  let anySuccess = false;
  let best = null;
  for (const variant of variants) {
    const responses = await Promise.allSettled([commons(variant, fetchImpl), openverse(variant, fetchImpl)]);
    for (const response of responses) {
      if (response.status !== 'fulfilled') continue;
      anySuccess = true;
      for (const item of response.value) {
        const wantsDiagram = /\b(map|mapa|diagram|diagrama|logo|flag|bandera)\b/i.test(query);
        if (!wantsDiagram && /\b(map|locator|diagram|logo|flag|coat of arms)\b/i.test(item.title || '')) continue;
        const relevance = score(item.text, wanted);
        if (!best || relevance > best.relevance) best = { ...item, relevance };
      }
    }
    if (best && best.relevance >= wanted.length && wanted.length) break;
  }
  if (!anySuccess) throw new Error('Los buscadores no respondieron');
  const result = best && best.relevance >= Math.max(1, Math.ceil(wanted.length * 0.7))
    ? { ...best, related: query.split(/\s+/).length > 3 || best.relevance < wanted.length } : null;
  if (fetchImpl === fetch) {
    cache.set(key, { result, until: Date.now() + 5 * 60_000 });
    while (cache.size > 100) cache.delete(cache.keys().next().value);
  }
  return result;
}

module.exports = { search, plain, translated, terms };
