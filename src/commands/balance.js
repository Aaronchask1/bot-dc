const economy = require('../lib/economy');
module.exports = { name: 'balance', aliases: ['bal', 'money', 'saldo'], description: 'Muestra tus monedas y banco.', usage: 'xyb balance [@persona]', guildOnly: true, resolveMember: true,
  slash: { description: 'Muestra el saldo.', setup(builder) { return builder.addUserOption((option) => option.setName('usuario').setDescription('Persona')); } },
  async execute({ user, target, isSlash, interaction, guild, reply }) { const person = isSlash ? (interaction.options.getUser('usuario') ?? user) : (target ?? user); const data = economy.get(guild.id, person.id); return reply(`💰 **Saldo de ${person.username}:** bolsillo **${data.wallet}** · banco **${data.bank}** · total **${economy.total(data)}** monedas.`); },
};
