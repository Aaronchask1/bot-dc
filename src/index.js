require('dotenv').config();
const path = require('node:path');
const dns = require('node:dns');

// En hosts donde IPv6 tarda o no tiene ruta hacia Discord, evita el intento
// fallido previo. No cambia la latencia física, pero reduce reconexiones.
try { dns.setDefaultResultOrder('ipv4first'); } catch { /* Node antiguo: usar orden por defecto. */ }

const {
  ActionRowBuilder,
  ActivityType,
  ButtonBuilder,
  ButtonStyle,
  Client,
  Collection,
  EmbedBuilder,
  Events,
  GatewayIntentBits,
  MessageFlags,
  PermissionFlagsBits,
  StringSelectMenuBuilder,
} = require('discord.js');
const { acquireInstanceLock, createReplayGuard } = require('./safety');
const extraCommands = require('./commands');
const prefixes = require('./lib/prefixes');
const snipe = require('./lib/snipe');
const welcome = require('./lib/welcome');
const hugs = require('./lib/hugs');
const marriageProps = require('./lib/marriage-props');
const members = require('./lib/members');
const lookup = require('./commands/lookup');
const kisses = require('./lib/kisses');
const profiles = require('./lib/profiles');
const profileCommand = require('./commands/profile');
const tradeCommand = require('./commands/trade');
const { prepareKissPayload } = require('./lib/kiss-media');
const animeMedia = require('./lib/anime-media');
const afk = require('./lib/afk');
const reminders = require('./lib/reminders');
const guildTag = require('./lib/guild-tag');
const polls = require('./lib/polls');
const logger = require('./logger');
const autoDelete = require('./lib/auto-delete');
const { createAutoresponder } = require('./lib/autoresponder');
const { createAutoReact } = require('./lib/autoreact');
const depositCommand = require('./commands/deposit');
const shopCommand = require('./commands/shop');
const bagCommand = require('./commands/bag');
const petCommand = require('./commands/pet');
const gamesCommand = require('./commands/games');
const quoteCommand = require('./commands/quote');

const PREFIX = 'xyb';
const REPEATED_MESSAGE_LIMIT = 8;
const REPEATED_MESSAGE_WINDOW_MS = 5 * 60_000;
const AUTOMOD_TIMEOUT_MS = 60 * 60_000;
const MAX_PURGE_MESSAGES = 1000;
const repeatTracker = new Map();
const claimMessage = createReplayGuard();
const claimInteraction = createReplayGuard();
const autoresponder = createAutoresponder();
const autoreact = createAutoReact();
const LOCK_FILE = path.join(__dirname, '..', 'data', 'bot.lock');
// Los besos y regalos son imágenes grandes, revisadas a ojo. Discord las
// dibuja a su resolución real, por eso estas listas evitan GIF pequeños.
const KISS_IMAGES = [
  'https://media.tenor.com/bUDe38Y7hLMAAAAe/my-little-monster-anime.png',
  'https://giffiles.alphacoders.com/188/188468.gif',
  'https://i.imgur.com/nmNTvsD.gif',
  'https://s.animeanime.jp/imgs/p/64XVvff3mD9cFhi_PU1_DqGg_6ytrq_oqaqr/373968.jpg?zoom=spacing',
  'https://animeblog-media.nyc3.digitaloceanspaces.com/2025/12/A-Sign-of-Affection-Ep-7-img-19-768x432.png',
  'https://i.imgur.com/fgGGgQo.gif',
  'https://i.imgur.com/cBbDGxZ.gif',
  'https://i.imgur.com/LtEu1gc.gif',
  'https://media1.tenor.com/m/YKd-wOisWB0AAAAd/anime-kiss.gif',
  'https://media1.tenor.com/m/6Wd5IsZn8EwAAAAd/anime-kiss.gif',
  'https://media1.tenor.com/m/2u67zOB43esAAAAd/cute-anime.gif',
  'https://media1.tenor.com/m/YMpWjNqGihoAAAAd/anime-girl.gif',
  'https://conteudo.imguol.com.br/c/entretenimento/6b/2024/11/13/okarun-e-momo-batem-seus-dentes-e-consequentemente-se-beijam-em-dan-da-dan-1731524889868_v2_4x3.png',
  'https://static.zerochan.net/Gekkan.Shoujo.Nozaki-kun.full.1848998.jpg',
  'https://megapx-assets.dcard.tw/images/f03ae6cb-ee96-4b89-aa95-ffe660aad1ab/1280.jpeg',
  'https://i0.hdslb.com/bfs/archive/6a40cf23518888c0aa5346ba9ca659771463d2df.jpg',
  'https://i.pinimg.com/originals/82/e2/f6/82e2f67624ea537421acd3bee5645cf4.jpg',
];
// El beso devuelto: mismas reglas, nunca repite de la lista de arriba.
const KISS_GIFT_IMAGES = [
  'https://i.imgur.com/kFkDuX8.gif',
  'https://i.imgur.com/b9jfVkx.gif',
  'https://i.imgur.com/cuMVXHS.gif',
  'https://i.imgur.com/lmY5soG.gif',
  'https://i.imgur.com/QqtVl6T.gif',
  'https://i.pinimg.com/736x/16/0a/c9/160ac9de72b0c15792d2c37e48a54f84.jpg',
  'https://static.animecorner.me/2023/12/1702864642-69461.png',
];
// Rechazo: anime y revisado a ojo. Tenor sirve estas animaciones a 220 px;
// es suficiente para el gesto breve y se valida con un mínimo propio.
const KISS_REJECT_IMAGES = [
  'https://media.tenor.com/Y3BYGYVRPJcAAAAM/sad-anime-girl.gif',
  'https://media.tenor.com/PwsCMWJtYi0AAAAM/i-refuse-no.gif',
  'https://media.tenor.com/fMSMIlEjSoMAAAAM/refuse-head-shake.gif',
  'https://media.tenor.com/EAwWeGvv4B8AAAAM/touch-no.gif',
  'https://media.tenor.com/kddUkOv5fC4AAAAM/anime-embarrassment.gif',
  'https://media.tenor.com/PYOMyiz9VckAAAAM/sad-anime-boy-crying.gif',
];


const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    // Opcional: actívalo con MEMBERS_INTENT=true en .env y habilitando
    // "Server Members Intent" en el portal de desarrolladores.
    ...(process.env.MEMBERS_INTENT === 'true' ? [GatewayIntentBits.GuildMembers] : []),
  ],
});

