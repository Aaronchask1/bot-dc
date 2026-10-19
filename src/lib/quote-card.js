const { createCanvas, loadImage, GlobalFonts } = require('@napi-rs/canvas');
const { AttachmentBuilder, EmbedBuilder } = require('discord.js');

GlobalFonts.registerFromPath(require.resolve('@fontsource/roboto/files/roboto-latin-400-normal.woff'), 'XYB Quote Roboto');
GlobalFonts.registerFromPath(require.resolve('@fontsource/roboto/files/roboto-latin-700-normal.woff'), 'XYB Quote Roboto');

function avatarUrl(person) {
  return person?.displayAvatarURL?.({ extension: 'png', size: 256, forceStatic: true })
    ?? 'https://cdn.discordapp.com/embed/avatars/0.png';
}
async function avatar(person) {
  try { return await Promise.race([loadImage(avatarUrl(person)), new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 1500))]); } catch { return null; }
}
function lines(ctx, text, width) {
  const result = [];
  for (const paragraph of String(text).replace(/\r/g, '').split('\n')) {
    let line = '';
    for (const word of paragraph.split(/\s+/)) {
      const next = line ? `${line} ${word}` : word;
      if (ctx.measureText(next).width <= width || !line) line = next;
      else { result.push(line); line = word; }
    }
    result.push(line || ' ');
  }
  return result;
}
function crop(linesToCrop, max) { return linesToCrop.length > max ? [...linesToCrop.slice(0, max - 1), `${linesToCrop[max - 1].slice(0, -1)}…`] : linesToCrop; }
function drawCover(ctx, image, x, y, width, height) {
  if (!image) { ctx.fillStyle = '#25252d'; ctx.fillRect(x, y, width, height); return; }
  try {
    const scale = Math.max(width / image.width, height / image.height);
    const drawWidth = image.width * scale; const drawHeight = image.height * scale;
    ctx.drawImage(image, x + ((width - drawWidth) / 2), y + ((height - drawHeight) / 2), drawWidth, drawHeight);
  } catch {
    // Un avatar remoto corrupto nunca debe impedir crear la tarjeta.
    ctx.fillStyle = '#25252d'; ctx.fillRect(x, y, width, height);
  }
}
async function card({ text, author, font = 'satoshi', color = 'white', layout = 'wide' }) {
  const wide = layout === 'wide'; const width = wide ? 1100 : 900; const height = wide ? 560 : 720;
  const imageWidth = wide ? 470 : width; const textX = wide ? 550 : 76; const textWidth = wide ? 470 : width - 152;
  const canvas = createCanvas(width, height); const ctx = canvas.getContext('2d');
  const image = await avatar(author);
  const palette = color === 'purple' ? { bg: '#16121f', ink: '#f5efff', muted: '#b9a9d3', mark: '#c084fc' } : color === 'cream' ? { bg: '#f5efe3', ink: '#24201b', muted: '#796f62', mark: '#bb7c37' } : { bg: '#101015', ink: '#f5f5f7', muted: '#a9a9b5', mark: '#6b6b75' };
  ctx.fillStyle = palette.bg; ctx.fillRect(0, 0, width, height);
  if (wide) {
    drawCover(ctx, image, 0, 0, imageWidth, height);
    const fade = ctx.createLinearGradient(imageWidth - 115, 0, imageWidth + 80, 0); fade.addColorStop(0, '#00000000'); fade.addColorStop(1, palette.bg); ctx.fillStyle = fade; ctx.fillRect(imageWidth - 115, 0, 195, height);
  } else { drawCover(ctx, image, 0, 0, width, 260); ctx.fillStyle = '#00000075'; ctx.fillRect(0, 0, width, 260); }
  const fontFamily = font === 'classic' ? 'serif' : '"XYB Quote Roboto"';
  const baseY = wide ? 185 : 365;
  ctx.fillStyle = palette.mark; ctx.font = `700 106px ${fontFamily}`; ctx.fillText('“', textX, baseY - 55);
  ctx.fillStyle = palette.ink; ctx.font = `700 ${wide ? 45 : 42}px ${fontFamily}`;
  const quoteLines = crop(lines(ctx, String(text).trim().slice(0, 900), textWidth), wide ? 5 : 5);
  quoteLines.forEach((line, index) => ctx.fillText(line, textX, baseY + (index * 56)));
  const authorY = Math.min(height - 120, baseY + (quoteLines.length * 56) + 42);
  ctx.fillStyle = `${palette.muted}77`; ctx.fillRect(textX, authorY - 15, textWidth, 2);
  const name = String(author?.globalName ?? author?.username ?? 'Usuario').slice(0, 42);
  const handle = `@${String(author?.username ?? author?.id ?? 'usuario').slice(0, 48)}`;
  ctx.fillStyle = palette.ink; ctx.font = `700 25px ${fontFamily}`; ctx.fillText(`— ${name}`, textX, authorY + 25);
  ctx.fillStyle = palette.muted; ctx.font = `400 20px ${fontFamily}`; ctx.fillText(handle, textX, authorY + 55);
  const file = 'quote.png'; const attachment = new AttachmentBuilder(canvas.toBuffer('image/png'), { name: file });
  return { embeds: [new EmbedBuilder().setColor(0x5865F2).setImage(`attachment://${file}`).setFooter({ text: '🐰 xyb quote' })], files: [attachment], allowedMentions: { parse: [] } };
}
module.exports = { card };
