const { EmbedBuilder } = require('discord.js');

function colorFor(latency) {
  if (latency < 100) return 0x2ECC71;
  if (latency < 200) return 0xF1C40F;
  return 0xE74C3C;
}

module.exports = {
  name: 'ping',
  aliases: ['ms', 'latencia'],
  description: 'Muestra la latencia del bot.',
  usage: 'xyb ping',
  slash: { description: 'Muestra la latencia del bot.' },

  async execute({ isSlash, message, interaction, client, user, reply, defer }) {
    if (isSlash) await defer();

    const provisional = await (isSlash
      ? interaction.editReply({ content: '🏓 Calculando latencia...', embeds: [] })
      : message.channel.send('🏓 Calculando latencia...'));

    const roundTrip = Math.max(provisional.createdTimestamp - (isSlash ? interaction.createdTimestamp : message.createdTimestamp), 0);
    const gateway = Math.round(client.ws.ping ?? 0);

    const embed = new EmbedBuilder()
      .setColor(colorFor(roundTrip))
      .setTitle('🏓 Ping')
      .addFields(
        { name: 'Latencia de mensaje', value: `\`${roundTrip} ms\``, inline: true },
        { name: 'Latencia del gateway', value: `\`${gateway} ms\``, inline: true },
      )
      .setFooter({ text: `Medido para ${user.tag} · 🐰 xyb` })
      .setTimestamp();

    await provisional.edit({ content: null, embeds: [embed] });
  },
};