autoDelete.install(client);

const HELP_CATEGORIES = [
  { id: 'social', label: '💞 Social', description: 'Besos, abrazos, acciones y matrimonio.' },
  { id: 'perfil', label: '🪪 Perfil y utilidad', description: 'Perfiles, imágenes, citas y herramientas.' },
  { id: 'comunidad', label: '🎉 Comunidad', description: 'AFK, encuestas, recordatorios y sugerencias.' },
  { id: 'economia', label: '💰 Economía y mascotas', description: 'Trabajo, pesca, banco, tienda y mascotas.' },
  { id: 'diversion', label: '🎲 Diversión', description: 'Suerte, trivia, minijuegos y texto divertido.' },
  { id: 'servidor', label: '⚙️ Servidor', description: 'Bienvenida, prefijos, roles y automatizaciones.' },
  { id: 'moderacion', label: '🛡️ Moderación', description: 'Limpieza y acciones de moderación.' },
];

const CORE_HELP_COMMANDS = [
  { category: 'social', usage: 'kiss|kc usuario', description: 'Envía un beso con botones para responder.' },
  { category: 'perfil', usage: 'help', description: 'Abre este menú por categorías.' },
  { category: 'perfil', usage: 'server', description: 'Muestra la ficha del servidor.' },
  { category: 'moderacion', usage: 'kick usuario [razón]', description: 'Expulsa a una persona.' },
  { category: 'moderacion', usage: 'ban usuario [razón]', description: 'Banea a una persona.' },
  { category: 'moderacion', usage: 'unban ID|all [razón]', description: 'Quita un ban por ID o desbanea a todas las personas.' },
  { category: 'moderacion', usage: 'mute usuario minutos [razón]', description: 'Silencia temporalmente.' },
  { category: 'moderacion', usage: 'unmute usuario [razón]', description: 'Quita un silencio.' },
  { category: 'moderacion', usage: 'lock|unlock', description: 'Cierra o abre el canal actual.' },
  { category: 'moderacion', usage: 'purge|c 1-1000', description: 'Borra mensajes recientes.' },
  { category: 'moderacion', usage: 'purge|c bots [1-1000]', description: 'Borra solo mensajes de bots.' },
  { category: 'moderacion', usage: 'pg|apg', description: 'Borra hasta 1000 de tus propios mensajes.' },
];

const EXTRA_COMMAND_CATEGORIES = {
  hug: 'social', marry: 'social', wife: 'social', divorce: 'social', act: 'social',
  img: 'perfil', avatar: 'perfil', banner: 'perfil', ping: 'perfil', botinfo: 'perfil', snipe: 'perfil', lookup: 'perfil', quote: 'perfil', profile: 'perfil',
  afk: 'comunidad', remind: 'comunidad', poll: 'comunidad', suggest: 'comunidad',
  fun: 'diversion', games: 'diversion',
  balance: 'economia', work: 'economia', fish: 'economia', mine: 'economia', daily: 'economia', bank: 'economia', deposit: 'economia', pay: 'economia', rich: 'economia', bag: 'economia', shop: 'economia', trade: 'economia', pet: 'economia',
  add: 'servidor', autoresponder: 'servidor', autoreact: 'servidor', prefix: 'servidor', welcome: 'servidor', welcomevars: 'servidor', welcometest: 'servidor', roles: 'servidor',
  purge: 'moderacion', unban: 'moderacion', rol: 'moderacion', steal: 'moderacion',
};

function helpCommands(category) {
  const core = CORE_HELP_COMMANDS.filter((command) => !category || command.category === category);
  const extra = extraCommands.listCommands()
    // La limpieza normal y la de bots se documentan juntas arriba.
    .filter((command) => command.name !== 'purge')
    .filter((command) => !category || EXTRA_COMMAND_CATEGORIES[command.name] === category)
    .map((command) => ({
      category: EXTRA_COMMAND_CATEGORIES[command.name] ?? 'perfil',
      usage: (command.usage ?? `${PREFIX} ${command.name}`).replace(new RegExp(`^${PREFIX}\\s+`, 'i'), ''),
      description: `${command.description}${command.aliases?.length ? ` · Alias: ${command.aliases.slice(0, 4).join(', ')}` : ''}`,
    }));
  return [...core, ...extra];
}

function commandGrid(commands) {
  const names = commands.map((command) => command.usage.split(/[\s|]/)[0]).filter(Boolean);
  const columns = 4; const rows = [];
  for (let index = 0; index < names.length; index += columns) rows.push(names.slice(index, index + columns).map((name) => name.padEnd(15)).join('').trimEnd());
  return `\`\`\`\n${rows.join('\n')}\n\`\`\``;
}

function findHelpCommand(query) {
  const name = String(query ?? '').toLowerCase().trim();
  const extra = extraCommands.findCommand(name);
  if (extra) return { name: extra.name, aliases: extra.aliases ?? [], description: extra.description, usage: extra.usage, slash: Boolean(extra.slash), guildOnly: extra.guildOnly !== false };
  const core = CORE_HELP_COMMANDS.find((command) => command.usage.split(/[\s|]/).includes(name));
  return core ? { name, aliases: [], description: core.description, usage: `${PREFIX} ${core.usage}`, slash: true, guildOnly: true } : null;
}

function helpEmbed(category = null) {
  const selected = HELP_CATEGORIES.find((item) => item.id === category);
  const commands = helpCommands(category);
  const title = selected ? `${selected.label} · Comandos` : '📚 Mis comandos';
  const description = selected
    ? [`> ${selected.description}`, '', '📖 **Comandos disponibles**', commandGrid(commands), `**Atajos:** ${commands.map((command) => `\`${PREFIX} ${command.usage}\``).join(' · ')}`, `Usa \`${PREFIX} help <comando>\` para ver detalles y ejemplos.`].join('\n')
    : [
      '> **Menú de ayuda**',
      `Tengo **${helpCommands().length} comandos** en **${HELP_CATEGORIES.length} categorías** listos para ti.`,
      '',
      '📚 **Categorías**',
      ...HELP_CATEGORIES.map((item) => `• **${item.label}** — ${helpCommands(item.id).length} comandos · ${item.description}`),
      '',
      `Elige una categoría abajo o escribe \`${PREFIX} help <categoría|comando>\`.`,
    ].join('\n');

  return new EmbedBuilder()
    .setColor(0xFF8C69)
    .setTitle(title)
    .setDescription(description)
    .setFooter({ text: `${PREFIX} help [categoría|comando] · 🐰 xyb` });
}

