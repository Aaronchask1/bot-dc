const { EmbedBuilder } = require('discord.js');
const marriage = require('../lib/marriage');

module.exports = {
  name: 'divorce',
  aliases: ['divorciar', 'separarse'],
  description: 'Rompe tu matrimonio actual.',
  usage: 'xyb divorce',
  guildOnly: true,
  slash: { description: 'Rompe tu matrimonio actual.' },

  async execute({ user, guild, fail, reply }) {
    const result = marriage.divorce(guild.id, user.id);
    if (!result.ok) {
      await fail('No estás casada(o) con nadie.');
      return;
    }

    const embed = new EmbedBuilder()
      .setColor(0xED4245)
      .setTitle('💔 Divorcio')
      .setDescription(`${user} y <@${result.partner}> ya no están casados.`)
      .setFooter({ text: 'Suerte la próxima vez · 🐰 xyb' })
      .setTimestamp();
    await reply({ embeds: [embed] });
  },
};
