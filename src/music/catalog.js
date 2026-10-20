let clientPromise;

async function getClient() {
  if (!clientPromise) {
    clientPromise = import('musicbrainz-api').then(({ MusicBrainzApi }) => new MusicBrainzApi({
      appName: 'Xyb',
      appVersion: '1.0.0',
      appContactInfo: 'https://github.com/Aaronchask1/bot-dc',
      retryLimit: 2,
    }));
  }
  return clientPromise;
}

function artistName(recording) {
  return (recording['artist-credit'] || [])
    .map((credit) => credit.name || credit.artist?.name)
    .filter(Boolean)
    .join(' ')
    .trim();
}

async function canonicalize(query) {
  const client = await getClient();
  const result = await client.search('recording', { query, limit: 1 });
  const recording = result.recordings?.[0];
  if (!recording?.title) return null;
  const artist = artistName(recording);
  return {
    title: recording.title,
    artist,
    query: artist ? `${recording.title} ${artist}` : recording.title,
  };
}

module.exports = { canonicalize };
