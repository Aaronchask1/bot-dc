/**
 * Cliente de MusicBrainz para el bot.
 * El paquete musicbrainz-api es ESM, así que se carga con import() dinámico.
 *
 * Configuración opcional en bot/.env:
 *   MB_APP_NAME, MB_APP_VERSION, MB_CONTACT, MB_BASE_URL
 */
const APP_NAME = process.env.MB_APP_NAME || 'xyb-discord-bot';
const APP_VERSION = process.env.MB_APP_VERSION || '1.0.0';
const APP_CONTACT = process.env.MB_CONTACT || 'https://github.com/Borewit/musicbrainz-api';
const BASE_URL = process.env.MB_BASE_URL || 'https://musicbrainz.org';

let apiPromise = null;

async function getApi() {
    if (!apiPromise) {
        apiPromise = import('musicbrainz-api').then(({ MusicBrainzApi }) => new MusicBrainzApi({
            appName: APP_NAME,
            appVersion: APP_VERSION,
            appContactInfo: APP_CONTACT,
            baseUrl: BASE_URL,
            rateLimit: [15, 18],
            retryLimit: 3
        }));
    }

    return apiPromise;
}

function joinArtists(credits = []) {
    return credits
        .map((credit) => typeof credit === 'string' ? credit : `${credit.name || ''}${credit.joinphrase || ''}`)
        .join('')
        .trim() || 'Desconocido';
}

function formatLength(ms) {
    if (!Number.isFinite(ms)) return null;

    const total = Math.floor(ms / 1000);
    const minutes = Math.floor(total / 60);
    const seconds = total % 60;

    return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

function normalizeRecording(recording) {
    const releases = (recording.releases || [])
        .map((release) => ({
            id: release.id,
            title: release.title,
            date: release.date || release['release-group']?.['first-release-date'] || null,
            country: release.country || null,
            status: release.status || null
        }))
        .sort((a, b) => String(a.date || '').localeCompare(String(b.date || '')));

    return {
        mbid: recording.id,
        title: recording.title,
        artist: joinArtists(recording['artist-credit']),
        artistMbid: recording['artist-credit']?.[0]?.artist?.id || null,
        length: formatLength(recording.length),
        lengthMs: recording.length,
        firstReleaseDate: recording['first-release-date'] || releases[0]?.date || null,
        disambiguation: recording.disambiguation || null,
        score: recording.score ?? null,
        isrcs: recording.isrcs || [],
        releases
    };
}

function normalizeArtist(artist) {
    return {
        mbid: artist.id,
        name: artist.name,
        sortName: artist['sort-name'] || null,
        type: artist.type || null,
        country: artist.country || null,
        disambiguation: artist.disambiguation || null,
        score: artist.score ?? null,
        lifeSpan: artist['life-span'] || null
    };
}

function normalizeRelease(release) {
    const media = release.media || [];
    const trackCount = media.reduce((sum, medium) => sum + (medium['track-count'] || 0), 0);

    return {
        mbid: release.id,
        title: release.title,
        artist: joinArtists(release['artist-credit']),
        date: release.date || null,
        country: release.country || null,
        status: release.status || null,
        trackCount: trackCount || release['track-count'] || null,
        score: release.score ?? null
    };
}

function withArtist(query, artist) {
    if (!artist) return query;
    const escaped = artist.replace(/"/g, '\\"');
    return `${query} AND artist:"${escaped}"`;
}

async function searchRecordings(query, { limit = 5, artist = null } = {}) {
    const api = await getApi();
    const result = await api.search('recording', {
        query: `${withArtist(query, artist)} AND status:official`,
        limit
    });
    return (result.recordings || []).map(normalizeRecording);
}

async function searchArtists(query, { limit = 5 } = {}) {
    const api = await getApi();
    const result = await api.search('artist', { query, limit });
    return (result.artists || []).map(normalizeArtist);
}

async function searchReleases(query, { limit = 5, artist = null } = {}) {
    const api = await getApi();
    const result = await api.search('release', { query: withArtist(query, artist), limit });
    return (result.releases || []).map(normalizeRelease);
}

async function lookupRecording(mbid) {
    const api = await getApi();
    const recording = await api.lookup('recording', mbid, ['artist-credits', 'releases', 'isrcs']);
    return normalizeRecording(recording);
}

async function getReleaseCover(releaseMbid) {
    try {
        const { CoverArtArchiveApi } = await import('musicbrainz-api');
        const coverApi = new CoverArtArchiveApi();
        const cover = await coverApi.getReleaseCover(releaseMbid, 'front');
        return cover?.url || null;
    } catch {
        return null;
    }
}

module.exports = {
    searchRecordings,
    searchArtists,
    searchReleases,
    lookupRecording,
    getReleaseCover,
    joinArtists
};
