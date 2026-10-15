const { EmbedBuilder } = require('discord.js');

module.exports = {
  name: 'avatar',
  aliases: ['av', 'pfp', 'foto'],
  description: 'Muestra el avatar de alguien en grande.',
  usage: 'xyb avatar [persona]',
  slash: {
    description: 'Muestra el avatar de alguien en grande.',
    setup(builder) {
      return builder.addUserOption((option) => option
        .setName('usuario')
        .setDescription('Persona cuyo avatar quieres ver.'));
    },
  },

  async execute({ target, user, reply }) {
    const person = target ?? user;
    const png = person.displayAvatarURL({ size: 1024, extension: 'png' });
    const embed = new EmbedBuilder()
      .setColor(0x2B2D31)
      .setAuthor({ name: `${person.username} (${person.id})`, iconURL: person.displayAvatarURL({ size: 128 }) })
      .setDescription(`[Abrir avatar en tamaño completo](${png})`)
      .setImage(person.displayAvatarURL({ size: 1024 }))
      .setFooter({ text: '🐰 xyb' });

    await reply({ embeds: [embed] });
  },
};
