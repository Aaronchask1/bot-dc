const economy = require('../lib/economy');
module.exports = { name: 'work', aliases: ['trabajo', 'trabajar'], description: 'Trabaja y gana monedas cada 5 minutos.', usage: 'xyb work', guildOnly: true,
  slash: { description: 'Trabaja y gana monedas.' }, async execute({ guild, user, reply }) { const result = economy.claim(guild.id, user.id, 'work'); if (!result.ok) return reply(`💼 Ya trabajaste; vuelve en **${economy.relative(result.wait)}**.`); const danger = result.accident ? (result.accident.protected ? '\n🛡️ Tu seguro te salvó de un accidente.' : `\n💀 Tuviste un accidente y perdiste **${result.accident.lost}** del bolsillo. El banco quedó protegido.`) : ''; return reply(`💼 ${user}, ${result.text} y ganaste **${result.coins}** monedas.${danger}`); },
};
