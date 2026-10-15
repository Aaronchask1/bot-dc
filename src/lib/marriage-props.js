const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  MessageFlags,
} = require('discord.js');
const marriage = require('./marriage');

// Los matrimonios ya no se guardan al escribir el comando: se guardan cuando la
// otra persona pulsa "Aceptar". El id viaja en el botón, así que no hace falta
// guardar nada a la espera.
const PROPOSE_IMAGES = [
  'https://i.imgur.com/txNxEz3.gif',
  'https://media1.tenor.com/m/m-s6QVjySC0AAAAd/ring-anime-wedding.gif',
  'https://media1.tenor.com/m/JQApoxtf5rcAAAAd/gurren-lagann-tengen-toppa-gurren-lagann.gif',
  'https://media1.tenor.com/m/X5Cfbkw3szkAAAAd/anime-marriage.gif',
];

const ACCEPT_IMAGES = [
  'https://i.imgur.com/3i2RdCa.gif',
  'https://media1.tenor.com/m/k2zxchaF2jwAAAAd/anime-wedding.gif',
  'https://media1.tenor.com/m/maJSqcVrEXkAAAAd/anime-bride.gif',
  'https://media1.tenor.com/m/fZmRQnI8TywAAAAd/%E4%BA%94%E7%AD%89%E5%88%86%E7%9A%84%E8%8A%B1%E5%AB%81-anime.gif',
];

// Esta colección es independiente de los rechazos de beso: así cada acción
// conserva su propia rotación de imágenes.
const REJECT_IMAGES = [
  'https://media.tenor.com/S9OlBRPSNusAAAAM/sad-depressed.gif',
  'https://media.tenor.com/ZgbfJDDS9yQAAAAM/anime-depressed.gif',
  'https://media1.tenor.com/m/gbpL-Voeh_AAAAAd/anime-no.gif',
  'https://media1.tenor.com/m/C8Ng76EQzuwAAAAd/anime-no.gif',
  'https://media1.tenor.com/m/0LtvGK3-jb0AAAAd/anime-no.gif',
  'https://media1.tenor.com/m/0aSY5qsa0MgAAAAd/anime-no.gif',
];

function pick(images) {
  return images[Math.floor(Math.random() * images.length)];
}

function proposalEmbed(from, to) {
  return new EmbedBuilder()
    .setColor(0xFFB6C1)
    .setTitle('💍 ¡Propuesta de matrimonio!')
    .setDescription(`${from} le está pidiendo la mano a ${to}.`)
    .setImage(pick(PROPOSE_IMAGES))
    .setFooter({ text: 'Solo la persona mencionada puede responder · 🐰 xyb' });
}

function acceptedEmbed(from, to, since) {
  return new EmbedBuilder()
    .setColor(0x2ECC71)
    .setTitle('💍 ¡Se casaron!')
    .setDescription(`${to} aceptó. ${from} y ${to} ahora son marido y Mujer.`)
    .addFields({ name: '💞 Desde', value: `<t:${Math.floor(since / 1000)}:D>`, inline: true })
    .setImage(pick(ACCEPT_IMAGES))
    .setFooter({ text: '🐰 xyb' })
    .setTimestamp();
}

function rejectedEmbed(from, to) {
  return new EmbedBuilder()
    .setColor(0xED4245)
    .setTitle('💔 Rechazado')
    .setDescription(`${to} le dijo que no a ${from}.`)
    .setImage(pick(REJECT_IMAGES))
    .setFooter({ text: 'Hay otros 🤷 · 🐰 xyb' })
    .setTimestamp();
}

function buttons(fromId, toId) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`mry:yes:${fromId}:${toId}`)
      .setLabel('💍 Aceptar')
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId(`mry:no:${fromId}:${toId}`)
      .setLabel('💔 Rechazar')
      .setStyle(ButtonStyle.Danger),
  );
}

async function handleComponent(interaction) {
  if (!interaction.isButton() || !interaction.customId.startsWith('mry:')) return false;
  const [, answer, fromId, toId] = interaction.customId.split(':');

  if (interaction.user.id !== toId) {
    await interaction.reply({
      content: 'Esta propuesta no es para ti. Solo puede responder la persona mencionada.',
      flags: MessageFlags.Ephemeral,
    });
    return true;
  }

  if (answer === 'no') {
    await interaction.reply({ embeds: [rejectedEmbed(`<@${fromId}>`, `<@${toId}>`)] });
    await clearButtons(interaction);
    return true;
  }

  const result = marriage.marry(interaction.guildId, fromId, toId, toId);
  if (!result.ok) {
    await interaction.reply({ content: 'Alguno de los dos ya está casado. Se anuló la propuesta.', flags: MessageFlags.Ephemeral });
    await clearButtons(interaction);
    return true;
  }

  await interaction.reply({ embeds: [acceptedEmbed(`<@${fromId}>`, `<@${toId}>`, result.since)] });
  await clearButtons(interaction);
  return true;
}

async function clearButtons(interaction) {
  try {
    await interaction.message.edit({ components: [] });
  } catch { /* si el mensaje ya no está, no es problema */ }
}

module.exports = {
  ACCEPT_IMAGES,
  PROPOSE_IMAGES,
  REJECT_IMAGES,
  acceptedEmbed,
  buttons,
  handleComponent,
  proposalEmbed,
  rejectedEmbed,
};
