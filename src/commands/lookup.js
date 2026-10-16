const { randomBytes } = require('node:crypto');
const {
  ActionRowBuilder, ButtonBuilder, ButtonStyle, ContainerBuilder,
  MessageFlags, ModalBuilder, SectionBuilder, SeparatorBuilder,
  TextDisplayBuilder, TextInputBuilder, TextInputStyle, ThumbnailBuilder,
} = require('discord.js');
const history = require('../lib/username-lookup');
const logger = require('../logger');

const sessions = new Map();
const SESSION_MS = 15 * 60_000;
const MAX_SESSIONS = 1000;
const MODE_LABELS = { todos: 'Todos', letras: 'Letras', numeros: 'Números', sin_simbolos: 'Sin símbolos' };
const USAGE = 'Usa `.lookup 3`, `.lookup 4`, `.lookup vanity 5`, `.lookup todos` o `.lookup check nombre`. Longitud: 2 a 32; texto opcional después de la longitud.';

function parseArgs(args) {
  const rest = [...args].map((value) => value.toLowerCase());
  let type = 'usernames';
  if (['vanity', 'vanities'].includes(rest[0])) { type = 'vanities'; rest.shift(); }
  else if (['username', 'usernames', 'nombres'].includes(rest[0])) rest.shift();
  if (rest[0] === 'check') {
    const exactName = rest[1];
    if (rest.length !== 2 || !history.validName(type, exactName)) return { error: USAGE };
    return { type, length: exactName.length, query: exactName, exactName, mode: 'todos', page: 0 };
  }
  let length = 3;
  if (['todos', 'all'].includes(rest[0])) { length = null; rest.shift(); }
  if (/^\d+$/.test(rest[0] ?? '')) {
    length = Number(rest.shift());
    if (length < 2 || length > 32) return { error: USAGE };
  }
  const query = rest.join(' ');
  if (!validFilters({ type, length, query, mode: 'todos' })) return { error: USAGE };
  return { type, length, query, mode: 'todos', page: 0 };
}

function validFilters({ type, length, query, mode }) {
  return query.length <= (length ?? 32) && !query.includes('..')
    && [...query].every((character) => history.alphabet(type, mode).includes(character));
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
  session.suggestions = suggestions(session);
  sessions.set(token, session);
  return session;
}

function suggestions(filters, amount = 8) {
  const values = new Set();
  for (let attempt = 0; values.size < amount && attempt < amount * 80; attempt += 1) {
    const value = history.candidate(filters);
    if (value) values.add(value);
  }
  return [...values];
}

function button(session, action, emoji, style = ButtonStyle.Secondary, disabled = false) {
  return new ButtonBuilder().setCustomId(`lookup:${session.token}:${action}`)
    .setEmoji(emoji).setStyle(style).setDisabled(disabled);
}

function panel(session, { closed = false } = {}) {
  const result = history.search(session);
  session.page = result.page;
  const title = session.type === 'vanities' ? 'Vanity Lookup' : 'Username Lookup';
  const filters = [session.length ? `${session.length} caracteres` : 'Todas las longitudes'];
  if (session.mode !== 'todos') filters.push(MODE_LABELS[session.mode]);
  if (session.query) filters.push(`contiene \`${session.query}\``);
  const lines = result.entries.map(({ username, checkedAt }) =>
    `\`${username}\` · comprobado <t:${Math.floor(checkedAt / 1000)}:R>`);
  const suggested = result.entries.length ? '' : (session.suggestions?.length
    ? `**Sugerencias sin comprobar**\n${session.suggestions.map((username) => `\`${username}\``).join(' · ')}\n\n`
    : '');
  const empty = 'Todavía no hay coincidencias comprobadas con estos filtros. 🔎 busca otra tanda; ⚙️ cambia los filtros.';
  const caveat = session.type === 'vanities'
    ? 'Sin invitación activa; NO garantiza que puedas asignar esa vanity.'
    : 'Discord indicó disponibles al comprobarlos; no están reservados.';
  const container = new ContainerBuilder().setAccentColor(0x333333)
    .addSectionComponents(new SectionBuilder()
      .addTextDisplayComponents(new TextDisplayBuilder().setContent(`## ${title}\n-# ${filters.join(' · ')}`))
      .setThumbnailAccessory(new ThumbnailBuilder().setURL(session.avatar).setDescription('Avatar de quien consulta')))
    .addSeparatorComponents(new SeparatorBuilder())
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(lines.join('\n') || `${suggested}${empty}`))
    .addSeparatorComponents(new SeparatorBuilder())
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(
      `-# Página ${result.page + 1}/${result.pages} · ${result.total} resultados${closed ? ' · Cerrado' : ''}\n${session.notice ?? 'Preparando búsqueda global…'}\n-# ${caveat}`,
    ))
    .addActionRowComponents(new ActionRowBuilder().addComponents(
      button(session, 'prev', '◀️', ButtonStyle.Secondary, closed || result.page === 0),
      button(session, 'next', '▶️', ButtonStyle.Secondary, closed || result.page >= result.pages - 1),
      button(session, 'search', '🔎', ButtonStyle.Secondary, closed || Boolean(session.running)),
      button(session, 'close', '⛔', ButtonStyle.Danger, closed),
      button(session, 'filter', '⚙️', ButtonStyle.Secondary, closed || Boolean(session.running)),
    ));
  return { flags: MessageFlags.IsComponentsV2, components: [container], allowedMentions: { parse: [] } };
}

