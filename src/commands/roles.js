const { EmbedBuilder, PermissionFlagsBits } = require('discord.js');

const PER_PAGE = 20;

module.exports = {
  name: 'roles',
  aliases: ['roleslist', 'listroles'],
  description: 'Muestra los roles del servidor.',
  usage: 'xyb roles',
  guildOnly: true,
  permissions: [PermissionFlagsBits.ManageGuild],
  slash: { description: 'Muestra los roles del servidor.' },

  async execute({ guild, reply }) {
    const roles = [...guild.roles.cache.values()]
      .filter((role) => role.id !== guild.id)
      .sort((first, second) => second.position - first.position);

    if (!roles.length) {
      await reply('Este servidor no tiene roles.');
      return;
    }

    const embed = new EmbedBuilder()
      .setColor(0x2B2D31)
      .setAuthor({ name: guild.name, iconURL: guild.iconURL({ size: 128 }) || undefined })
      .setTitle(`🎭 ${roles.length} roles`)
      .setDescription(
        roles
          .slice(0, PER_PAGE)
          .map((role) => `${role} \`${role.id}\`${role.managed ? ' *(gestionado por integración)*' : ''}`)
          .join('\n') || 'Sin roles.',
      )
      .setFooter({ text: `Mostrando ${Math.min(PER_PAGE, roles.length)} de ${roles.length} · 🐰 xyb` });

    await reply({ embeds: [embed] });
  },
};
