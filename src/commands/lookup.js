const { randomBytes } = require('node:crypto');
const {
  ActionRowBuilder, ButtonBuilder, ButtonStyle, ContainerBuilder,
  MessageFlags, ModalBuilder, SectionBuilder, SeparatorBuilder,
  TextDisplayBuilder, TextInputBuilder, TextInputStyle, ThumbnailBuilder,
} = require('discord.js');
const history = require('../lib/username-lookup');

const sessions = new Map();
const SESSION_MS = 15 * 60_000;
const MAX_SESSIONS = 1000;
const MODE_LABELS = { todos: 'Todos', letras: 'Letras', numeros: 'Números', sin_simbolos: 'Sin símbolos' };
const USAGE = 'Usa `xyb lookup 3`, `xyb lookup 4`, `xyb lookup vanity 5` o `xyb lookup 6 texto`. Longitud: 2 a 32.';

function parseArgs(args) {
  const rest = [...args].map((value) => value.toLowerCase());
  let type = 'usernames';
  if (['vanity', 'vanities'].includes(rest[0])) { type = 'vanities'; rest.shift(); }
  else if (['username', 'usernames', 'nombres'].includes(rest[0])) rest.shift();
  let length = null;
  if (/^\d+$/.test(rest[0] ?? '')) {
    length = Number(rest.shift());
    if (length < 2 || length > 32) return { error: USAGE };
  }
  const query = rest.join(' ');
  if (query && !/^[a-z0-9_.-]{1,32}$/.test(query)) return { error: USAGE };
  return { type, length, query, mode: 'todos', page: 0 };
}

function createSession(user, guildId, filters, now = Date.now()) {
  for (const [key, value] of sessions) if (value.expiresAt <= now) sessions.delete(key);
  if (sessions.size >= MAX_SESSIONS) sessions.delete(sessions.keys().next().value);
  const token = randomBytes(10).toString('hex');
  const session = {
    ...filters, token, userId: user.id, guildId,
    avatar: user.displayAvatarURL?.({ size: 256 }) ?? 'https://cdn.discordapp.com/embed/avatars/0.png',
    expiresAt: now + SESSION_MS,
  };
  sessions.set(token, session);
  return session;
}

function button(session, action, emoji, style = ButtonStyle.Secondary, disabled = false) {
  return new ButtonBuilder().setCustomId(`lookup:${session.token}:${action}`)
    .setEmoji(emoji).setStyle(style).setDisabled(disabled);
}

function panel(session, { closed = false } = {}) {
  const result = history.search(session.guildId, session);
  session.page = result.page;
  const title = session.type === 'vanities' ? 'Dropped Vanities' : 'Dropped Usernames';
  const filters = [session.length ? `${session.length} caracteres` : 'Todas las longitudes'];
  if (session.mode !== 'todos') filters.push(MODE_LABELS[session.mode]);
  if (session.query) filters.push(`contiene \`${session.query}\``);
  const lines = result.entries.map(({ username, detectedAt }) =>
    `\`${username}\` · <t:${Math.floor(detectedAt / 1000)}:R>`);
  const empty = result.recorded
    ? 'No hay resultados con estos filtros. Usa 🔎 para buscar o ⚙️ para cambiar los filtros.'
    : session.type === 'vanities'
      ? 'Todavía no he detectado vanities abandonadas. Aparecerán cuando vea cambiar una URL personalizada en un servidor donde estoy.'
      : 'Todavía no he detectado nombres abandonados en este servidor. Aparecerán cuando vea un cambio de nombre de usuario.';
  const container = new ContainerBuilder().setAccentColor(0x333333)
    .addSectionComponents(new SectionBuilder()
      .addTextDisplayComponents(new TextDisplayBuilder().setContent(`## ${title}\n-# ${filters.join(' · ')}`))
      .setThumbnailAccessory(new ThumbnailBuilder().setURL(session.avatar).setDescription('Avatar de quien consulta')))
    .addSeparatorComponents(new SeparatorBuilder())
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(lines.join('\n') || empty))
    .addSeparatorComponents(new SeparatorBuilder())
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(
      `-# Página ${result.page + 1}/${result.pages} · ${result.total} resultados${closed ? ' · Cerrado' : ''}\n-# Detectados por XYB · Disponibilidad sin comprobar`,
    ))
    .addActionRowComponents(new ActionRowBuilder().addComponents(
      button(session, 'prev', '◀️', ButtonStyle.Secondary, closed || result.page === 0),
      button(session, 'next', '▶️', ButtonStyle.Secondary, closed || result.page >= result.pages - 1),
      button(session, 'search', '🔎', ButtonStyle.Secondary, closed),
      button(session, 'close', '⛔', ButtonStyle.Danger, closed),
      button(session, 'filter', '⚙️', ButtonStyle.Secondary, closed),
    ));
  return { flags: MessageFlags.IsComponentsV2, components: [container], allowedMentions: { parse: [] } };
}

function input(id, label, placeholder, value = '') {
  const field = new TextInputBuilder().setCustomId(id).setLabel(label)
    .setStyle(TextInputStyle.Short).setRequired(false).setMaxLength(32).setPlaceholder(placeholder);
  if (value) field.setValue(value);
  return new ActionRowBuilder().addComponents(field);
}

