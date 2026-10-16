const economy = require('../lib/economy');
module.exports = { name: 'work', aliases: ['trabajo', 'trabajar'], description: 'Trabaja y gana monedas cada 30 minutos.', usage: 'xyb work', guildOnly: true,
  slash: { description: 'Trabaja y gana monedas.' }, async execute({ guild, user, reply }) { const result = economy.claim(guild.id, user.id, 'work'); return reply(result.ok ? `💼 ${user}, ${result.text} y ganaste **${result.coins}** monedas.` : `💼 Ya trabajaste; vuelve en **${economy.relative(result.wait)}**.`); },
};
