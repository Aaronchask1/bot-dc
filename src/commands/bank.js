const economy = require('../lib/economy');
const depositMenu = require('./deposit');

module.exports = { name: 'bank', aliases: ['banco'], description: 'Abre el menú del banco o mueve monedas.', usage: 'xyb bank | deposit cantidad | withdraw cantidad', guildOnly: true,
  slash: { description: 'Abre el menú del banco o mueve monedas.', setup(builder) { return builder.addStringOption((option) => option.setName('accion').setDescription('deposit o withdraw').setRequired(false).addChoices({ name: 'Depositar', value: 'deposit' }, { name: 'Retirar', value: 'withdraw' })).addStringOption((option) => option.setName('cantidad').setDescription('Número o all').setRequired(false)); } },
  async execute({ args, isSlash, interaction, guild, user, reply }) {
    const action = (isSlash ? interaction.options.getString('accion') : args[0] || '').toLowerCase();
    if (!action) return depositMenu.execute({ guild, user, reply });
    const value = isSlash ? interaction.options.getString('cantidad') : args[1];
    const result = ['deposit', 'depositar'].includes(action) ? economy.deposit(guild.id, user.id, value) : ['withdraw', 'retirar'].includes(action) ? economy.withdraw(guild.id, user.id, value) : null;
    if (!result) return reply('Uso: `xyb bank` para abrir el menú, `xyb bank deposit 100` o `xyb bank withdraw all`.');
    if (!result.ok) return reply(result.reason === 'full' ? `🏦 Tu banco está lleno: **${result.record.bank}/${result.capacity}**.` : 'No tienes esa cantidad disponible.');
    return reply(`🏦 ${action.startsWith('deposit') ? 'Guardaste' : 'Retiraste'} **${result.coins}** monedas. Bolsillo: **${result.record.wallet}** · banco: **${result.record.bank}/${result.capacity}**.${result.limited ? ' Guardé solo lo que cabía.' : ''}`);
  },
};
