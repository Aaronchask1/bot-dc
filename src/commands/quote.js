const quoteCard = require('../lib/quote-card');
const { ActionRowBuilder, StringSelectMenuBuilder } = require('discord.js');
const { EmbedBuilder } = require('discord.js');
const logger = require('../logger');
const activeQuotes = new Map();

async function referencedMessage(message) {
  if (!message?.reference?.messageId) return null;
  return message.channel?.messages?.cache?.get(message.reference.messageId)
    ?? message.fetchReference?.().catch(() => null)
    ?? null;
}
module.exports = {
  name: 'quote', aliases: ['cita'], description: 'Crea una tarjeta visual desde texto o un mensaje respondido.', usage: 'xyb quote texto | responde un mensaje con xyb quote', guildOnly: false,
  slash: { description: 'Crea una tarjeta visual con un texto.', setup(builder) { return builder.addStringOption((option) => option.setName('text').setDescription('Texto a citar (opcional)').setRequired(false).setMaxLength(900)); } },
  async execute({ text, isSlash, interaction, message, user, reply, fail }) {
    const supplied = isSlash ? interaction.options.getString('text') : String(text ?? '').trim();
    let content = supplied; let author = user;
    if (!content && !isSlash) {
      const source = await referencedMessage(message);
      if (source) { content = source.content?.trim(); author = source.author ?? user; }
    }
    if (!content) return fail('Uso: `xyb quote texto` o responde a un mensaje con `xyb quote`.');
    const id = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
    const state = { id, ownerId: user.id, text: content, author, font: 'satoshi', color: 'white', layout: 'wide' };
    activeQuotes.set(id, state);
    try {
      return await reply(await payload(state));
    } catch (error) {
      // El quote sigue siendo útil si un CDN o un renderer del host no puede
      // preparar la imagen. Además deja la causa exacta en el log.
      logger.error('No pude generar la tarjeta quote', error);
      activeQuotes.delete(id);
      return reply({ embeds: [new EmbedBuilder().setColor(0x5865F2).setTitle('❝ Quote').setDescription(`> ${content.slice(0, 1500)}\n\n— **${author.globalName ?? author.username}** · @${author.username}`)] });
    }
  },
  async handleComponent(interaction) {
    if (!interaction.isStringSelectMenu?.() || !interaction.customId?.startsWith('quote:')) return false;
    const [, id, field] = interaction.customId.split(':'); const state = activeQuotes.get(id);
    if (!state) { await interaction.reply({ content: 'Esta tarjeta de quote caducó. Crea otra con `/quote`.', ephemeral: true }); return true; }
    if (state.ownerId !== interaction.user.id) { await interaction.reply({ content: 'Solo quien creó esta tarjeta puede personalizarla.', ephemeral: true }); return true; }
    if (!['font', 'color', 'layout'].includes(field)) return false;
    state[field] = interaction.values[0];
    await interaction.update(await payload(state));
    return true;
  },
};

async function payload(state) {
  const card = await quoteCard.card(state);
  const select = (field, placeholder, options) => new ActionRowBuilder().addComponents(new StringSelectMenuBuilder()
    .setCustomId(`quote:${state.id}:${field}`).setPlaceholder(placeholder).addOptions(options.map((option) => ({ ...option, default: option.value === state[field] }))));
  card.components = [
    select('font', 'Satoshi', [{ label: 'Satoshi', value: 'satoshi' }, { label: 'Clásico', value: 'classic' }]),
    select('color', 'White', [{ label: 'White', value: 'white' }, { label: 'Purple', value: 'purple' }, { label: 'Cream', value: 'cream' }]),
    select('layout', 'Clásico (ancho)', [{ label: 'Clásico (ancho)', value: 'wide' }, { label: 'Vertical', value: 'vertical' }]),
  ];
  return card;
}