async function runSearch(session, edit, service = history) {
  session.running = true;
  session.notice = 'Consultando hasta 12 candidatos globales (aprox. 1 minuto)…';
  // Serializa ediciones: cerrar el panel no puede ser revertido por un progreso pendiente.
  const publish = () => {
    session.edits = (session.edits ?? Promise.resolve()).then(() => edit(panel(session, { closed: Boolean(session.cancelled) })));
    return session.edits;
  };
  try {
    await publish();
    const result = await service.discover(session, {
      exactName: session.exactName,
      shouldStop: () => Boolean(session.cancelled) || session.expiresAt <= Date.now(),
      onProgress: async ({ checked, found, total }) => {
        session.notice = `Consultando ${checked}/${total} · ${found} coincidencias en esta tanda…`;
        if (!session.cancelled) await publish();
      },
    });
    const statuses = {
      complete: `Tanda terminada: ${result.checked} consultados · ${result.found} coincidencias. 🔎 para otra tanda.`,
      busy: 'Ya hay otra búsqueda global en marcha. Inténtalo cuando termine.',
      limited: `Discord limitó las consultas. Reintenta ${result.retryAt ? `<t:${Math.ceil(result.retryAt / 1000)}:R>` : 'más tarde'}.`,
      restricted: 'Discord restringió la consulta. Se detuvo sin intentar saltar la restricción.',
      unavailable: 'Discord no dio una respuesta verificable. Inténtalo más tarde.',
      exhausted: 'No quedan candidatos nuevos con estos filtros. Cambia el texto o la longitud.',
      cancelled: 'Búsqueda detenida.',
      invalid: 'Nombre no válido para este tipo de consulta.',
    };
    session.notice = statuses[result.status] ?? 'Consulta terminada sin resultado verificable.';
    if (session.exactName && result.status === 'complete') {
      const label = { taken: 'Ocupado', available: 'Disponible al comprobarlo', unlinked: 'Sin invitación activa (asignación no garantizada)' }[result.last.status];
      session.notice = `\`${session.exactName}\`: ${label} · comprobado <t:${Math.floor(result.last.checkedAt / 1000)}:R>.`;
    }
    session.running = false;
    if (!session.cancelled) await publish();
  } catch (error) {
    // Nunca dejamos el panel atrapado en “Consultando 1/12” si Discord o una
    // edición del mensaje falla. El usuario debe poder reintentar o cambiar
    // filtros sin tener que mandar otro comando.
    logger.warn('Lookup detenido antes de terminar', error);
    session.notice = 'No se pudo completar esta tanda. Discord puede haber limitado la consulta; espera un momento y pulsa 🔎 para reintentar.';
    session.running = false;
    if (!session.cancelled) await publish().catch(() => {});
  } finally { session.running = false; }
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
  if (session.running && !['close', 'prev', 'next'].includes(action)) {
    await privateReply('Espera a que termine esta tanda, o ciérrala con ⛔.');
    return true;
  }
  if (interaction.isButton?.()) {
    if (action === 'search' || action === 'filter') {
      await interaction.showModal(modal(session, action));
      return true;
    }
    if (action === 'close') {
      session.cancelled = true;
      await interaction.deferUpdate();
      await session.edits?.catch(() => {});
      await interaction.editReply(panel(session, { closed: true }));
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
    if (!validFilters({ ...session, query })) {
      await privateReply('El texto no cabe en la longitud elegida o usa caracteres incompatibles. Cambia ⚙️ primero.');
      return true;
    }
    session.query = query;
    session.suggestions = suggestions(session);
    session.exactName = null;
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
    const filters = { type: type.startsWith('vanit') ? 'vanities' : 'usernames', length: lengthText ? Number(lengthText) : null, mode, query: session.query };
    if (!validFilters(filters)) filters.query = '';
    Object.assign(session, filters, { exactName: null });
    session.suggestions = suggestions(session);
    session.page = 0;
  } else return true;
  // Los modales nacen de un botón de este mensaje: update mantiene un panel.
  await interaction.update(panel(session));
  if (action.endsWith('-submit')) await runSearch(session, (payload) => interaction.editReply(payload));
  return true;
}

module.exports = {
  name: 'lookup',
  description: 'Comprueba candidatos de nombres globales y enlaces vanity.',
  usage: 'xyb lookup [vanity] [2-32/todos] [texto] | xyb lookup [vanity] check nombre',
  guildOnly: true,
  resolveMember: false,
  slash: {
    description: 'Comprueba nombres globales y enlaces vanity por longitud.',
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
      if (!length && filters.query.length > 3) filters.length = filters.query.length;
      if (!validFilters(filters)) filters.error = USAGE;
    } else filters = parseArgs(args);
    if (filters.error) return fail(filters.error);
    const session = createSession(user, guild.id, filters);
    try {
      session.running = true;
      const message = await reply(panel(session));
      await runSearch(session, (payload) => isSlash ? interaction.editReply(payload) : message.edit(payload));
    } catch (error) { sessions.delete(session.token); throw error; }
  },
  handleComponent,
  __test: { parseArgs, createSession, panel, modal, sessions, SESSION_MS, runSearch, validFilters, suggestions },
};
