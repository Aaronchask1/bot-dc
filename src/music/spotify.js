// Public metadata only. Audio is resolved separately, never extracted from Spotify.
function parseSpotifyUrl(value) {
  let url;
  try { url = new URL(value); } catch { return null; }
  if (url.hostname !== 'open.spotify.com') return null;
  const match = url.pathname.match(/^\/(?:intl-[\w-]+\/)?(track|album|playlist)\/([A-Za-z0-9]+)\/?$/);
  return match ? { kind: match[1], id: match[2] } : null;
}

function parseEmbed(html, target) {
  const script = html.match(/<script\b[^>]*\bid=["']__NEXT_DATA__["'][^>]*>([\s\S]*?)<\/script>/i);
  if (!script) throw new Error('Spotify no publicó las canciones. Comprueba que el enlace sea público.');
  const entity = JSON.parse(script[1])?.props?.pageProps?.state?.data?.entity;
  const rows = target.kind === 'track'
    ? [{ title: entity?.name || entity?.title, subtitle: entity?.artists?.map(a => a.name).join(', ') || entity?.subtitle,
         uri: entity?.uri, duration: entity?.duration }]
    : entity?.trackList || [];
  const tracks = rows.filter(t => t.title && t.uri?.startsWith('spotify:track:')).map(t => ({
    id: t.uri, title: t.title, uploader: t.subtitle || '',
    query: [t.title, t.subtitle].filter(Boolean).join(' '),
    duration: Number(t.duration || 0) / 1000,
    url: 'https://open.spotify.com/track/' + t.uri.split(':').pop(),
    source: 'spotify', pendingResolve: true,
  }));
  if (!tracks.length) throw new Error('La playlist es privada, está vacía o no expone canciones públicas.');
  return { tracks, publicOnly: target.kind !== 'track' };
}

async function read(value, fetcher = fetch) {
  const target = parseSpotifyUrl(value);
  if (!target) return null;
  const response = await fetcher('https://open.spotify.com/embed/' + target.kind + '/' + target.id, {
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) throw new Error('Spotify no permitió leer el enlace (HTTP ' + response.status + ').');
  return parseEmbed(await response.text(), target);
}

module.exports = { read, parseSpotifyUrl, parseEmbed };