function helpCommandEmbed(command) {
  const aliases = command.aliases?.length ? command.aliases.map((alias) => `\`${PREFIX} ${alias}\``).join(', ') : 'Sin alias';
  return new EmbedBuilder().setColor(0xFF8C69).setTitle(`📖 ${PREFIX} ${command.name}`).setDescription(`> ${command.description}`)
    .addFields({ name: '⌨️ Uso', value: `\`${command.usage}\`` }, { name: '🔁 Alias', value: aliases, inline: true }, { name: '⚙️ Disponible en', value: `${command.slash ? '`/` y prefijo' : 'prefijo'}${command.guildOnly ? ' · servidor' : ''}`, inline: true })
    .setFooter({ text: `Vuelve con ${PREFIX} help · 🐰 xyb` });
}

function helpComponents(category = null) {
  const menu = new StringSelectMenuBuilder()
    .setCustomId('help:category')
    .setPlaceholder('Selecciona una categoría')
    .addOptions([
      { label: 'Todos los comandos', value: 'all', description: 'Vuelve al resumen general.', default: !category },
      ...HELP_CATEGORIES.map((item) => ({
        label: item.label.slice(2), value: item.id, description: item.description, default: item.id === category,
      })),
    ]);
  return [new ActionRowBuilder().addComponents(menu), new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('help:home').setLabel('Inicio').setEmoji('🏠').setStyle(ButtonStyle.Secondary).setDisabled(!category),
    new ButtonBuilder().setCustomId('help:close').setLabel('Cerrar').setEmoji('✖').setStyle(ButtonStyle.Danger),
  )];
}

function helpText(category = null) {
  return helpEmbed(category).toJSON().description;
}

async function sendHelp(target, category = null, command = null) {
  const payload = { embeds: [command ? helpCommandEmbed(command) : helpEmbed(category)], components: helpComponents(category) };
  if (target.isInteraction) return target.interaction.reply(payload);
  return target.message.reply(payload);
}

const PREFIX_ALIASES = {
  expulsar: 'kick',
  banear: 'ban',
  sacarban: 'unban',
  silenciar: 'mute',
  mutear: 'mute',
  desmutear: 'unmute',
};

const MODERATION_PERMISSIONS = {
  kick: PermissionFlagsBits.KickMembers,
  ban: PermissionFlagsBits.BanMembers,
  unban: PermissionFlagsBits.BanMembers,
  mute: PermissionFlagsBits.ModerateMembers,
  unmute: PermissionFlagsBits.ModerateMembers,
  lock: PermissionFlagsBits.ManageChannels,
  unlock: PermissionFlagsBits.ManageChannels,
};

async function findRecentMessages(channel, predicate, maximum) {
  const selected = [];
  const cutoff = Date.now() - (14 * 24 * 60 * 60 * 1000);
  let before;
  let scanned = 0;

  while (selected.length < maximum && scanned < MAX_PURGE_MESSAGES) {
    const batch = await channel.messages.fetch({ limit: 100, before });
    if (!batch.size) break;
    scanned += batch.size;
    for (const message of batch.values()) {
      if (message.createdTimestamp < cutoff) continue;
      if (predicate(message)) selected.push(message);
      if (selected.length >= maximum) break;
    }
    before = batch.last().id;
    if (batch.size < 100) break;
  }
  return selected;
}

async function deleteRecentMessages(channel, messages) {
  let deleted = 0;
  for (let index = 0; index < messages.length; index += 100) {
    const batch = new Collection(messages.slice(index, index + 100).map((message) => [message.id, message]));
    const result = await channel.bulkDelete(batch, true);
    deleted += result.size;
  }
  return deleted;
}

async function runPurge(channel, amount, authorId = null) {
  if (!channel?.isTextBased?.() || !channel.messages?.fetch || !channel.bulkDelete) {
    throw new Error('Este canal no admite borrar mensajes.');
  }
  const messages = await findRecentMessages(channel, (message) => !authorId || message.author.id === authorId, amount);
  return deleteRecentMessages(channel, messages);
}

function isManageable(target, action) {
  if (action === 'kick') return target.kickable;
  if (action === 'ban') return target.bannable;
  return target.moderatable;
}

async function executeModeration({ guild, channel, actor, command, target, value, reason }) {
  const auditReason = `${actor.user.tag}: ${reason || 'Sin razón indicada'}`;
  switch (command) {
    case 'kick':
      await target.kick(auditReason);
      return `Expulsé a **${target.user.tag}**.`;
    case 'ban':
      await target.ban({ deleteMessageSeconds: 0, reason: auditReason });
      return `Baneé a **${target.user.tag}**.`;
    case 'unban':
      await guild.members.unban(value, auditReason);
      return `Quité el ban de <@${value}>.`;
    case 'mute':
      await target.timeout(value * 60_000, auditReason);
      return `Silencié a **${target.user.tag}** por **${value} minutos**.`;
    case 'unmute':
      await target.timeout(null, auditReason);
      return `Quité el silencio de **${target.user.tag}**.`;
    case 'lock':
      await channel.permissionOverwrites.edit(guild.roles.everyone, { SendMessages: false }, auditReason);
      return '🔒 Listo papi, ya lo locké: el canal quedó cerrado.';
    case 'unlock':
      await channel.permissionOverwrites.edit(guild.roles.everyone, { SendMessages: null }, auditReason);
      return '🔓 Listo papi, ya lo unlocké: el canal quedó abierto.';
    default:
      throw new Error('Comando de moderación desconocido.');
  }
}

