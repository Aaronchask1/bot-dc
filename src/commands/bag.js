const {
  ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder,
  StringSelectMenuBuilder,
} = require('discord.js');
const economy = require('../lib/economy');

const PAGE_SIZE = 6;

function itemsFor(data) {
  const items = [];
  for (const [name, amount] of Object.entries(data.minerals ?? {})) items.push({ id: `mineral:${name}`, name, amount });
  for (const [name, amount] of Object.entries(data.fish ?? {})) items.push({ id: `fish:${name}`, name, amount });
  for (const [id, amount] of Object.entries(data.inventory ?? {})) {
    const product = id === 'rod' ? economy.productFor('rod', data) : economy.SHOP[id];
    items.push({ id: `inventory:${id}`, name: product?.name ?? id, amount });
  }
  if (data.pickaxeLevel) {
    const pick = economy.productFor('pickaxe', data);
    items.push({ id: 'pickaxe', name: pick.name, amount: 1, detail: `Nivel ${data.pickaxeLevel}` });
  }
  return items;
}

function itemLine(item) {
  return `• ${item.name} **(x${item.amount})**${item.detail ? ` · ${item.detail}` : ''}`;
}

function encodeSelection(value) {
  return value ? Buffer.from(String(value), 'utf8').toString('base64url') : '';
}

function decodeSelection(value) {
  if (!value) return null;
  try { return Buffer.from(value, 'base64url').toString('utf8'); } catch { return null; }
}

function render(guildId, user, page = 0, selected = null, viewerId = user.id) {
  const data = economy.get(guildId, user.id);
  const items = itemsFor(data);
  const pages = Math.max(1, Math.ceil(items.length / PAGE_SIZE));
  const currentPage = Math.max(0, Math.min(page, pages - 1));
  const visible = items.slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE);
  const embed = new EmbedBuilder()
    .setColor(0xF0A06A)
    .setTitle('🎒 Tu mochila')
    .setDescription(`Selecciona un objeto para ver sus detalles.\n\n**Lista de objetos (${items.length})**\n${visible.length ? visible.map(itemLine).join('\n') : 'No tienes objetos todavía. Pesca con `xyb fish` o compra en `xyb shop`.'}`)
    .setFooter({ text: `Xyb Economía | hoy a las ${new Date().toLocaleTimeString('es-MX', { hour: 'numeric', minute: '2-digit' })}` });
  const options = visible.length
    ? visible.map((item) => ({ label: item.name.replace(/^[^\p{L}\p{N}]\s*/u, '').slice(0, 90) || 'Objeto', value: item.id.slice(0, 100), description: `${item.detail ? `${item.detail} · ` : ''}Cantidad: ${item.amount}`.slice(0, 100) }))
    : [{ label: 'Mochila vacía', value: 'empty', description: 'Aún no tienes objetos.' }];
  const select = new StringSelectMenuBuilder().setCustomId(`bag:${viewerId}:${user.id}:select:${currentPage}`).setPlaceholder('Seleccionar').addOptions(options).setDisabled(!visible.length);
  const selectedToken = encodeSelection(selected);
  const buttons = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`bag:${viewerId}:${user.id}:page:${currentPage - 1}`).setEmoji('⬅️').setStyle(ButtonStyle.Secondary).setDisabled(currentPage <= 0),
    new ButtonBuilder().setCustomId(`bag:${viewerId}:${user.id}:use:${currentPage}:${selectedToken}`).setEmoji('🐾').setStyle(ButtonStyle.Primary).setDisabled(!selected),
    new ButtonBuilder().setCustomId(`bag:${viewerId}:${user.id}:close:${currentPage}`).setEmoji('✖️').setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId(`bag:${viewerId}:${user.id}:help:${currentPage}`).setEmoji('❔').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(`bag:${viewerId}:${user.id}:page:${currentPage + 1}`).setEmoji('➡️').setStyle(ButtonStyle.Secondary).setDisabled(currentPage >= pages - 1),
  );
  return { content: `Página ${currentPage + 1} de ${pages}`, embeds: [embed], components: [new ActionRowBuilder().addComponents(select), buttons], allowedMentions: { parse: [] } };
}

module.exports = {
  name: 'bag', aliases: ['mochila', 'inventory'], description: 'Abre tu mochila visual de pesca y minería.', usage: 'xyb bag [@persona]', guildOnly: true, resolveMember: true,
  slash: { description: 'Abre la mochila visual.', setup(builder) { return builder.addUserOption((option) => option.setName('usuario').setDescription('Persona')); } },
  async execute({ guild, user, target, isSlash, interaction, reply }) {
    const person = isSlash ? (interaction.options.getUser('usuario') ?? user) : (target ?? user);
    return reply(render(guild.id, person, 0, null, user.id));
  },
  async handleComponent(interaction) {
    const id = interaction.customId ?? '';
    if (!id.startsWith('bag:')) return false;
    const [, ownerId, targetId, action, value, selectedToken] = id.split(':');
    if (ownerId !== interaction.user.id) {
      await interaction.reply({ content: 'Esta mochila pertenece a otra persona.', ephemeral: true });
      return true;
    }
    if (interaction.isStringSelectMenu?.() && action === 'select') {
      const selected = interaction.values[0];
      if (selected === 'empty') {
        await interaction.reply({ content: 'Tu mochila todavía está vacía.', ephemeral: true });
        return true;
      }
      await interaction.update(render(interaction.guildId, { id: targetId }, Number(value) || 0, selected, ownerId));
      return true;
    }
    if (!interaction.isButton?.()) return false;
    const page = Number(value) || 0;
    if (action === 'close') {
      await interaction.update({ content: '🎒 Mochila cerrada.', embeds: [], components: [] });
      return true;
    }
    if (action === 'help') {
      await interaction.reply({ content: '🎒 Usa el selector para consultar un objeto. Navega con las flechas; el botón 🐾 quedará disponible para usar objetos cuando corresponda.', ephemeral: true });
      return true;
    }
    if (action === 'use') {
      const selected = decodeSelection(selectedToken);
      await interaction.reply({ content: selected ? `🐾 Seleccionaste \`${selected}\`. Los consumibles se aplican automáticamente al pescar o minar.` : '🐾 Selecciona un objeto primero. La mochila no consume objetos por accidente.', ephemeral: true });
      return true;
    }
    if (action === 'page') {
      await interaction.update(render(interaction.guildId, { id: targetId }, page, null, ownerId));
      return true;
    }
    return false;
  },
  render,
  itemsFor,
};
