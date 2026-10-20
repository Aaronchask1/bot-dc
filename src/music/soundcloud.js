const ytdlp = require('./ytdlp');

const SOUNDCLOUD_URL = /^https?:\/\/(?:www\.|m\.)?soundcloud\.com\//i;

function isSoundCloudUrl(value) {
    return SOUNDCLOUD_URL.test(String(value || '').trim());
}

function unsupportedUrlError() {
    const error = new Error('Usa un enlace de YouTube o SoundCloud, o escribe el nombre de la canción.');
    error.code = 'UNSUPPORTED_URL';
    return error;
}

async function search(query, options = {}) {
    return ytdlp.searchSoundCloud(query, options);
}

async function resolveUrl(url) {
    if (!isSoundCloudUrl(url)) throw unsupportedUrlError();
    return ytdlp.resolveSoundCloudUrl(url);
}

module.exports = {
    isSoundCloudUrl,
    unsupportedUrlError,
    search,
    resolveUrl
};
