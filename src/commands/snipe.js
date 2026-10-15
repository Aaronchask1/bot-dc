const { EmbedBuilder } = require('discord.js');
const snipe = require('../lib/snipe');

module.exports = {
  name: 'snipe',
  aliases: ['s', 'recuperar'],
  description: 'Recupera un mensaje borrado del canal.',
  usage: 'xyb snipe [número]',
  guildOnly: true,
  slash: {
    description: 'Recupera un mensaje borrado del canal.',
    setup(builder) {
      return builder.addIntegerOption((option) => option
        .setName('numero')
        .setDescription('Cuál quieres ver: 1 es el último.'));
    },
  },

  async execute({ channel, args, isSlash, interaction, reply, fail }) {
    const list = snipe.listFor(channel.id);
    if (!list.length) {
      await fail('>×< No guardé ningún mensaje borrado en este canal.');
      return;
    }

    const requested = isSlash ? interaction.options.getInteger('numero') : Number(args[0] ?? 1);
    const position = Number.isInteger(requested) && requested > 0 ? requested : 1;
    const record = list[position - 1];

    if (!record) {
      await fail(`Solo guardé ${list.length} mensaje(s) borrado(s) aquí. Usa \`snipe\` entre 1 y ${list.length}.`);
      return;
    }

    const text = record.content ? (record.content.length > 500 ? `${record.content.slice(0, 500)}…` : record.content) : '*Sin texto*';
    const embed = new EmbedBuilder()
      .setColor(0xED4245)
      .setAuthor({
        name: record.author,
        iconURL: channel.guild?.members?.cache?.get(record.authorId)?.displayAvatarURL({ size: 128 }) ?? undefined,
      })
      .setDescription(text)
      .addFields(
        { name: '👤 Borrado por', value: record.deletedBy ?? 'Desconocido', inline: true },
        { name: '⏰ Publicado', value: `<t:${Math.floor(record.timestamp / 1000)}:R>`, inline: true },
      )
      .setFooter({ text: `Mensaje ${position} de ${list.length} · 🐰 xyb` })
      .setTimestamp();

    if (record.attachments.length) embed.setImage(record.attachments[0]);

    await reply({ embeds: [embed] });
  },
};
