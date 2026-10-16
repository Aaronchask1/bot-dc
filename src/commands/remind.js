const reminders = require('../lib/reminders');

function listText(userId) {
  const rows = reminders.recordsFor(userId);
  if (!rows.length) return 'No tienes recordatorios activos.';
  return `⏰ **Tus recordatorios**\n${rows.map((row) => `• \`${row.id}\` — <t:${Math.floor(row.at / 1000)}:R>: ${row.text}`).join('\n')}`;
}

module.exports = {
  name: 'remind', aliases: ['reminder', 'recordatorio'], description: 'Programa, lista o elimina recordatorios por DM.', usage: 'xyb remind 10m texto | list | remove ID', guildOnly: false,
  slash: { description: 'Programa un recordatorio por DM.', setup(builder) {
    return builder.addStringOption((option) => option.setName('tiempo').setDescription('Ejemplo: 10m, 2h o 1d').setRequired(true))
      .addStringOption((option) => option.setName('texto').setDescription('Qué quieres recordar').setRequired(true));
  } },
  async execute({ args, user, text, interaction, isSlash, reply }) {
    if (isSlash) {
      const record = reminders.create(user.id, interaction.options.getString('tiempo', true), interaction.options.getString('texto', true));
      if (!record) return reply('Usa de 1m a 30d, por ejemplo: `/remind tiempo:2h texto:tomar agua`.');
      return reply(`⏰ Listo: te escribiré por DM <t:${Math.floor(record.at / 1000)}:R> (ID: \`${record.id}\`).`);
    }
    const [action, ...rest] = args;
    if (!action || ['list', 'lista'].includes(action.toLowerCase())) return reply(listText(user.id));
    if (['remove', 'delete', 'borrar'].includes(action.toLowerCase())) {
      return reply(reminders.remove(user.id, rest[0]) ? '🗑️ Recordatorio eliminado.' : 'No encontré un recordatorio tuyo con ese ID.');
    }
    const record = reminders.create(user.id, action, rest.join(' ') || text.slice(action.length));
    if (!record) return reply('Uso: `xyb remind 10m tomar agua`, `xyb remind list` o `xyb remind remove ID`. El tiempo admite m, h y d.');
    return reply(`⏰ Listo: te escribiré por DM <t:${Math.floor(record.at / 1000)}:R> (ID: \`${record.id}\`).`);
  },
};
