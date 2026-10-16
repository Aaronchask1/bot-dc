const { EmbedBuilder } = require('discord.js');
const cache = new Map();
const pending = new Map();
const failed = new Map();
const MAX_IMAGE = 8 * 1024 * 1024;
const MAX_CACHE = 32 * 1024 * 1024;
let bytes = 0;

async function download(url, fetchImpl) {
  if (cache.has(url)) return cache.get(url);
  if (failed.get(url) > Date.now()) return null;
  if (pending.has(url)) return pending.get(url);
  const task = (async () => {
    try {
      const result = await fetchImpl(url, { signal: AbortSignal.timeout(1500) });
      if (!result.ok || !result.headers.get('content-type')?.startsWith('image/') || Number(result.headers.get('content-length')) > MAX_IMAGE) throw new Error('image');
      let size = 0;
      const chunks = [];
      for await (const chunk of result.body) {
        size += chunk.length;
        if (size > MAX_IMAGE) throw new Error('size');
        chunks.push(chunk);
      }
      if (!size) throw new Error('empty');
      const buffer = Buffer.concat(chunks);
      while (bytes + size > MAX_CACHE && cache.size) {
        const first = cache.keys().next().value;
        bytes -= cache.get(first).length;
        cache.delete(first);
      }
      cache.set(url, buffer);
      bytes += size;
      return buffer;
    } catch {
      failed.set(url, Date.now() + 5 * 60_000);
      return null;
    } finally { pending.delete(url); }
  })();
  pending.set(url, task);
  return task;
}

async function prepareKissPayload(payload, fetchImpl = fetch) {
  const file = payload.files?.[0];
  if (!file || typeof file.attachment !== 'string') return payload;
  const buffer = await download(file.attachment, fetchImpl);
  if (buffer) return { ...payload, files: [{ ...file, attachment: buffer }] };
  // Si el proveedor tarda, envía el mensaje con enlace directo sin bloquear
  // todos los besos mientras discord.js vuelve a descargar la misma imagen.
  return { ...payload, files: [], embeds: payload.embeds.map((embed) => EmbedBuilder.from(embed).setImage(file.attachment)) };
}
module.exports = { prepareKissPayload };
