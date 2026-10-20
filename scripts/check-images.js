// Comprueba que las imágenes existan y mide su tamaño real: Discord las muestra
// a su resolución nativa, así que un GIF de 200 px se ve diminuto.
// Uso: npm run check:images
const { KISS_IMAGES, KISS_GIFT_IMAGES, KISS_REJECT_IMAGES } = require('../src/index');
const hugs = require('../src/lib/hugs');
const marriage = require('../src/lib/marriage-props');

const pools = {
  beso: { images: KISS_IMAGES, minWidth: 300 },
  regalo: { images: KISS_GIFT_IMAGES, minWidth: 300 },
  rechazo: { images: KISS_REJECT_IMAGES, minWidth: 200 },
  abrazo: { images: hugs.HUG_IMAGES, minWidth: 200 },
  propuesta: { images: marriage.PROPOSE_IMAGES, minWidth: 200 },
  matrimonio: { images: marriage.ACCEPT_IMAGES, minWidth: 200 },
  matrimonioRechazado: { images: marriage.REJECT_IMAGES, minWidth: 200 },
};

function gifSize(buffer) {
  if (buffer.slice(0, 3).toString() !== 'GIF') return null;
  return { width: buffer.readUInt16LE(6), height: buffer.readUInt16LE(8) };
}

function pngSize(buffer) {
  if (buffer.readUInt32BE(0) !== 0x89504e47) return null;
  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
}

function jpegSize(buffer) {
  if (buffer[0] !== 0xff || buffer[1] !== 0xd8) return null;
  let offset = 2;
  while (offset < buffer.length - 9) {
    if (buffer[offset] !== 0xff) {
      offset += 1;
      continue;
    }
    const marker = buffer[offset + 1];
    const length = buffer.readUInt16BE(offset + 2);
    // SOF0..SOF15 salvo los marcadores que no son "start of frame".
    if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
      return { height: buffer.readUInt16BE(offset + 5), width: buffer.readUInt16BE(offset + 7) };
    }
    offset += 2 + length;
  }
  return null;
}

async function measure(url) {
  try {
    const response = await fetch(url, {
      headers: { 'user-agent': 'Mozilla/5.0 (compatible; XYB/1.0; +https://discord.com)' },
    });
    if (!response.ok) return { url, error: response.status };
    const buffer = Buffer.from(await response.arrayBuffer());
    const size = gifSize(buffer) ?? pngSize(buffer) ?? jpegSize(buffer);
    return { url, size, bytes: buffer.length };
  } catch (error) {
    return { url, error: error.message };
  }
}

async function main() {
  let broken = 0;
  let small = 0;

  for (const [name, { images, minWidth }] of Object.entries(pools)) {
    const results = [];
    // El CDN de los GIF de interacciones devuelve 428 si recibe demasiadas
    // descargas a la vez. Una por una tarda un poco más, pero mide de verdad.
    for (const url of images) {
      results.push(await measure(url));
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
    const sized = results.filter((result) => result.size);
    const tooSmall = sized.filter((result) => result.size.width < minWidth);
    broken += results.filter((result) => result.error).length;
    small += tooSmall.length;

    const widths = sized.map((result) => result.size.width);
    const average = widths.length ? Math.round(widths.reduce((sum, value) => sum + value, 0) / widths.length) : 0;

    console.log(`${name}: ${sized.length}/${images.length} medidas · ancho promedio ${average}px · ${tooSmall.length} por debajo de ${minWidth}px`);
    for (const result of results.filter((item) => item.error)) console.log(`  ✗ caída (${result.error}) ${result.url}`);
    for (const result of tooSmall) console.log(`  ⚠ ${result.size.width}x${result.size.height} ${result.url}`);
  }

  const all = Object.values(pools).flatMap(({ images }) => images);
  const repeated = all.filter((url, index) => all.indexOf(url) !== index);
  if (repeated.length) {
    console.log(`\n⚠ ${repeated.length} URL(s) repetidas entre listas:`);
    for (const url of new Set(repeated)) console.log(`  - ${url}`);
    process.exitCode = 1;
  }

  if (broken) {
    console.log(`\n${broken} imagen(es) caída(s).`);
    process.exitCode = 1;
  } else {
    console.log(`\n${all.length} imágenes, todas vivas.${small ? ` ${small} chiquita(s) para sacarlas.` : ''}`);
  }
}

main();
