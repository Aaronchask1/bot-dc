const { PermissionFlagsBits } = require('discord.js');
const welcome = require('../lib/welcome');

module.exports = {
  name: 'welcome',
  aliases: ['wlc', 'bienvenida'],
  description: 'Abre el panel para configurar la bienvenida del servidor.',
  usage: 'xyb welcome',
  permissions: [PermissionFlagsBits.ManageGuild],
  guildOnly: true,
  slash: { description: 'Abre el panel para configurar la bienvenida del servidor.' },

  async execute({ guild, reply }) {
    await reply({
      content: '👋 **Panel de bienvenida** — los cambios se guardan al instante.',
      embeds: [welcome.panelEmbed(welcome.getConfig(guild.id))],
      components: welcome.panelRows(),
    });
  },
};