function modal(session, action) {
  const form = new ModalBuilder().setCustomId(`lookup:${session.token}:${action}-submit`);
  if (action === 'search') {
    form.setTitle('Buscar nombres o vanities').addComponents(
      input('query', 'Texto que debe contener (vacío = todos)', 'Por ejemplo: ak', session.query),
    );
  } else {
    form.setTitle('Filtros de lookup').addComponents(
      input('type', 'Lista: nombres o vanities', 'nombres', session.type === 'vanities' ? 'vanities' : 'nombres'),
      input('length', 'Longitud: 2 a 32 (vacío = todas)', '3, 4, 5, 6...', session.length ? String(session.length) : ''),
      input('mode', 'Caracteres: todos/letras/numeros/simples', 'todos', session.mode === 'sin_simbolos' ? 'simples' : session.mode),
    );
  }
  return form;
}

async function handleComponent(interaction) {
  if (!interaction.customId?.startsWith('lookup:')) return false;
  if (!interaction.isButton?.() && !interaction.isModalSubmit?.()) return false;
  const [, token, action] = interaction.customId.split(':');
  const session = sessions.get(token);
  const privateReply = (content) => interaction.reply({ content, flags: MessageFlags.Ephemeral });
  if (!session || session.expiresAt <= Date.now()) {
    sessions.delete(token);
    await privateReply('Este panel terminó. Usa `xyb lookup` para abrir uno nuevo.');
    return true;
  }
  if (session.userId !== interaction.user.id || session.guildId !== interaction.guildId) {
    await privateReply('Este panel pertenece a quien lo abrió. Usa `xyb lookup` para abrir el tuyo.');
    return true;
  }
  if (interaction.isButton?.()) {
    if (action === 'search' || action === 'filter') {
      await interaction.showModal(modal(session, action));
      return true;
    }
    if (action === 'close') {
      await interaction.update(panel(session, { closed: true }));
      sessions.delete(token);
      return true;
    }
    if (action !== 'prev' && action !== 'next') return true;
    session.page += action === 'prev' ? -1 : 1;
  } else if (action === 'search-submit') {
    const query = interaction.fields.getTextInputValue('query').trim().toLowerCase();
    if (query && !/^[a-z0-9_.-]{1,32}$/.test(query)) {
      await privateReply('Busca con letras, números, puntos, guiones o guiones bajos (máximo 32 caracteres).');
      return true;
    }
    session.query = query;
    session.page = 0;
  } else if (action === 'filter-submit') {
    const type = interaction.fields.getTextInputValue('type').trim().toLowerCase();
    const lengthText = interaction.fields.getTextInputValue('length').trim();
    const modeText = interaction.fields.getTextInputValue('mode').trim().toLowerCase();
    const mode = modeText === 'simples' ? 'sin_simbolos' : modeText === 'números' ? 'numeros' : modeText || 'todos';
    if ((lengthText && (!/^\d+$/.test(lengthText) || +lengthText < 2 || +lengthText > 32))
      || !['', 'nombres', 'usernames', 'vanity', 'vanities'].includes(type) || !history.MODES.includes(mode)) {
      await privateReply('Lista: `nombres` o `vanities`. Longitud: 2 a 32 o vacío. Caracteres: `todos`, `letras`, `numeros` o `simples`.');
      return true;
    }
    session.type = type.startsWith('vanit') ? 'vanities' : 'usernames';
    session.length = lengthText ? Number(lengthText) : null;
    session.mode = mode;
    session.page = 0;
  } else return true;
  // Los modales nacen de un botón de este mensaje: update mantiene un panel.
  await interaction.update(panel(session));
  return true;
}

module.exports = {
  name: 'lookup',
  description: 'Busca nombres y vanities abandonados que XYB haya detectado.',
  usage: 'xyb lookup [vanity] [longitud 2-32] [texto]',
  guildOnly: true,
  resolveMember: false,
  slash: {
    description: 'Busca nombres y vanities abandonados detectados por XYB.',
    setup(builder) {
      return builder
        .addStringOption((option) => option.setName('tipo').setDescription('Lista que quieres ver')
          .addChoices({ name: 'Nombres', value: 'usernames' }, { name: 'Vanities', value: 'vanities' }))
        .addIntegerOption((option) => option.setName('longitud').setDescription('Cantidad de caracteres: 2 a 32').setMinValue(2).setMaxValue(32))
        .addStringOption((option) => option.setName('texto').setDescription('Texto que debe contener').setMaxLength(32));
    },
  },
  async execute({ args = [], isSlash, interaction, user, guild, reply, fail }) {
    let filters;
    if (isSlash) {
      const type = interaction.options.getString('tipo') ?? 'usernames';
      const length = interaction.options.getInteger('longitud');
      const query = interaction.options.getString('texto') ?? '';
      filters = parseArgs([type, ...(length ? [String(length)] : [])]);
      filters.query = query.trim().toLowerCase();
      if (filters.query && !/^[a-z0-9_.-]{1,32}$/.test(filters.query)) filters.error = USAGE;
    } else filters = parseArgs(args);
    if (filters.error) return fail(filters.error);
    const session = createSession(user, guild.id, filters);
    try { await reply(panel(session)); } catch (error) { sessions.delete(session.token); throw error; }
  },
  handleComponent,
  __test: { parseArgs, createSession, panel, modal, sessions, SESSION_MS },
};