async function handlePrefixModeration(message) {
  if (!message.guild) return false;
  const parts = message.content.trim().split(/\s+/);
  if (parts[0]?.toLowerCase() !== PREFIX || !parts[1]) return false;

  const command = PREFIX_ALIASES[parts[1].toLowerCase()] || parts[1].toLowerCase();
  if (!Object.hasOwn(MODERATION_PERMISSIONS, command)) return false;

  if (!message.member.permissions.has(MODERATION_PERMISSIONS[command])) {
    await message.reply('No tienes permiso para usar ese comando.');
    return true;
  }

  if ((command === 'lock' || command === 'unlock') && message.channel.permissionOverwrites) {
    try {
      await message.reply(await executeModeration({ guild: message.guild, channel: message.channel, actor: message.member, command, reason: parts.slice(2).join(' ') }));
    } catch (error) {
      await message.reply(`No pude ${command === 'lock' ? 'cerrar' : 'abrir'} este canal. Verifica que el bot tenga **Gestionar canales**.`);
    }
    return true;
  }

  if (command === 'unban') {
    const userId = parts[2];
    if (!/^\d{17,20}$/.test(userId || '')) {
      await message.reply(`Uso: \`${PREFIX} unban ID_DEL_USUARIO [razón]\`.`);
      return true;
    }
    try {
      await message.reply(await executeModeration({ guild: message.guild, actor: message.member, command, value: userId, reason: parts.slice(3).join(' ') }));
    } catch (error) {
      await message.reply('No pude quitar ese ban. Comprueba que el ID sea correcto y que el bot tenga **Banear miembros**.');
    }
    return true;
  }

  const target = message.mentions.members.first() ?? (await members.resolveMemberAsync(message.guild, parts[2])).member;
  if (!target) {
    await message.reply(`Escribe el nombre o menciona al usuario. Ejemplo: \`${PREFIX} ${command} usuario${command === 'mute' ? ' 10' : ''}\`.`);
    return true;
  }
  if (target.id === message.author.id || !isManageable(target, command)) {
    await message.reply('No puedo moderar a ese usuario. Revisa la jerarquía de roles y los permisos del bot.');
    return true;
  }

  const minuteValue = command === 'mute' ? Number(parts[3]) : null;
  if (command === 'mute' && (!Number.isInteger(minuteValue) || minuteValue < 1 || minuteValue > 40_320)) {
    await message.reply(`Indica una duración entre 1 y 40320 minutos. Ejemplo: \`${PREFIX} mute @usuario 10\`.`);
    return true;
  }

  const reasonStart = command === 'mute' ? 4 : 3;
  try {
    await message.reply(await executeModeration({ guild: message.guild, actor: message.member, command, target, value: minuteValue, reason: parts.slice(reasonStart).join(' ') }));
  } catch (error) {
    await message.reply('No pude completar la acción. Verifica que el bot tenga el permiso necesario y un rol por encima del usuario.');
  }
  return true;
}


const addKiss = kisses.add;

function randomKissImage(kind, images) {
  return animeMedia.pick(kind, images);
}

const KISS_STYLES = {
  send: { color: 0xFF6B9A, images: KISS_IMAGES, pool: 'kiss' },
  gift: { color: 0xFFC2DA, images: KISS_GIFT_IMAGES, pool: 'kiss_return' },
  reject: { color: 0xED4245, images: KISS_REJECT_IMAGES, pool: 'kiss_reject' },
};

function kissPayload(from, to, count, mode = 'send') {
  const style = KISS_STYLES[mode] ?? KISS_STYLES.send;
  const image = randomKissImage(style.pool, style.images);
  const pathname = new URL(image).pathname;
  const extension = pathname.match(/\.(gif|png|jpe?g|webp)$/i)?.[1] ?? 'gif';
  const filename = `xyb-${mode}.${extension}`;
  const times = `✨ Se han besado **${count}** ${count === 1 ? 'vez' : 'veces'}.`;
  const description = {
    send: `${from} le da un dulce beso a ${to}.\n\n${times}`,
    gift: `💞 ${to} le devuelve el beso a ${from}.\n\n${times}`,
    reject: `💔 ${to} rechazó el beso de ${from}.\n\nEl contador compartido se conserva.`,
  }[mode] ?? `${from} le da un dulce beso a ${to}.\n\n${times}`;

  return {
    embeds: [
      new EmbedBuilder()
        .setColor(style.color)
        .setDescription(description)
        // Se adjunta para que Discord la sirva desde su propio CDN; el embed
        // conserva la imagen debajo del texto mediante attachment://.
        .setImage(`attachment://${filename}`)
        .setFooter({ text: '🐰 xyb' }),
    ],
    files: [{ attachment: image, name: filename }],
  };
}

function kissButtons(fromId, toId) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`kiss:return:${fromId}:${toId}`).setLabel('💞 Corresponder').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(`kiss:reject:${fromId}:${toId}`).setLabel('❌ Rechazar').setStyle(ButtonStyle.Danger),
  );
}

// Quita los botones del beso original cuando alguien ya respondió.
async function clearKissButtons(interaction) {
  try {
    await interaction.message.edit({ components: [] });
  } catch (error) {
    logger.warn('No pude quitar los botones del beso original', error);
  }
}

const VERIFICATION_LABELS = {
  0: 'Ninguna',
  1: 'Baja',
  2: 'Media',
  3: 'Alta',
  4: 'Muy alta',
};

function serverComponents() {
  return [new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId('server:details')
      .setPlaceholder('🏠 Servidor')
      .addOptions(
        { label: 'Ícono', value: 'icon', emoji: '🖼️', description: 'Ver el ícono del servidor.' },
        { label: 'Banner', value: 'banner', emoji: '🌄', description: 'Ver el banner del servidor.' },
        { label: 'Descubrimiento', value: 'discover', emoji: '🔎', description: 'Ver funciones y verificación.' },
      ),
  )];
}

async function serverEmbed(guild) {
  const owner = await guild.fetchOwner();
  const creationTime = Math.floor(guild.createdTimestamp / 1000);
  return new EmbedBuilder()
    .setColor(0xF28C5B)
    .setAuthor({ name: guild.name, iconURL: guild.iconURL({ size: 128 }) || undefined })
    .setDescription([
      `🆔 **ID:** \`${guild.id}\``,
      `👑 **Dueño/a:** ${owner.user}`,
      `📅 **Fecha de creación:** <t:${creationTime}:D>`,
      `👥 **Miembros:** ${guild.memberCount}`,
      `💬 **Canales:** ${guild.channels.cache.size}`,
      `⚔️ **Roles:** ${Math.max(guild.roles.cache.size - 1, 0)}`,
      `🎈 **Emojis:** ${guild.emojis.cache.size}`,
      `🚀 **Mejoras:** ${guild.premiumSubscriptionCount || 0}`,
      `🔒 **Verificación:** ${VERIFICATION_LABELS[guild.verificationLevel] || 'Desconocida'}`,
    ].join('\n'))
    .setThumbnail(guild.iconURL({ size: 512 }) || null);
}

