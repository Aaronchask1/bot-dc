const { createCanvas, loadImage, GlobalFonts } = require('@napi-rs/canvas');
const { AttachmentBuilder, EmbedBuilder } = require('discord.js');

// Railway's container does not guarantee a system font. Bundle Roboto with the
// bot and register it before drawing so card labels never disappear in production.
GlobalFonts.registerFromPath(require.resolve('@fontsource/roboto/files/roboto-latin-400-normal.woff'), 'XYB Roboto');
GlobalFonts.registerFromPath(require.resolve('@fontsource/roboto/files/roboto-latin-700-normal.woff'), 'XYB Roboto');

const avatars = new Map();
const AVATAR_TTL = 5 * 60_000;

function avatarUrl(person) {
  return person?.displayAvatarURL?.({ extension: 'png', size: 256, forceStatic: true })
    ?? 'https://cdn.discordapp.com/embed/avatars/0.png';
}
async function avatar(person) {
  const url = avatarUrl(person); const cached = avatars.get(url);
  if (cached && cached.until > Date.now()) return cached.image;
  try {
    const image = await Promise.race([
      loadImage(url), new Promise((_, reject) => setTimeout(() => reject(new Error('avatar timeout')), 1500)),
    ]);
    avatars.set(url, { image, until: Date.now() + AVATAR_TTL });
    while (avatars.size > 100) avatars.delete(avatars.keys().next().value);
    return image;
  } catch { return null; }
}
function circle(ctx, image, x, y, color) {
  ctx.save(); ctx.beginPath(); ctx.arc(x, y, 72, 0, Math.PI * 2); ctx.closePath(); ctx.clip();
  if (image) ctx.drawImage(image, x - 72, y - 72, 144, 144);
  else { ctx.fillStyle = color; ctx.fillRect(x - 72, y - 72, 144, 144); }
  ctx.restore(); ctx.lineWidth = 5; ctx.strokeStyle = '#fff4fa'; ctx.beginPath(); ctx.arc(x, y, 74, 0, Math.PI * 2); ctx.stroke();
}
function trim(value, max = 28) { const text = String(value ?? 'Usuario'); return text.length > max ? `${text.slice(0, max - 1)}…` : text; }
async function card({ left, right, title, subtitle, badge = '💗', color = '#f48fb1', file = 'xyb-card.png' }) {
  const canvas = createCanvas(800, 300); const ctx = canvas.getContext('2d');
  const gradient = ctx.createLinearGradient(0, 0, 800, 300); gradient.addColorStop(0, '#211827'); gradient.addColorStop(0.5, '#493143'); gradient.addColorStop(1, '#211827'); ctx.fillStyle = gradient; ctx.fillRect(0, 0, 800, 300);
  ctx.fillStyle = `${color}33`; ctx.beginPath(); ctx.arc(400, 150, 145, 0, Math.PI * 2); ctx.fill();
  const [leftAvatar, rightAvatar] = await Promise.all([avatar(left), avatar(right)]);
  circle(ctx, leftAvatar, 145, 152, '#f48fb1'); circle(ctx, rightAvatar, 655, 152, '#a7d8ff');
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#fff7fb'; ctx.font = '700 30px "XYB Roboto"'; ctx.fillText(badge, 400, 78);
  ctx.font = '700 48px "XYB Roboto"'; ctx.fillStyle = color; ctx.fillText(trim(title, 26), 400, 145);
  ctx.font = '400 21px "XYB Roboto"'; ctx.fillStyle = '#f7dce8'; ctx.fillText(trim(subtitle, 52), 400, 190);
  ctx.font = '700 19px "XYB Roboto"'; ctx.fillStyle = '#ffffff'; ctx.fillText(trim(left?.globalName ?? left?.username), 145, 260); ctx.fillText(trim(right?.globalName ?? right?.username), 655, 260);
  const attachment = new AttachmentBuilder(canvas.toBuffer('image/png'), { name: file });
  const embed = new EmbedBuilder().setColor(color.replace('#', '')).setImage(`attachment://${file}`).setFooter({ text: '🐰 xyb' });
  return { embeds: [embed], files: [attachment], allowedMentions: { parse: [] } };
}
module.exports = { card };
