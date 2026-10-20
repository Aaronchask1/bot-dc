const ytdlp = require('./ytdlp');

function isYouTubeUrl(value) {
    return ytdlp.isYouTubeUrl(value);
}

async function search(query, options = {}) {
    return ytdlp.searchYouTube(query, options);
}

async function resolveUrl(url) {
    if (!isYouTubeUrl(url)) {
        const error = new Error('Ese enlace no es de YouTube.');
        error.code = 'UNSUPPORTED_URL';
        throw error;
    }

    return ytdlp.resolveYouTubeUrl(url);
}

module.exports = {
    isYouTubeUrl,
    search,
    resolveUrl
};
