const economy = require('../lib/economy');
module.exports = { name: 'fish', aliases: ['pescar', 'fishing'], description: 'Pesca y colecciona peces cada 10 minutos.', usage: 'xyb fish', guildOnly: true,
  slash: { description: 'Pesca y gana monedas.' }, async execute({ guild, user, reply }) { const result = economy.claim(guild.id, user.id, 'fish'); return reply(result.ok ? `🎣 ${user} pescó **${result.fish}** y ganó **${result.coins}** monedas.` : `🎣 El mar se está calmando; vuelve en **${economy.relative(result.wait)}**.`); },
};
