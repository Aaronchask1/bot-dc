const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  MessageFlags,
} = require('discord.js');
const marriage = require('./marriage');
const animeMedia = require('./anime-media');
const { prepareKissPayload } = require('./kiss-media');

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

animeMedia.warm({
  proposal: PROPOSE_IMAGES,
  marriage_accept: ACCEPT_IMAGES,
  marriage_reject: REJECT_IMAGES,
});

function pick(images, pool) {
  return animeMedia.pick(pool, images);
}

function proposalEmbed(from, to, image = pick(PROPOSE_IMAGES, 'proposal')) {
  return new EmbedBuilder()
    .setColor(0xFFB6C1)
    .setTitle('💍 ¡Propuesta de matrimonio!')
    .setDescription(`${from} le está pidiendo la mano a ${to}.`)
    .setImage(image)
    .setFooter({ text: 'Solo la persona mencionada puede responder · 🐰 xyb' });
}

function acceptedEmbed(from, to, since, image = pick(ACCEPT_IMAGES, 'marriage_accept')) {
  return new EmbedBuilder()
    .setColor(0x2ECC71)
    .setTitle('💍 ¡Se casaron!')
    .setDescription(`${to} aceptó. ${from} y ${to} ahora son marido y Mujer.`)
    .addFields({ name: '💞 Desde', value: `<t:${Math.floor(since / 1000)}:D>`, inline: true })
    .setImage(image)
    .setFooter({ text: '🐰 xyb' })
    .setTimestamp();
}

function rejectedEmbed(from, to, image = pick(REJECT_IMAGES, 'marriage_reject')) {
  return new EmbedBuilder()
    .setColor(0xED4245)
    .setTitle('💔 Rechazado')
    .setDescription(`${to} le dijo que no a ${from}.`)
    .setImage(image)
    .setFooter({ text: 'Hay otros 🤷 · 🐰 xyb' })
    .setTimestamp();
}

function fileName(kind, image) {
  const extension = new URL(image).pathname.match(/\.(gif|png|jpe?g|webp)$/i)?.[1] ?? 'gif';
  return `xyb-${kind}.${extension}`;
}
function attached(embed, kind, image) {
  const name = fileName(kind, image);
  return { embeds: [embed.setImage(`attachment://${name}`)], files: [{ attachment: image, name }] };
}
function proposalPayload(from, to) {
  const image = pick(PROPOSE_IMAGES, 'proposal');
  return attached(proposalEmbed(from, to, image), 'proposal', image);
}
function acceptedPayload(from, to, since) {
  const image = pick(ACCEPT_IMAGES, 'marriage_accept');
  return attached(acceptedEmbed(from, to, since, image), 'married', image);
}
function rejectedPayload(from, to) {
  const image = pick(REJECT_IMAGES, 'marriage_reject');
  return attached(rejectedEmbed(from, to, image), 'marriage-reject', image);
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
    await interaction.reply(await prepareKissPayload(rejectedPayload(`<@${fromId}>`, `<@${toId}>`)));
    await clearButtons(interaction);
    return true;
  }

  const result = marriage.marry(interaction.guildId, fromId, toId, toId);
  if (!result.ok) {
    await interaction.reply({ content: 'Alguno de los dos ya está casado. Se anuló la propuesta.', flags: MessageFlags.Ephemeral });
    await clearButtons(interaction);
    return true;
  }

  await interaction.reply(await prepareKissPayload(acceptedPayload(`<@${fromId}>`, `<@${toId}>`, result.since)));
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
  proposalPayload,
  acceptedPayload,
  rejectedPayload,
  rejectedEmbed,
};
