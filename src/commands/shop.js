const { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');
const economy = require('../lib/economy');

function view(guildId, userId) {
  const data = economy.get(guildId, userId);
  const products = economy.shopProducts(data);
  const lines = Object.entries(products).map(([id, item]) => {
    const state = item.maxed ? '✅ máximo' : `💰 **${item.price}**`;
    return `${item.name} — ${state}\n${item.description}`;
  });
  const embed = new EmbedBuilder()
    .setColor(0xFFB347)
    .setTitle('🛒 Tienda XYB')
    .setDescription(`Tu bolsillo: **${data.wallet}** monedas\n\n${lines.join('\n\n')}`)
    .setFooter({ text: 'Compra con los botones o usa xyb shop buy <objeto>.' });
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`shop:buy:${userId}:pickaxe`).setLabel(data.pickaxeLevel ? 'Mejorar pico' : 'Comprar pico').setEmoji('⛏️').setStyle(ButtonStyle.Success).setDisabled(Boolean(products.pickaxe.maxed)),
    new ButtonBuilder().setCustomId(`shop:buy:${userId}:bait`).setLabel('Carnada').setEmoji('🪱').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId(`shop:buy:${userId}:rod`).setLabel(economy.rodLevelFor(data) ? 'Mejorar caña' : 'Comprar caña').setEmoji('🎣').setStyle(ButtonStyle.Primary).setDisabled(Boolean(products.rod.maxed)),
    new ButtonBuilder().setCustomId(`shop:buy:${userId}:insurance`).setLabel('Seguro').setEmoji('🛡️').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(`shop:buy:${userId}:bank`).setLabel('Mejorar banco').setEmoji('🏦').setStyle(ButtonStyle.Success).setDisabled(Boolean(products.bank.maxed)),
  );
  const sellRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`shop:sell:${userId}:fish`).setLabel('Vender peces').setEmoji('🐟').setStyle(ButtonStyle.Danger),
  );
  const petRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`shop:buy:${userId}:egg`).setLabel('Huevo').setEmoji('🥚').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId(`shop:buy:${userId}:apple`).setLabel('Manzana').setEmoji('🍎').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId(`shop:buy:${userId}:banana`).setLabel('Banana').setEmoji('🍌').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId(`shop:buy:${userId}:strawberry`).setLabel('Fresa').setEmoji('🍓').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId(`shop:buy:${userId}:cake`).setLabel('Pastel').setEmoji('🍰').setStyle(ButtonStyle.Primary),
  );
  return { embeds: [embed], components: [row, petRow, sellRow] };
}

function catalog(guildId, userId) { return view(guildId, userId); }

function purchaseText(result) {
  if (!result) return 'No encontré ese artículo.';
  if (!result.ok) {
    if (result.reason === 'max') return '⛏️ Ya tienes el pico en nivel máximo.';
    return `💸 Te faltan monedas para ${result.product.name}. Necesitas **${result.product.price}**.`;
  }
  return `✅ ${result.level ? `${result.product.name} desbloqueado/mejorado` : `${result.product.name} comprado`} por **${result.product.price}** monedas.`;
}

module.exports = {
  name: 'shop', aliases: ['tienda'], description: 'Abre una tienda visual con compras y mejoras.', usage: 'xyb shop | buy item | sell item|fish', guildOnly: true,
  slash: { description: 'Abre la tienda con botones.', setup(builder) { return builder.addStringOption((option) => option.setName('accion').setDescription('list, buy o sell')).addStringOption((option) => option.setName('item').setDescription('bait, rod, bank, insurance, pickaxe, egg, fruta, cake o fish')); } },
  async execute({ args, isSlash, interaction, guild, user, reply }) {
    const action = (isSlash ? interaction.options.getString('accion') : args[0])?.toLowerCase();
    const item = (isSlash ? interaction.options.getString('item') : args[1])?.toLowerCase();
    if (!action || ['list', 'lista'].includes(action)) return reply(view(guild.id, user.id));
    if (action === 'buy' || action === 'comprar') {
      const result = economy.buy(guild.id, user.id, item);
      return reply({ content: purchaseText(result), ...view(guild.id, user.id) });
    }
    if (action === 'sell' || action === 'vender') {
      const result = economy.sell(guild.id, user.id, item);
      const text = result.ok ? (result.fish ? `🐟 Vendiste **${result.count}** peces por **${result.coins}** monedas.` : `💰 Vendiste **${result.quantity}× ${result.product.name}** por **${result.coins}** monedas.`) : 'No tienes ese objeto para vender.';
      return reply({ content: text, ...view(guild.id, user.id) });
    }
    return reply(view(guild.id, user.id));
  },
  async handleComponent(interaction) {
    const id = interaction.customId ?? '';
    if (!id.startsWith('shop:')) return false;
    const parts = id.split(':');
    const ownerId = parts[2];
    if (ownerId !== interaction.user.id) {
      await interaction.reply({ content: 'Esta tienda pertenece a otra persona.', ephemeral: true });
      return true;
    }
    let content = '';
    if (parts[1] === 'buy') content = purchaseText(economy.buy(interaction.guildId, interaction.user.id, parts[3]));
    else if (parts[1] === 'sell' && parts[3] === 'fish') {
      const result = economy.sell(interaction.guildId, interaction.user.id, 'fish');
      content = result.ok ? `🐟 Vendiste **${result.count}** peces por **${result.coins}** monedas.` : 'No tienes peces para vender.';
    } else return false;
    await interaction.update({ content, ...view(interaction.guildId, interaction.user.id) });
    return true;
  },
  catalog,
};
