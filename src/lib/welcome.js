const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
} = require('discord.js');
const { createStore } = require('../store');
const logger = require('../logger');

const store = createStore('welcome');

const DEFAULTS = {
  channel: null,
  message: 'Bienvenido {{user}} a {{server}} ✨',
  title: null,
  footer: null,
  color: null,
  image: null,
  thumbnail: false,
  mention: false,
  embed: true,
};

const VARIABLES = [
  ['{{user}}', 'menciona a la persona'],
  ['{{username}}', 'su nombre de usuario'],
  ['{{tag}}', 'su nombre#1234'],
  ['{{id}}', 'su ID'],
  ['{{server}}', 'el nombre del servidor'],
  ['{{members}}', 'cuántas personas hay'],
  ['{{count}}', 'número de miembros, igual que {{members}}'],
];

function getConfig(guildId) {
  return { ...DEFAULTS, ...(store.get(guildId) ?? {}) };
}

function setConfig(guildId, patch) {
  const next = { ...getConfig(guildId), ...patch };
  store.set(guildId, next);
  return next;
}

function render(text, member) {
  if (!text) return null;
  return text
    .replaceAll('{{user}}', `<@${member.id}>`)
    .replaceAll('{{username}}', member.user.username)
    .replaceAll('{{tag}}', member.user.tag)
    .replaceAll('{{id}}', member.id)
    .replaceAll('{{server}}', member.guild.name)
    .replaceAll('{{members}}', String(member.guild.memberCount))
    .replaceAll('{{count}}', String(member.guild.memberCount));
}

function buildPayload(member, config) {
  const content = config.mention ? `<@${member.id}>\n` : '';
  if (!config.embed) {
    // Discord no acepta mensajes completamente vacíos. Un mensaje opcional
    // vacío debe seguir generando una bienvenida válida, no el texto "null".
    return { content: `${content}${render(config.message, member) ?? '👋'}` };
  }

  const embed = new EmbedBuilder()
    .setDescription(render(config.message, member) ?? '')
    .setColor(config.color || 0xFF6B9A)
    .setFooter(config.footer ? { text: render(config.footer, member) } : null);

  if (config.title) embed.setTitle(render(config.title, member));
  if (config.thumbnail) embed.setThumbnail(member.user.displayAvatarURL({ size: 512 }));
  if (config.image) embed.setImage(config.image);

  return { content, embeds: [embed] };
}

async function announce(member) {
  const config = getConfig(member.guild.id);
  if (!config.channel) return;
  const channel = member.guild.channels.cache.get(config.channel);
  if (!channel?.isTextBased?.() || typeof channel.send !== 'function') return;
  await channel.send(buildPayload(member, config));
}

function summary(config) {
  return [
    `📌 Canal: ${config.channel ? `<#${config.channel}>` : '*(sin definir)*'}`,
    `💬 Mensaje: ${config.message}`,
    `🏷️ Título: ${config.title ?? '*(ninguno)*'}`,
    `📝 Footer: ${config.footer ?? '*(ninguno)*'}`,
    `🎨 Color: ${config.color ?? '*(por defecto)*'}`,
    `🌄 Imagen: ${config.image ?? '*(ninguna)*'}`,
    `👤 Thumbnail: ${config.thumbnail ? 'ON' : 'OFF'}`,
    `📢 Mención: ${config.mention ? 'ON' : 'OFF'}`,
    `🖼️ Embed: ${config.embed ? 'ON' : 'OFF'}`,
  ].join('\n');
}

function panelEmbed(config) {
  return new EmbedBuilder()
    .setColor(0x2B2D31)
    .setTitle('👋 Panel de bienvenida')
    .setDescription(summary(config))
    .setFooter({ text: 'Los cambios se guardan al instante.' });
}

function panelRows() {
  return [
    new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('wlc:channel').setLabel('📌 Canal').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('wlc:message').setLabel('💬 Mensaje').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId('wlc:title').setLabel('🏷️ Título').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('wlc:footer').setLabel('📝 Footer').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('wlc:color').setLabel('🎨 Color').setStyle(ButtonStyle.Primary),
    ),
    new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('wlc:image').setLabel('🌄 Imagen').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('wlc:thumbnail').setLabel('👤 Thumbnail').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId('wlc:mention').setLabel('📢 Mención').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId('wlc:embed').setLabel('🖼️ Embed').setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId('wlc:preview').setLabel('👀 Probar').setStyle(ButtonStyle.Success),
    ),
    new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('wlc:vars').setLabel('📚 Variables').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('wlc:disable').setLabel('🛑 Desactivar').setStyle(ButtonStyle.Danger),
    ),
  ];
}

const TEXT_FIELDS = {
  message: { label: 'Mensaje de bienvenida', placeholder: 'Bienvenido {{user}} a {{server}}', style: TextInputStyle.Paragraph },
  title: { label: 'Título', placeholder: '¡Nuevo miembro!', style: TextInputStyle.Short },
  footer: { label: 'Footer', placeholder: 'Ahora somos {{members}}', style: TextInputStyle.Short },
  color: { label: 'Color (hex, por ejemplo #ff69b4)', placeholder: '#ff69b4', style: TextInputStyle.Short },
  image: { label: 'URL de la imagen', placeholder: 'https://...', style: TextInputStyle.Short },
};

