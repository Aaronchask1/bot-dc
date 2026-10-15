const { EmbedBuilder } = require('discord.js');

// Discord solo manda el banner en la respuesta del gateway, así que hay que
// consultarlo. Se cachea unos minutos para no gastar rate limit a lo bruto.
const CACHE_MS = 5 * 60_000;
const userCache = new Map();

async function fetchUserWithBanner(client, user) {
  const cached = userCache.get(user.id);
  if (cached && Date.now() - cached.at < CACHE_MS) return cached.user;
  const fresh = await client.users.fetch(user.id, { force: true });
  userCache.set(user.id, { user: fresh, at: Date.now() });
  return fresh;
}

module.exports = {
  name: 'banner',
  aliases: ['bn', 'fondo'],
  description: 'Muestra el banner de alguien (imagen de perfil de Nitro).',
  usage: 'xyb banner [persona]',
  slash: {
    description: 'Muestra el banner de alguien.',
    setup(builder) {
      return builder.addUserOption((option) => option
        .setName('usuario')
        .setDescription('Persona cuyo banner quieres ver.'));
    },
  },

  async execute({ target, user, client, reply, fail }) {
    const person = target ?? user;
    let fresh;
    try {
      fresh = await fetchUserWithBanner(client, person);
    } catch (error) {
      return fail('No pude consultar ese usuario. Inténtalo de nuevo en un momento.');
    }

    const banner = fresh.bannerURL({ size: 1024 });
    if (!banner) return fail(`${fresh.username} no tiene banner.`);

    const embed = new EmbedBuilder()
      .setColor(0x2B2D31)
      .setAuthor({ name: `${fresh.username} (${fresh.id})`, iconURL: fresh.displayAvatarURL({ size: 128 }) })
      .setDescription(`[Abrir banner en tamaño completo](${banner})`)
      .setImage(banner)
      .setFooter({ text: '🐰 xyb' });

    await reply({ embeds: [embed] });
  },
};

module.exports.fetchUserWithBanner = fetchUserWithBanner;
