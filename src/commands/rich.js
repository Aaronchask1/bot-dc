const economy = require('../lib/economy');
module.exports = { name: 'rich', aliases: ['ricos', 'leaderboard', 'topcoins'], description: 'Muestra el ranking de monedas del servidor.', usage: 'xyb rich', guildOnly: true,
  slash: { description: 'Muestra el ranking de monedas.' }, async execute({ guild, reply }) { const rows = economy.leaderboard(guild.id); return reply(rows.length ? `🏆 **Ranking de monedas**\n${rows.map((row, index) => `**${index + 1}.** <@${row.userId}> — **${economy.total(row)}** monedas`).join('\n')}` : '🏆 Aún no hay monedas en este servidor. Usa `xyb work` o `xyb fish`.'); },
};