function serverDetailEmbed(guild, choice) {
  const icon = guild.iconURL({ size: 1024 });
  const banner = guild.bannerURL({ size: 1024 });
  if (choice === 'icon') {
    return new EmbedBuilder()
      .setColor(0xF28C5B)
      .setTitle(`Ícono de ${guild.name}`)
      .setImage(icon || null)
      .setDescription(icon ? '[Abrir ícono en tamaño completo](' + icon + ')' : 'Este servidor no tiene ícono.');
  }
  if (choice === 'banner') {
    return new EmbedBuilder()
      .setColor(0xF28C5B)
      .setTitle(`Banner de ${guild.name}`)
      .setImage(banner || null)
      .setDescription(banner ? '[Abrir banner en tamaño completo](' + banner + ')' : 'Este servidor no tiene banner.');
  }
  return new EmbedBuilder()
    .setColor(0xF28C5B)
    .setTitle(`Descubrimiento de ${guild.name}`)
    .setDescription([
      `🔒 **Verificación:** ${VERIFICATION_LABELS[guild.verificationLevel] || 'Desconocida'}`,
      `✨ **Funciones:** ${guild.features.length ? guild.features.join(', ') : 'Sin funciones públicas especiales.'}`,
      `🚀 **Nivel de mejoras:** ${guild.premiumTier}`,
    ].join('\n'));
}

function repeatedMessageCount(message) {
  const text = message.content.trim().toLowerCase().replace(/\s+/g, ' ');
  if (!text) return 0;

  const key = `${message.guild.id}:${message.author.id}`;
  const now = Date.now();
  const previous = repeatTracker.get(key);
  if (previous?.cooldownUntil > now) return 0;
  const times = previous?.text === text
    ? previous.times.filter((time) => now - time <= REPEATED_MESSAGE_WINDOW_MS)
    : [];

  times.push(now);
  repeatTracker.set(key, { text, times });
  return times.length;
}

async function applyRepeatSpamProtection(message) {
  if (!message.guild || message.author.id === message.guild.ownerId) return false;

  const count = repeatedMessageCount(message);
  if (count < REPEATED_MESSAGE_LIMIT) return false;

  // Evita que un mensaje posterior vuelva a intentar sancionar antes de que pase una hora.
  repeatTracker.set(`${message.guild.id}:${message.author.id}`, {
    text: message.content.trim().toLowerCase().replace(/\s+/g, ' '),
    times: [],
    cooldownUntil: Date.now() + AUTOMOD_TIMEOUT_MS,
  });

  if (!message.member?.moderatable) {
    await message.channel.send(`No pude silenciar a ${message.author}: el rol del bot debe estar por encima del suyo y necesita **Moderar miembros**.`);
    return true;
  }

  try {
    await message.member.timeout(AUTOMOD_TIMEOUT_MS, 'Protección automática: 8 mensajes repetidos en menos de 5 minutos.');
    await message.channel.send(`🔇 ${message.author} fue silenciado automáticamente durante **1 hora** por enviar 8 mensajes repetidos.`);
  } catch (error) {
    await message.channel.send(`No pude aplicar el silencio automático a ${message.author}. Verifica los permisos y la jerarquía del bot.`);
  }
  return true;
}

// Limpia el registro de mensajes repetidos para que no crezca sin fin.
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of repeatTracker) {
    const expired = (entry.cooldownUntil ?? 0) < now
      && (entry.times ?? []).every((time) => now - time > REPEATED_MESSAGE_WINDOW_MS);
    if (expired) repeatTracker.delete(key);
  }
}, 10 * 60_000).unref();

client.once(Events.ClientReady, async (readyClient) => {
  try {
    await readyClient.user.setPresence({
      status: 'online',
      activities: [{ name: `${PREFIX} help`, type: ActivityType.Watching }],
    });
  } catch (error) {
    logger.warn('No pude actualizar la presencia', error);
  }
  logger.info(`Conectado como ${readyClient.user.tag} en ${readyClient.guilds.cache.size} servidor(es). PID ${process.pid}.`);
  // Once Discord is online, fill the persistent 60-image pools in the
  // background. Keeping this out of module loading prevents test/startup
  // work from being blocked by an image provider.
  animeMedia.warm({
    kiss: KISS_IMAGES, kiss_return: KISS_GIFT_IMAGES, kiss_reject: KISS_REJECT_IMAGES,
    hug: hugs.HUG_IMAGES, proposal: marriageProps.PROPOSE_IMAGES,
    marriage_accept: marriageProps.ACCEPT_IMAGES, marriage_reject: marriageProps.REJECT_IMAGES,
  });
  reminders.start(readyClient);
  guildTag.start(readyClient);

  if (process.env.MEMBERS_INTENT !== 'true') {
    const configured = readyClient.guilds.cache.some((guild) => Boolean(welcome.getConfig(guild.id).channel));
    if (configured) {
      logger.warn('Hay bienvenida configurada pero MEMBERS_INTENT no está activo: activa "Server Members Intent" en el portal y pon MEMBERS_INTENT=true en .env.');
    }
  }
});

client.on(Events.Error, (error) => logger.error('Error del cliente de Discord', error));
client.on(Events.Warn, (warning) => logger.warn('Aviso de Discord', warning));
client.on(Events.ShardDisconnect, (event, shardId) => logger.warn(`Gateway desconectado (shard ${shardId}). Reintentando...`));
client.on(Events.ShardResume, (shardId) => logger.info(`Gateway reanudado (shard ${shardId}).`));

// Mensajes borrados para que `xyb snipe` pueda recuperarlos.
client.on(Events.MessageDelete, (message) => {
  snipe.trackDeletion(message).catch((error) => logger.error('Fallo guardando el mensaje borrado', error));
});

// Bienvenida configurada desde `xyb welcome`. Necesita el intent Server Members.
client.on(Events.GuildMemberAdd, (member) => welcome.handleMemberAdd(member));

/**
 * Los prefijos extra que se agregan con `xyb prefix add !` se reescriben a `xyb`
 * para que toda la lógica de siempre los entienda sin duplicar comandos.
 */
