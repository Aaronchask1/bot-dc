const { PermissionFlagsBits } = require('discord.js');
const welcome = require('../lib/welcome');

module.exports = {
  name: 'welcometest',
  aliases: ['wlcprueba', 'probarbienvenida'],
  description: 'Muestra cómo quedaría la bienvenida sin guardarla.',
  usage: 'xyb welcometest',
  permissions: [PermissionFlagsBits.ManageGuild],
  guildOnly: true,
  slash: { description: 'Muestra cómo quedaría la bienvenida sin guardarla.' },

  async execute({ guild, member, reply }) {
    const config = welcome.getConfig(guild.id);
    if (!config.channel) {
      await reply('Todavía no hay un canal de bienvenida configurado. Usa `xyb welcome` primero.');
      return;
    }
    await reply({
      content: '👀 Así se verá (no se envía al canal configurado):',
      ...welcome.buildPayload(member, config),
    });
  },
};
