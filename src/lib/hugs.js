const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  MessageFlags,
} = require('discord.js');
const interactionGifs = require('./interaction-gifs');

// Abrazos GIF revisados a ojo. El pool se amplía en segundo plano con el
// proveedor SFW, pero estos respaldos siempre están disponibles.
const HUG_IMAGES = [...interactionGifs.FALLBACK_GIFS.hug];

function randomImage() {
  return interactionGifs.randomGif('hug');
}

function embed(text) {
  return new EmbedBuilder()
    .setColor(0x9AD9A0)
    .setDescription(text)
    .setImage(randomImage())
    .setFooter({ text: '🐰 xyb' });
}

function backButton(fromId, toId) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`hug:back:${fromId}:${toId}`)
      .setLabel('🤗 Abrazar de vuelta')
      .setStyle(ButtonStyle.Secondary),
  );
}

/** Botón de "abrazar de vuelta": solo lo puede tocar quien recibió el abrazo. */
async function handleComponent(interaction) {
  if (!interaction.isButton() || !interaction.customId.startsWith('hug:back:')) return false;
  const [, , fromId, toId] = interaction.customId.split(':');

  if (interaction.user.id !== toId) {
    await interaction.reply({
      content: 'Solo la persona que recibió el abrazo puede devolverlo.',
      flags: MessageFlags.Ephemeral,
    });
    return true;
  }

  const [from, to] = await Promise.all([
    interaction.client.users.fetch(fromId), interaction.client.users.fetch(toId),
  ]);
  const payload = interactionGifs.payloadFor({
    action: 'hug',
    user: to,
    target: from,
    description: `**${interactionGifs.plainName(to)}** le devuelve el abrazo a **${interactionGifs.plainName(from)}**`,
  });
  await interaction.reply(payload);
  try {
    await interaction.message.edit({ components: [] });
  } catch { /* si el mensaje ya no está, no es problema */ }
  return true;
}

module.exports = { HUG_IMAGES, backButton, embed, handleComponent, randomImage };