function normalizeCustomPrefix(message) {
  const content = message.content ?? '';
  const trimmed = content.trim();
  if (!trimmed || trimmed.toLowerCase().startsWith(PREFIX)) return false;

  // Atajo visual del recordatorio: `xrm 10m` equivale a `xyb rm 10m`.
  if (/^xrm(?:\s|$)/i.test(trimmed)) {
    message.content = `${PREFIX} rm${trimmed.slice(3)}`;
    return true;
  }
  // Atajo visual de la mochila: `xbag` equivale a `xyb bag`.
  if (/^xbag(?:\s|$)/i.test(trimmed)) {
    message.content = `${PREFIX} bag${trimmed.slice(4)}`;
    return true;
  }

  // Atajo de la captura: .lookup 3, sin cambiar los prefijos de otros comandos.
  if (/^\.lookup(?:\s|$)/i.test(trimmed)) {
    message.content = `${PREFIX} ${trimmed.slice(1)}`;
    return true;
  }

  // El prefijo puede ir pegado ("!kiss") o con espacio ("! kiss"): se busca
  // el más largo que coincida para no partir "!xyb" a la mitad.
  const word = trimmed.split(/\s+/)[0].toLowerCase();
  const match = prefixes.getPrefixes(message.guild?.id)
    .filter((prefix) => word === prefix || word.startsWith(prefix))
    .sort((first, second) => second.length - first.length)[0];
  if (!match) return false;

  // El espacio de sobra de "! kiss" se junta para no romper el comando.
  message.content = `${PREFIX} ${trimmed.slice(match.length)}`.replace(/\s+/g, ' ').trim();
  return true;
}

client.on(Events.MessageCreate, async (message) => {
  if (message.author.bot) return;
  // Si Discord reenvía el mismo mensaje, aquí se descarta y no se responde dos veces.
  if (!claimMessage(message.id)) return;

  try {
    await handleMessage(message);
  } catch (error) {
    logger.error(`Fallo procesando el mensaje ${message.id} de ${message.author.tag}`, error);
    try {
      await message.reply('Hubo un error procesando ese comando. Revisa `logs/bot.log`.');
    } catch {
      // Si ya no se puede responder, se deja registrado en el log.
    }
  }
});

async function handleMessage(message) {
  if (await applyRepeatSpamProtection(message)) return;
  if (message.guild && !message.author.bot) profiles.observe(message.guild.id, message.author.id);
  // AFK nunca debe retrasar la respuesta de un comando. Sus fallos se manejan
  // internamente y se envía como tarea independiente.
  void afk.handleMessage(message);

  normalizeCustomPrefix(message);
  const responded = await autoresponder.handle(message);
  void autoreact.handle(message);
  if (responded) return;
  if (await extraCommands.handlePrefixCommand(message)) return;

  const botMention = new RegExp(`^<@!?${client.user.id}>\\s*$`);
  if (botMention.test(message.content.trim())) {
    await message.reply(`Mi prefijo es \`${PREFIX}\`. Usa \`${PREFIX} help\` o \`/help\`.`);
    return;
  }

  const normalized = message.content.trim().toLowerCase();
  const helpMatch = normalized.match(new RegExp(`^${PREFIX}\\s+help(?:\\s+(.+))?$`, 'i'));
  if (helpMatch) {
    const query = helpMatch[1]?.trim(); const category = query === 'all' ? null : query;
    const isCategory = !category || HELP_CATEGORIES.some((item) => item.id === category);
    const command = isCategory ? null : findHelpCommand(category);
    if (!isCategory && !command) return message.reply(`No encontré ese comando. Usa \`${PREFIX} help\` y elige una categoría.`);
    await sendHelp({ message }, isCategory ? category : null, command);
    return;
  }

  if (normalized === `${PREFIX} server`) {
    if (!message.guild) {
      await message.reply('Este comando solo se puede usar dentro de un servidor.');
      return;
    }
    await message.reply({ embeds: [await serverEmbed(message.guild)], components: serverComponents() });
    return;
  }

  const messageParts = message.content.trim().split(/\s+/);
  const isKissCommand = messageParts[0]?.toLowerCase() === PREFIX
    && ['kiss', 'kc'].includes(messageParts[1]?.toLowerCase());
  if (isKissCommand) {
    if (!message.guild) {
      await message.reply('Los besos solo funcionan dentro de un servidor.');
      return;
    }
    const rawTarget = messageParts.slice(2).join(' ');
    const mentioned = message.mentions.users.first();
    const found = mentioned ? { member: null } : await members.resolveMemberAsync(message.guild, rawTarget);
    const target = mentioned ?? found.member?.user;
    if (!target || target.bot || target.id === message.author.id) {
      const detail = found.reason === 'ambiguous'
        ? 'Hay varias personas con ese nombre; menciónala o usa su ID.'
        : process.env.MEMBERS_INTENT !== 'true'
          ? 'Para buscar por nombre, activa **Server Members Intent** en el portal de Discord y pon `MEMBERS_INTENT=true` en `.env`. Mientras tanto, menciona a la persona.'
          : `No encontré ese nombre. Revisa cómo aparece en el servidor o menciónalo.`;
      await message.reply(detail);
      return;
    }
    const count = addKiss(message.guild.id, message.author.id, target.id);
    await message.channel.send({
      ...await prepareKissPayload(kissPayload(message.author, target, count)),
      components: [kissButtons(message.author.id, target.id)],
    });
    return;
  }

  const commandParts = message.content.trim().split(/\s+/);
  const commandName = commandParts[1]?.toLowerCase();
  if (commandParts[0]?.toLowerCase() === PREFIX && (commandName === 'purge' || commandName === 'c')) {
    if (!message.member.permissions.has(PermissionFlagsBits.ManageMessages)) {
      await message.reply('Necesitas el permiso **Gestionar mensajes** para usar este comando.');
      return;
    }
    const amount = Number(commandParts[2]);
    if (!Number.isInteger(amount) || amount < 1 || amount > MAX_PURGE_MESSAGES) {
      await message.reply(`Uso: \`${PREFIX} ${commandName} 1-1000\`.`);
      return;
    }
    try {
      const deleted = await runPurge(message.channel, amount);
      await message.channel.send(`🧹 Se borraron **${deleted}** mensajes recientes.`);
    } catch (error) {
      await message.reply('No pude borrar los mensajes. El bot necesita **Gestionar mensajes**.');
    }
    return;
  }

  if (commandParts[0]?.toLowerCase() === PREFIX && (commandName === 'pg' || commandName === 'apg')) {
    if (commandParts[2]) {
      await message.reply(`Uso: \`${PREFIX} ${commandName}\`. Para mensajes de bots usa \`${PREFIX} purge bots\` o \`${PREFIX} c bots\`.`);
      return;
    }
    try {
      const deleted = await runPurge(message.channel, MAX_PURGE_MESSAGES, message.author.id);
      await message.channel.send(`🧹 ${message.author}, borré **${deleted}** de tus mensajes recientes.`);
    } catch (error) {
      await message.reply('No pude borrar tus mensajes. El bot necesita **Gestionar mensajes**.');
    }
    return;
  }

  await handlePrefixModeration(message);
}