function openTextModal(interaction, field) {
  const config = getConfig(interaction.guildId);
  const definition = TEXT_FIELDS[field];
  const modal = new ModalBuilder()
    .setCustomId(`wlc-modal:${field}`)
    .setTitle(definition.label)
    .addComponents(new ActionRowBuilder().addComponents(
      new TextInputBuilder()
        .setCustomId('valor')
        .setLabel(definition.label)
        .setStyle(definition.style)
        .setRequired(false)
        .setValue(config[field] ?? definition.placeholder)
        .setPlaceholder(definition.placeholder),
    ));
  return interaction.showModal(modal);
}

async function refresh(interaction) {
  await interaction.update({
    embeds: [panelEmbed(getConfig(interaction.guildId))],
    components: panelRows(),
  });
}

async function preview(interaction) {
  const config = getConfig(interaction.guildId);
  const member = interaction.member;
  await interaction.reply({ ...buildPayload(member, config), ephemeral: true });
  if (interaction.message) {
    try {
      await interaction.message.edit({ embeds: [panelEmbed(config)], components: panelRows() });
    } catch { /* el panel es informativo */ }
  }
}

function variablesEmbed() {
  return new EmbedBuilder()
    .setColor(0x2B2D31)
    .setTitle('📚 Variables de bienvenida')
    .setDescription(VARIABLES.map(([key, meaning]) => `\`${key}\`\n${meaning}`).join('\n\n'))
    .setFooter({ text: '🐰 xyb' });
}

/** Botones y modales del panel. Devuelve true si el interaction era del panel. */
async function handleComponent(interaction) {
  if (interaction.isButton() && interaction.customId.startsWith('wlc:')) {
    const action = interaction.customId.slice(4);
    if (TEXT_FIELDS[action]) return openTextModal(interaction, action);
    if (action === 'preview') return preview(interaction);
    if (action === 'vars') {
      await interaction.reply({ embeds: [variablesEmbed()], ephemeral: true });
      return true;
    }
    if (action === 'channel') {
      await interaction.showModal(channelModal());
      return true;
    }
    if (action === 'disable') {
      setConfig(interaction.guildId, { channel: null });
      await interaction.reply({ content: '🛑 Bienvenida desactivada en este servidor.', ephemeral: true });
      return true;
    }
    if (action === 'thumbnail' || action === 'mention' || action === 'embed') {
      const config = getConfig(interaction.guildId);
      setConfig(interaction.guildId, { [action]: !config[action] });
      await refresh(interaction);
      return true;
    }
    return true;
  }

  if (interaction.isStringSelectMenu() && interaction.customId === 'wlc:channel') {
    setConfig(interaction.guildId, { channel: interaction.values[0] });
    await refresh(interaction);
    return true;
  }

  if (interaction.isModalSubmit() && interaction.customId === 'wlc:channel-modal') {
    return handleChannelModal(interaction);
  }

  if (interaction.isModalSubmit() && interaction.customId.startsWith('wlc-modal:')) {
    const field = interaction.customId.slice('wlc-modal:'.length);
    const value = interaction.fields.getTextInputValue('valor').trim();
    const patch = {};

    if (field === 'color' && value) {
      const parsed = value.startsWith('#') ? value.slice(1) : value;
      if (!/^[0-9a-f]{6}$/i.test(parsed)) {
        await interaction.reply({ content: 'Ese color no es válido. Usa algo como `#ff69b4`.', ephemeral: true });
        return true;
      }
      patch.color = `#${parsed}`;
    } else {
      patch[field] = value || null;
    }

    setConfig(interaction.guildId, patch);
    await interaction.reply({
      embeds: [panelEmbed(getConfig(interaction.guildId))],
      components: panelRows(),
      ephemeral: true,
    });
    return true;
  }

  return false;
}

// Discord no deja elegir canales con un modal, así que se usa un select con
// los canales de texto del servidor.
function channelModal() {
  return new ModalBuilder()
    .setCustomId('wlc:channel-modal')
    .setTitle('Elige el canal de bienvenida')
    .addComponents(new ActionRowBuilder().addComponents(
      new TextInputBuilder()
        .setCustomId('canal')
        .setLabel('ID del canal')
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
        .setPlaceholder('Pega aquí el ID del canal'),
    ));
}

async function handleChannelModal(interaction) {
  const raw = interaction.fields.getTextInputValue('canal').trim();
  const channel = interaction.guild.channels.cache.get(raw.replace(/[<#>]/g, ''));
  if (!channel) {
    await interaction.reply({ content: 'No encontré ese canal en este servidor.', ephemeral: true });
    return true;
  }
  setConfig(interaction.guildId, { channel: channel.id });
  await interaction.reply({
    embeds: [panelEmbed(getConfig(interaction.guildId))],
    components: panelRows(),
    ephemeral: true,
  });
  return true;
}

async function handleMemberAdd(member) {
  try {
    await announce(member);
  } catch (error) {
    logger.error(`No pude enviar la bienvenida en ${member.guild.name}`, error);
  }
}

module.exports = {
  announce,
  buildPayload,
  getConfig,
  handleChannelModal,
  handleComponent,
  handleMemberAdd,
  panelEmbed,
  panelRows,
  render,
  setConfig,
  variablesEmbed,
  VARIABLES,
};
