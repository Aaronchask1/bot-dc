const ITUNES_ENDPOINT = 'https://itunes.apple.com/search';
const USER_AGENT = 'xyb-private-bot/1.0';

function durationSeconds(milliseconds) {
    const value = Number(milliseconds);
    return Number.isFinite(value) && value > 0 ? value / 1000 : null;
}

function artwork(item) {
    const url = item.artworkUrl100 || item.artworkUrl60 || null;
    return url ? String(url).replace(/100x100bb|60x60bb/, '600x600bb') : null;
}

function normalize(item) {
    return {
        title: item.trackName || 'Desconocido',
        artist: item.artistName || 'Desconocido',
        album: item.collectionName || null,
        duration: durationSeconds(item.trackTimeMillis),
        thumbnail: artwork(item)
    };
}

/**
 * iTunes se usa solo como buscador de metadatos. No reproduce audio ni
 * necesita cuenta, cookies o tokens: sirve para convertir "cara quintero"
 * en "Rafa Caro T3r Elemento" antes de buscar en SoundCloud.
 */
async function search(query, { limit = 3, country = process.env.ITUNES_COUNTRY || 'US' } = {}) {
    const term = String(query || '').trim();
    if (!term) return [];

    const url = `${ITUNES_ENDPOINT}?term=${encodeURIComponent(term)}` +
        `&media=music&entity=song&limit=${Math.min(Math.max(Math.round(limit), 1), 10)}` +
        `&country=${encodeURIComponent(country)}`;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8_000);

    try {
        const response = await fetch(url, {
            headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
            signal: controller.signal
        });

        if (!response.ok) {
            throw new Error(`iTunes respondió HTTP ${response.status}`);
        }

        const data = await response.json();
        return (data.results || []).map(normalize);
    } finally {
        clearTimeout(timer);
    }
}

module.exports = { search };