client.on(Events.InteractionCreate, async (interaction) => {
  // Un clic repetido en el mismo botón no debe generar dos respuestas.
  if (!claimInteraction(interaction.id)) return;

  try {
    await handleInteraction(interaction);
  } catch (error) {
    logger.error(`Fallo procesando la interacción ${interaction.id} (${interaction.commandName ?? interaction.customId ?? 'desconocida'})`, error);
    if (interaction.isRepliable()) {
      const payload = { content: 'Hubo un error con ese comando. Revisa `logs/bot.log`.', flags: MessageFlags.Ephemeral };
      const respond = interaction.deferred || interaction.replied
        ? interaction.followUp(payload)
        : interaction.reply(payload);
      await respond.catch(() => {});
    }
  }
});

async function handleInteraction(interaction) {
  if (await depositCommand.handleComponent(interaction)) return;
  if (await shopCommand.handleComponent(interaction)) return;
  if (await bagCommand.handleComponent(interaction)) return;
  if (await petCommand.handleComponent(interaction)) return;
  if (await gamesCommand.handleComponent(interaction)) return;
  if (await quoteCommand.handleComponent(interaction)) return;
  if (interaction.isButton?.() && interaction.customId === 'help:home') {
    await interaction.update({ embeds: [helpEmbed()], components: helpComponents() });
    return;
  }
  if (interaction.isButton?.() && interaction.customId === 'help:close') {
    await interaction.update({ content: '📚 Menú de ayuda cerrado.', embeds: [], components: [] });
    return;
  }
  if (await tradeCommand.handleComponent(interaction)) return;
  if (await polls.handleComponent(interaction)) return;
  if (await profileCommand.handleComponent(interaction)) return;
  if (await lookup.handleComponent(interaction)) return;
  // Panel de bienvenida, abrazos y propuestas de matrimonio.
  if (await welcome.handleComponent(interaction)) return;
  if (await hugs.handleComponent(interaction)) return;
  if (await marriageProps.handleComponent(interaction)) return;
  if (interaction.isChatInputCommand() && await extraCommands.handleSlashCommand(interaction)) return;

  if (interaction.isButton()) {
    const [type, response, fromId, toId] = interaction.customId.split(':');
    if (type !== 'kiss') return;
    if (interaction.user.id !== toId) {
      await interaction.reply({ content: 'Solo la persona que recibió el beso puede responder.', flags: MessageFlags.Ephemeral });
      return;
    }
    if (!['return', 'reject'].includes(response)) return;
    if (!interaction.message?.createdTimestamp || Date.now() - interaction.message.createdTimestamp > 86400_000) {
      await interaction.reply({ content: 'Este beso caducó. Envía uno nuevo para corresponderlo.', flags: MessageFlags.Ephemeral });
      return;
    }
    await interaction.deferReply();
    if (!kisses.claimResponse(interaction.message.id)) {
      await interaction.editReply({ content: 'Este beso ya recibió una respuesta.' });
      return;
    }
    if (response === 'return') {
      const count = addKiss(interaction.guild.id, fromId, toId);
      // Respuesta visible para todo el canal, con la imagen del regalo de besos.
      await interaction.editReply(await prepareKissPayload(kissPayload(`<@${fromId}>`, `<@${toId}>`, count, 'gift')));
      await clearKissButtons(interaction);
      return;
    }
    if (response === 'reject') {
      await interaction.editReply(await prepareKissPayload(kissPayload(`<@${fromId}>`, `<@${toId}>`, 0, 'reject')));
      await clearKissButtons(interaction);
    }
    return;
  }
  if (interaction.isStringSelectMenu()) {
    if (interaction.customId === 'help:category') {
      const category = interaction.values[0] === 'all' ? null : interaction.values[0];
      if (!category || HELP_CATEGORIES.some((item) => item.id === category)) {
        await interaction.update({ embeds: [helpEmbed(category)], components: helpComponents(category) });
      }
      return;
    }
    if (interaction.customId === 'server:details') {
      await interaction.update({
        embeds: [serverDetailEmbed(interaction.guild, interaction.values[0])],
        components: serverComponents(),
      });
    }
    return;
  }
  if (!interaction.isChatInputCommand()) return;
  if (interaction.commandName === 'help') {
    const query = interaction.options.getString('consulta')?.trim().toLowerCase();
    const category = !query || query === 'all' ? null : query;
    const isCategory = !category || HELP_CATEGORIES.some((item) => item.id === category);
    const command = isCategory ? null : findHelpCommand(category);
    if (!isCategory && !command) {
      await interaction.reply({ content: `No encontré ese comando. Usa \`${PREFIX} help\` para ver las categorías.`, flags: MessageFlags.Ephemeral });
      return;
    }
    await sendHelp({ isInteraction: true, interaction }, isCategory ? category : null, command);
    return;
  }
  if (interaction.commandName === 'server') {
    await interaction.reply({ embeds: [await serverEmbed(interaction.guild)], components: serverComponents() });
    return;
  }
  if (interaction.commandName === 'kiss') {
    if (!interaction.inGuild()) {
      await interaction.reply({ content: 'Los besos solo funcionan dentro de un servidor.', flags: MessageFlags.Ephemeral });
      return;
    }
    const target = interaction.options.getUser('usuario', true);
    if (target.bot || target.id === interaction.user.id) {
      await interaction.reply({ content: 'Elige a otra persona, no a ti ni a un bot.', flags: MessageFlags.Ephemeral });
      return;
    }
    const count = addKiss(interaction.guild.id, interaction.user.id, target.id);
    await interaction.deferReply();
    await interaction.editReply({
      ...await prepareKissPayload(kissPayload(interaction.user, target, count)),
      components: [kissButtons(interaction.user.id, target.id)],
    });
    return;
  }
  if (interaction.commandName === 'purge') {
    if (!interaction.memberPermissions.has(PermissionFlagsBits.ManageMessages)) {
      await interaction.reply({ content: 'Necesitas **Gestionar mensajes** para usar este comando.', flags: MessageFlags.Ephemeral });
      return;
    }
    try {
      const deleted = await runPurge(interaction.channel, interaction.options.getInteger('cantidad', true));
      await interaction.reply({ content: `🧹 Se borraron **${deleted}** mensajes recientes.`, flags: MessageFlags.Ephemeral });
    } catch (error) {
      await interaction.reply({ content: 'No pude borrar los mensajes. Revisa los permisos del bot.', flags: MessageFlags.Ephemeral });
    }
    return;
  }
  if (interaction.commandName === 'pg') {
    try {
      const deleted = await runPurge(interaction.channel, MAX_PURGE_MESSAGES, interaction.user.id);
      await interaction.reply({ content: `🧹 Borré **${deleted}** de tus mensajes recientes.`, flags: MessageFlags.Ephemeral });
    } catch (error) {
      await interaction.reply({ content: 'No pude borrar tus mensajes. El bot necesita **Gestionar mensajes**.', flags: MessageFlags.Ephemeral });
    }
    return;
  }

  const command = interaction.commandName;
  if (!Object.hasOwn(MODERATION_PERMISSIONS, command)) {
    // Antes Discord se quedaba esperando la respuesta; ahora se avisa.
    await interaction.reply({
      content: `No tengo el comando \`/${command}\`. Usa \`/help\` para ver los que sí existen.`,
      flags: MessageFlags.Ephemeral,
    });
    return;
  }
  if (!interaction.inGuild() || !interaction.memberPermissions.has(MODERATION_PERMISSIONS[command])) {
    await interaction.reply({ content: 'No tienes permiso para usar ese comando.', flags: MessageFlags.Ephemeral });
    return;
  }

  if (command === 'lock' || command === 'unlock') {
    try {
      await interaction.reply(await executeModeration({
        guild: interaction.guild,
        channel: interaction.channel,
        actor: await interaction.guild.members.fetch(interaction.user.id),
        command,
        reason: interaction.options.getString('razon') || '',
      }));
    } catch (error) {
      await interaction.reply({ content: `No pude ${command === 'lock' ? 'cerrar' : 'abrir'} este canal. Verifica los permisos del bot.`, flags: MessageFlags.Ephemeral });
    }
    return;
  }

  if (command === 'unban') {
    const userId = interaction.options.getString('usuario_id', true);
    if (!/^\d{17,20}$/.test(userId)) {
      await interaction.reply({ content: 'El ID de usuario no es válido.', flags: MessageFlags.Ephemeral });
      return;
    }
    try {
      await interaction.reply(await executeModeration({
        guild: interaction.guild,
        actor: await interaction.guild.members.fetch(interaction.user.id),
        command,
        value: userId,
        reason: interaction.options.getString('razon') || '',
      }));
    } catch (error) {
      await interaction.reply({ content: 'No pude quitar ese ban. Revisa el ID y los permisos del bot.', flags: MessageFlags.Ephemeral });
    }
    return;
  }

  const user = interaction.options.getUser('usuario', true);
  const target = await interaction.guild.members.fetch(user.id);
  const actor = await interaction.guild.members.fetch(interaction.user.id);
  if (target.id === actor.id || !isManageable(target, command)) {
    await interaction.reply({ content: 'No puedo moderar a ese usuario. Revisa la jerarquía de roles y permisos del bot.', flags: MessageFlags.Ephemeral });
    return;
  }
  const minutes = command === 'mute' ? interaction.options.getInteger('minutos', true) : null;
  if (command === 'mute' && (minutes < 1 || minutes > 40_320)) {
    await interaction.reply({ content: 'La duración debe ser entre 1 y 40320 minutos.', flags: MessageFlags.Ephemeral });
    return;
  }
  try {
    await interaction.reply(await executeModeration({
      guild: interaction.guild,
      actor,
      command,
      target,
      value: minutes,
      reason: interaction.options.getString('razon') || '',
    }));
  } catch (error) {
    await interaction.reply({ content: 'No pude completar la acción. Revisa los permisos y jerarquía del bot.', flags: MessageFlags.Ephemeral });
  }
}

