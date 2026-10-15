const { EmbedBuilder } = require('discord.js');

module.exports = {
  name: 'wife',
  aliases: ['esposa', 'marido', 'pareja', 'novio', 'novia'],
  description: 'Mira con quién estás casada(o).',
  usage: 'xyb wife [persona]',
  guildOnly: true,
  slash: {
    description: 'Mira con quién estás casada(o).',
    setup(builder) {
      return builder.addUserOption((option) => option
        .setName('persona')
        .setDescription('De quién quieres saber.'));
    },
  },

  async execute({ target, user, guild, reply }) {
    const subject = target ?? user;
    const partner = marriagePartner(guild.id, subject.id);
    await reply({ embeds: [partner ? partnerEmbed(partner, partner.since) : SOLTERO] });
  },
};

const marriage = require('../lib/marriage');

function marriagePartner(guildId, userId) {
  return marriage.getPartner(guildId, userId);
}

const SOLTERO = new EmbedBuilder()
  .setColor(0xED4245)
  .setTitle('💍 Soltero/a')
  .setDescription('Todavía nadie te ha pedido la mano. Usa `xyb marry @persona`.');

function partnerEmbed(partner, since) {
  return new EmbedBuilder()
    .setColor(0xFFB6C1)
    .setTitle('💍 Estado civil')
    .setDescription(`Casado/a con <@${partner.id}>`)
    .addFields({ name: '💞 Desde', value: `<t:${Math.floor(since / 1000)}:R>`, inline: true })
    .setFooter({ text: '🐰 xyb' });
}
