const reminders = require('../lib/reminders');
const { EmbedBuilder } = require('discord.js');

function listText(userId) {
  const rows = reminders.recordsFor(userId);
  if (!rows.length) return 'No tienes recordatorios activos.';
  return `⏰ **Tus recordatorios**\n${rows.map((row) => `• \`${row.id}\` — <t:${Math.floor(row.at / 1000)}:R>: ${row.text}`).join('\n')}`;
}

function confirmation(record, user) {
  const mention = user?.id ? `<@${user.id}>` : (user?.username ?? 'ahí');
  const embed = new EmbedBuilder()
    .setColor(0xE9A6B7)
    .setTitle('⏰ Recordatorio registrado')
    .setDescription(`Te recordaré aquí ${mention}`)
    .addFields(
      { name: '📌 Fijado para', value: `<t:${Math.floor(record.at / 1000)}:F>\n(<t:${Math.floor(record.at / 1000)}:R>)`, inline: false },
      { name: '📝 Mensaje', value: record.text, inline: false },
    )
    .setFooter({ text: `ID: ${record.id}` });
  const avatar = user?.displayAvatarURL?.({ size: 128 });
  if (avatar) embed.setThumbnail(avatar);
  return { embeds: [embed], allowedMentions: { users: user?.id ? [user.id] : [] } };
}

module.exports = {
  name: 'remind', aliases: ['rm', 'reminder', 'recordatorio'], description: 'Programa un recordatorio que te menciona en este canal.', usage: 'xyb remind|rm 30m texto | list | remove ID', guildOnly: true,
  slash: { description: 'Programa un recordatorio en este canal.', setup(builder) {
    return builder.addStringOption((option) => option.setName('tiempo').setDescription('Ejemplo: 10m, 2h o 1d').setRequired(true))
      .addStringOption((option) => option.setName('texto').setDescription('Qué quieres recordar (opcional)').setRequired(false));
  } },
  async execute({ args, user, text, interaction, isSlash, reply, guild, channel }) {
    const location = { guildId: guild.id, channelId: channel.id };
    if (isSlash) {
      const record = reminders.create(user.id, interaction.options.getString('tiempo', true), interaction.options.getString('texto') ?? 'Recordatorio', location);
      if (!record) return reply('Usa de 1 minuto a 24 horas, por ejemplo: `/remind tiempo:2h texto:tomar agua`.');
      return reply(confirmation(record, user));
    }
    const [action, ...rest] = args;
    if (!action || ['list', 'lista'].includes(action.toLowerCase())) return reply(listText(user.id));
    if (['remove', 'delete', 'borrar'].includes(action.toLowerCase())) {
      return reply(reminders.remove(user.id, rest[0]) ? '🗑️ Recordatorio eliminado.' : 'No encontré un recordatorio tuyo con ese ID.');
    }
    const record = reminders.create(user.id, action, rest.join(' ') || text.slice(action.length), location);
    if (!record) return reply('Uso: `xyb rm 30m tomar agua`, `xyb rm list` o `xyb rm remove ID`. El máximo es 24 horas.');
    return reply(confirmation(record, user));
  },
};