function start() {
  if (!process.env.DISCORD_TOKEN) {
    logger.error('Falta DISCORD_TOKEN. Copia .env.example a .env y completa el token.');
    process.exit(1);
  }

  let lock;
  try {
    lock = acquireInstanceLock(LOCK_FILE);
  } catch (error) {
    // Dos copias del bot con el mismo token contestan cada mensaje dos veces.
    logger.error(error.message);
    process.exit(1);
  }

  const releaseLock = () => {
    lock.release();
    process.exit(0);
  };
  process.once('exit', () => lock.release());
  process.once('SIGINT', releaseLock);
  process.once('SIGTERM', releaseLock);

  // Un error en un comando no debe tumbar el bot entero.
  process.on('unhandledRejection', (reason) => logger.error('Promesa rechazada sin capturar', reason));
  process.on('uncaughtException', (error) => {
    logger.error('Excepción sin capturar; el bot se reiniciará si lo ejecutas con un gestor de procesos', error);
  });

  client.login(process.env.DISCORD_TOKEN).catch((error) => {
    if (error.code === 'DisallowedIntents') {
      logger.error('Falta activar un intent privilegiado (Message Content o Server Members) en el portal de desarrolladores de Discord.', error);
    } else {
      logger.error('No pude iniciar sesión en Discord', error);
    }
    process.exit(1);
  });
}

if (require.main === module) start();

module.exports = {
  KISS_IMAGES,
  KISS_GIFT_IMAGES,
  KISS_REJECT_IMAGES,
  executeModeration,
  helpText,
  HELP_CATEGORIES,
  helpCommands,
  helpComponents,
  helpEmbed,
  autoresponder,
  kissPayload,
  normalizeCustomPrefix,
  start,
};
