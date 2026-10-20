const {
  ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, StringSelectMenuBuilder,
} = require('discord.js');
const economy = require('../lib/economy');

const PAGE_SIZE = 5;
const SHOP_ORDER = ['pickaxe', 'rod', 'bait', 'insurance', 'bank', 'egg', 'apple', 'banana', 'strawberry', 'cake'];
const EMOJIS = { pickaxe: '⛏️', rod: '🎣', bait: '🪱', insurance: '🛡️', bank: '🏦', egg: '🥚', apple: '🍎', banana: '🍌', strawberry: '🍓', cake: '🍰' };

function pageItems(data, page) {
  const products = economy.shopProducts(data);
  const pages = Math.max(1, Math.ceil(SHOP_ORDER.length / PAGE_SIZE));
  const current = Math.max(0, Math.min(Number(page) || 0, pages - 1));
  return { products, pages, current, items: SHOP_ORDER.slice(current * PAGE_SIZE, (current + 1) * PAGE_SIZE) };
}

function shortLabel(item, product) {
  const label = product.name.replace(/^[^\p{L}\p{N}]\s*/u, '').split(' ')[0] || item;
  return `${EMOJIS[item] ?? ''} ${label}`.trim().slice(0, 80);
}

function view(guildId, userId, page = 0) {
  const data = economy.get(guildId, userId);
  const { products, pages, current, items } = pageItems(data, page);
  const lines = items.map((id) => {
    const item = products[id]; const state = item.maxed ? '✅ máximo' : `💰 **${item.price}**`;
    return `${EMOJIS[id] ?? ''} **${item.name.replace(/^[^\p{L}\p{N}]\s*/u, '')}** · ID: \`${item.id}\` · ${state}\n${item.description}`;
  });
  const embed = new EmbedBuilder()
    .setColor(0xFFB347)
    .setTitle(`🛒 Tienda XYB · Página ${current + 1}/${pages}`)
    .setDescription(`Tu bolsillo: **${data.wallet}** monedas\n\n${lines.join('\n\n')}`)
    .setFooter({ text: 'Compra: xyb buy <nombre|ID> · Navega con los botones o el selector.' });
  const buyRow = new ActionRowBuilder().addComponents(items.map((id) => {
    const product = products[id];
    return new ButtonBuilder().setCustomId(`shop:buy:${userId}:${id}:${current}`).setLabel(shortLabel(id, product)).setStyle(product.maxed ? ButtonStyle.Secondary : ButtonStyle.Primary).setDisabled(Boolean(product.maxed));
  }));
  const select = new StringSelectMenuBuilder().setCustomId(`shop:select:${userId}:${current}`).setPlaceholder('Seleccionar artículo para comprar').addOptions(items.map((id) => {
    const product = products[id];
    return { label: `${product.name.replace(/^[^\p{L}\p{N}]\s*/u, '').slice(0, 70)} · ID ${product.id}`.slice(0, 100), value: id, description: `${product.maxed ? 'Nivel máximo' : `${product.price} monedas`} · ${product.description}`.slice(0, 100) };
  }));
  const nav = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`shop:page:${userId}:${current - 1}`).setEmoji('⬅️').setStyle(ButtonStyle.Secondary).setDisabled(current <= 0),
    new ButtonBuilder().setCustomId(`shop:close:${userId}:${current}`).setEmoji('✖️').setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId(`shop:page:${userId}:${current + 1}`).setEmoji('➡️').setStyle(ButtonStyle.Secondary).setDisabled(current >= pages - 1),
  );
  const sellRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`shop:sell:${userId}:fish:${current}`).setLabel('Vender peces').setEmoji('🐟').setStyle(ButtonStyle.Danger),
  );
  return { content: `Página ${current + 1} de ${pages}`, embeds: [embed], components: [buyRow, new ActionRowBuilder().addComponents(select), nav, sellRow], allowedMentions: { parse: [] } };
}

function catalog(guildId, userId) { return view(guildId, userId, 0); }

function purchaseText(result) {
  if (!result) return 'No encontré ese artículo. Usa `xyb shop` para ver nombres e IDs.';
  if (!result.ok) {
    if (result.reason === 'max') return `✅ Ya tienes ${result.product.name} en nivel máximo.`;
    return `💸 Te faltan monedas para ${result.product.name}. Necesitas **${result.product.price}**.`;
  }
  return `✅ ${result.level ? `${result.product.name} desbloqueado/mejorado` : `${result.product.name} comprado`} por **${result.product.price}** monedas. ID: \`${result.product.id}\``;
}

module.exports = {
  name: 'shop', aliases: ['tienda', 'buy', 'comprar'], description: 'Abre una tienda visual con compras, IDs y páginas.', usage: 'xyb shop | xyb buy <nombre|ID> | xyb shop sell fish', guildOnly: true,
  slash: { description: 'Abre la tienda visual.', setup(builder) { return builder.addStringOption((option) => option.setName('accion').setDescription('list, buy o sell')).addStringOption((option) => option.setName('item').setDescription('Nombre o ID del artículo')); } },
  async execute({ args, isSlash, interaction, guild, user, reply, invokedName }) {
    const directBuy = invokedName === 'buy' || invokedName === 'comprar';
    const action = directBuy ? 'buy' : (isSlash ? interaction.options.getString('accion') : args[0])?.toLowerCase();
    const item = directBuy ? (isSlash ? interaction.options.getString('item') : args.join(' ')) : (isSlash ? interaction.options.getString('item') : args.slice(1).join(' '));
    if (!action || ['list', 'lista'].includes(action)) return reply(view(guild.id, user.id));
    if (action === 'buy' || action === 'comprar') return reply({ content: purchaseText(economy.buy(guild.id, user.id, item)), ...view(guild.id, user.id) });
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
    const parts = id.split(':'); const action = parts[1]; const ownerId = parts[2];
    if (ownerId !== interaction.user.id) { await interaction.reply({ content: 'Esta tienda pertenece a otra persona.', ephemeral: true }); return true; }
    if (action === 'page') { await interaction.update(view(interaction.guildId, ownerId, Number(parts[3]) || 0)); return true; }
    if (action === 'close') { await interaction.update({ content: '🛒 Tienda cerrada.', embeds: [], components: [] }); return true; }
    if (action === 'select' && interaction.isStringSelectMenu?.()) {
      const result = economy.buy(interaction.guildId, ownerId, interaction.values[0]);
      await interaction.update({ content: purchaseText(result), ...view(interaction.guildId, ownerId, Number(parts[3]) || 0) }); return true;
    }
    if (action === 'buy') {
      const result = economy.buy(interaction.guildId, ownerId, parts[3]);
      await interaction.update({ content: purchaseText(result), ...view(interaction.guildId, ownerId, Number(parts[4]) || 0) }); return true;
    }
    if (action === 'sell' && parts[3] === 'fish') {
      const result = economy.sell(interaction.guildId, ownerId, 'fish');
      await interaction.update({ content: result.ok ? `🐟 Vendiste **${result.count}** peces por **${result.coins}** monedas.` : 'No tienes peces para vender.', ...view(interaction.guildId, ownerId, Number(parts[4]) || 0) }); return true;
    }
    return false;
  },
  catalog,
};
