const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  MessageFlags,
} = require('discord.js');

// Abrazos de anime revisados a ojo, todos de 500 px para que se vean grandes.
const HUG_IMAGES = [
  'https://i.imgur.com/wOmoeF8.gif',
  'https://i.imgur.com/BPLqSJC.gif',
  'https://i.imgur.com/Avih7pz.gif',
  'https://i.imgur.com/pa0R1t5.gif',
  'https://media.tenor.com/nw8fKxblWeYAAAAe/gochiusa-chino-kafuu.png',
  'https://media.tenor.com/TJuvig1CFBQAAAAe/the-pet-girl-of-sakurasou-sakurasou-no-pet-na-kanojo.png',
  'https://betteranime.files.wordpress.com/2015/06/0191.png?h=576&w=1024',
  'https://image.idntimes.com/post/20230313/vlcsnap-2023-03-13-19h05m47s024-3b221a05a8f4eb1fcd1879ca12e22200-bf5d3c46eb91cdadaa3c4e572c890d31.png',
];

function randomImage() {
  return HUG_IMAGES[Math.floor(Math.random() * HUG_IMAGES.length)];
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

  await interaction.reply({ embeds: [embed(`<@${toId}> le devuelve el abrazo a <@${fromId}> 🫂`)] });
  try {
    await interaction.message.edit({ components: [] });
  } catch { /* si el mensaje ya no está, no es problema */ }
  return true;
}

module.exports = { HUG_IMAGES, backButton, embed, handleComponent, randomImage };
