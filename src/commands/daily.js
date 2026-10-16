const economy = require('../lib/economy');
module.exports = { name: 'daily', aliases: ['diario'], description: 'Reclama 250 monedas cada día.', usage: 'xyb daily', guildOnly: true,
  slash: { description: 'Reclama tu recompensa diaria.' }, async execute({ guild, user, reply }) { const result = economy.claim(guild.id, user.id, 'daily'); return reply(result.ok ? `🎁 ${user}, recibiste **${result.coins}** monedas diarias.` : `🎁 Tu siguiente diaria llega en **${economy.relative(result.wait)}**.`); },
};
