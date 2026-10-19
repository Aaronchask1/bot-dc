const economy = require('../lib/economy');

module.exports = {
  name: 'mine', aliases: ['minar', 'mineria'], description: 'Mina minerales con tu pico y gana monedas.', usage: 'xyb mine', guildOnly: true,
  slash: { description: 'Mina minerales y gana monedas.' },
  async execute({ guild, user, reply }) {
    const result = economy.mine(guild.id, user.id);
    if (!result.ok) {
      if (result.reason === 'pickaxe') return reply('⛏️ Primero compra un pico en `xyb shop` por **300** monedas.');
      return reply(`⛏️ La mina se está enfriando; vuelve en **${economy.relative(result.wait)}**.`);
    }
    return reply(`⛏️ Encontraste **${result.ore}** y ganaste **${result.coins}** monedas con tu ${result.tool.name}. Vuelve en **${economy.relative(economy.COOLDOWNS.mine)}**.`);
  },
};
