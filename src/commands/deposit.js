const {
  ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder,
  ModalBuilder, TextInputBuilder, TextInputStyle,
} = require('discord.js');
const economy = require('../lib/economy');

function view(guildId, userId) {
  const data = economy.get(guildId, userId);
  const capacity = economy.bankCapacity(guildId, userId);
  const nextUpgrade = economy.productFor('bank', data);
  const embed = new EmbedBuilder()
    .setColor(0x55D6BE)
    .setTitle('🏦 Banco XYB')
    .setDescription('Administra tus monedas desde este menú.')
    .addFields(
      { name: '👛 Bolsillo', value: `**${data.wallet}** monedas`, inline: true },
      { name: '🏦 Banco', value: `**${data.bank} / ${capacity}** monedas`, inline: true },
      { name: '💰 Total', value: `**${economy.total(data)}** monedas`, inline: true },
      { name: '📥 Puedes depositar', value: `**${Math.min(data.wallet, Math.max(0, capacity - data.bank))}**`, inline: true },
      { name: '📤 Puedes retirar', value: `**${data.bank}**`, inline: true },
      { name: '⬆️ Próxima mejora', value: nextUpgrade.maxed ? '**Nivel máximo**' : `**${nextUpgrade.name}** · ${nextUpgrade.price} monedas`, inline: false },
    )
    .setFooter({ text: 'Usa los botones para depositar o retirar una cantidad exacta.' });
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`bank:deposit:all:${userId}`).setLabel('Depositar todo').setEmoji('📥').setStyle(ButtonStyle.Success).setDisabled(data.wallet <= 0 || data.bank >= capacity),
    new ButtonBuilder().setCustomId(`bank:deposit:custom:${userId}`).setLabel('Depositar cantidad').setEmoji('➕').setStyle(ButtonStyle.Primary).setDisabled(data.wallet <= 0 || data.bank >= capacity),
    new ButtonBuilder().setCustomId(`bank:withdraw:all:${userId}`).setLabel('Retirar todo').setEmoji('📤').setStyle(ButtonStyle.Secondary).setDisabled(data.bank <= 0),
    new ButtonBuilder().setCustomId(`bank:withdraw:custom:${userId}`).setLabel('Retirar cantidad').setEmoji('➖').setStyle(ButtonStyle.Primary).setDisabled(data.bank <= 0),
  );
  return { embeds: [embed], components: [row] };
}

function resultText(action, result) {
  if (!result.ok) return result.reason === 'full'
    ? `🏦 Tu banco está lleno (**${result.record.bank}/${result.capacity}**).`
    : '💸 No tienes esa cantidad disponible.';
  return `✅ ${action === 'deposit' ? 'Depositaste' : 'Retiraste'} **${result.coins}** monedas. Ahora tienes 👛 **${result.record.wallet}** · 🏦 **${result.record.bank}/${result.capacity}**.${result.limited ? ' Guardé solo lo que cabía.' : ''}`;
}

function modal(action, userId) {
  const input = new TextInputBuilder().setCustomId('amount').setLabel(action === 'deposit' ? '¿Cuánto quieres depositar?' : '¿Cuánto quieres retirar?').setPlaceholder('Escribe un número o “all”').setStyle(TextInputStyle.Short).setRequired(true);
  return new ModalBuilder().setCustomId(`bank:modal:${action}:${userId}`).setTitle(action === 'deposit' ? 'Depositar monedas' : 'Retirar monedas').addComponents(new ActionRowBuilder().addComponents(input));
}

module.exports = {
  name: 'deposit', aliases: ['depositar', 'bankmenu'], description: 'Abre el menú visual de tu banco.', usage: 'xyb deposit', guildOnly: true,
  slash: { description: 'Abre el menú de tu banco.' },
  async execute({ guild, user, reply }) { return reply(view(guild.id, user.id)); },
  async handleComponent(interaction) {
    const id = interaction.customId ?? '';
    if (!id.startsWith('bank:')) return false;
    const parts = id.split(':');
    const action = parts[2];
    const ownerId = parts[3];
    if (ownerId && ownerId !== interaction.user.id) {
      await interaction.reply({ content: 'Este menú de banco pertenece a otra persona.', ephemeral: true });
      return true;
    }
    if (interaction.isButton?.()) {
      if (parts[1] === 'deposit' || parts[1] === 'withdraw') {
        if (action === 'custom') {
          await interaction.showModal(modal(parts[1], interaction.user.id));
          return true;
        }
        const result = parts[1] === 'deposit'
          ? economy.deposit(interaction.guildId, interaction.user.id, 'all')
          : economy.withdraw(interaction.guildId, interaction.user.id, 'all');
        await interaction.update({ content: resultText(parts[1], result), ...view(interaction.guildId, interaction.user.id) });
        return true;
      }
    }
    if (interaction.isModalSubmit?.() && parts[1] === 'modal') {
      const value = interaction.fields.getTextInputValue('amount');
      const result = action === 'deposit'
        ? economy.deposit(interaction.guildId, interaction.user.id, value)
        : economy.withdraw(interaction.guildId, interaction.user.id, value);
      await interaction.reply({ content: resultText(action, result), ...view(interaction.guildId, interaction.user.id) });
      return true;
    }
    return false;
  },
};
