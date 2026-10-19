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
async function card({ text, author }) {
  const canvas = createCanvas(900, 560); const ctx = canvas.getContext('2d');
  const image = await avatar(author);
  ctx.fillStyle = '#101015'; ctx.fillRect(0, 0, 900, 500);
  const glow = ctx.createRadialGradient(160, 80, 0, 160, 80, 520); glow.addColorStop(0, '#5865f222'); glow.addColorStop(1, '#10101500'); ctx.fillStyle = glow; ctx.fillRect(0, 0, 900, 500);
  ctx.fillStyle = '#5865f2'; ctx.font = '700 108px "XYB Quote Roboto"'; ctx.fillText('“', 62, 145);
  ctx.fillStyle = '#f5f5f7'; ctx.font = '700 42px "XYB Quote Roboto"';
  const quoteLines = crop(lines(ctx, String(text).trim().slice(0, 900), 760), 6);
  quoteLines.forEach((line, index) => ctx.fillText(line, 80, 145 + (index * 53)));
  const authorY = Math.min(465, 180 + (quoteLines.length * 53));
  ctx.fillStyle = '#292932'; ctx.fillRect(80, authorY - 10, 740, 2);
  ctx.save(); ctx.beginPath(); ctx.arc(118, authorY + 45, 30, 0, Math.PI * 2); ctx.clip();
  if (image) ctx.drawImage(image, 88, authorY + 15, 60, 60); else { ctx.fillStyle = '#5865f2'; ctx.fillRect(88, authorY + 15, 60, 60); }
  ctx.restore();
  const name = String(author?.globalName ?? author?.username ?? 'Usuario').slice(0, 42);
  const handle = `@${String(author?.username ?? author?.id ?? 'usuario').slice(0, 48)}`;
  ctx.fillStyle = '#ffffff'; ctx.font = '700 25px "XYB Quote Roboto"'; ctx.fillText(name, 166, authorY + 39);
  ctx.fillStyle = '#a9a9b5'; ctx.font = '400 20px "XYB Quote Roboto"'; ctx.fillText(handle, 166, authorY + 68);
  const file = 'quote.png'; const attachment = new AttachmentBuilder(canvas.toBuffer('image/png'), { name: file });
  return { embeds: [new EmbedBuilder().setColor(0x5865F2).setImage(`attachment://${file}`).setFooter({ text: '🐰 xyb quote' })], files: [attachment], allowedMentions: { parse: [] } };
}
module.exports = { card };
