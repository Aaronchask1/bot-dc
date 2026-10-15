const fs = require('node:fs');
const path = require('node:path');
const { MessageFlags, PermissionFlagsBits } = require('discord.js');
const logger = require('../logger');
const members = require('../lib/members');

const PREFIX = 'xyb';
const commands = new Map();

// Carga automática: cada archivo de esta carpeta es un comando.
function loadCommands() {
  if (commands.size) return commands;
  for (const file of fs.readdirSync(__dirname)) {
    if (!file.endsWith('.js') || file === 'index.js') continue;
    const command = require(path.join(__dirname, file));
    if (!command?.name || typeof command.execute !== 'function') continue;
    for (const key of [command.name, ...(command.aliases ?? [])]) {
      if (!commands.has(key)) commands.set(key, command);
    }
  }
  return commands;
}

function findCommand(name) {
  loadCommands();
  return commands.get(String(name ?? '').toLowerCase()) ?? null;
}

function listCommands() {
  loadCommands();
  return [...new Set(commands.values())];
}

function buildContext(command, { message, interaction, args, text, invokedName = command.name, target: resolvedTarget = null }) {
  const isSlash = Boolean(interaction);
  const mention = message?.mentions?.users?.first?.() ?? null;
  const slashTarget = isSlash && interaction.options?.getUser
    ? interaction.options.getUser('usuario') ?? null
    : null;

  // reply/fail usan el closure y no `this`: si se desestructuran (`const { fail } = ctx`)
  // `this` sería undefined y el comando se caía al usarlo.
  async function reply(payload) {
    if (isSlash) {
      const body = typeof payload === 'string' ? { content: payload } : payload;
      if (interaction.deferred || interaction.replied) return interaction.followUp(body);
      return interaction.reply(body);
    }
    return message.reply(payload);
  }

  async function fail(text) {
    return reply(isSlash ? { content: text, flags: MessageFlags.Ephemeral } : text);
  }

  async function send(payload) {
    return (isSlash ? interaction.channel : message.channel).send(payload);
  }

  async function defer() {
    if (isSlash && !interaction.deferred && !interaction.replied) await interaction.deferReply();
  }

  return {
    command,
    invokedName,
    args,
    text,
    isSlash,
    message,
    interaction,
    client: isSlash ? interaction.client : message.client,
    user: isSlash ? interaction.user : message.author,
    member: isSlash ? interaction.member : message.member,
    guild: isSlash ? interaction.guild : message.guild,
    channel: isSlash ? interaction.channel : message.channel,
    // `xyb avatar` sin mención es el propio autor; `xyb avatar @x` es @x.
    target: resolvedTarget ?? slashTarget ?? mention ?? (isSlash ? null : message.author),
    reply,
    fail,
    send,
    defer,
  };
}

function checkAccess(command, context) {
  if (command.guildOnly && !context.guild) {
    return 'Ese comando solo funciona dentro de un servidor.';
  }
  const required = command.permissions ?? [];
  if (required.length && !context.member?.permissions) {
    return 'No pude revisar tus permisos en este canal.';
  }
  if (required.length && !context.member.permissions.has(required)) {
    return `Necesitas el permiso **${required.map(permissionName).join(' o ')}** para usar ese comando.`;
  }
  const missing = (command.botPermissions ?? []).filter((permission) => !context.guild?.members.me?.permissionsIn(context.channel)?.has(permission));
  if (missing.length) {
    return `El bot necesita **${missing.map(permissionName).join(' y ')}** aquí.`;
  }
  return null;
}

const PERMISSION_NAMES = {
  Administrator: 'Administrador',
  ManageGuild: 'Gestionar servidor',
  ManageRoles: 'Gestionar roles',
  ManageMessages: 'Gestionar mensajes',
  ManageChannels: 'Gestionar canales',
  ModerateMembers: 'Moderar miembros',
  ManageNicknames: 'Gestionar apodos',
  ManageWebhooks: 'Gestionar webhooks',
  MoveMembers: 'Mover miembros',
  Connect: 'Conectar',
  Speak: 'Hablar',
  ManageGuildExpressions: 'Gestionar stickers y emojis',
  CreateGuildExpressions: 'Crear stickers y emojis',
  UseExternalEmojis: 'Usar emojis externos',
  ViewChannel: 'Ver el canal',
};

// PermissionFlagsBits va de nombre a valor, así que para el mensaje hay que
// buscar la clave cuyo valor sea ese permiso.
const REVERSED_PERMISSIONS = new Map(
  Object.entries(PermissionFlagsBits).map(([name, value]) => [value, name]),
);

function permissionName(permission) {
  const key = typeof permission === 'bigint' || typeof permission === 'number'
    ? REVERSED_PERMISSIONS.get(BigInt(permission))
    : permission;
  return PERMISSION_NAMES[key] ?? key ?? 'permiso';
}

/** Comandos de prefijo que no existen todavía en index.js. */
async function handlePrefixCommand(message) {
  const content = message.content?.trim() ?? '';
  if (!new RegExp(`^${PREFIX}(?:\\s|$)`, 'i').test(content)) return false;
  const parts = content.slice(PREFIX.length).trim().split(/\s+/).filter(Boolean);
  if (!parts.length) {
    // "xyb" a secas: es la única pregunta que el bot original no contestaba.
    await message.reply('Usa `xyb help` para ver todo lo que sé hacer.');
    return true;
  }

  const args = parts.slice(1);
  const command = findCommand(parts[0]);
  if (!command) return false;
  // Algunos nombres los atacan dos sitios (por ejemplo `purge bots` y
  // `purge 50`): si el comando dice que no le toca, se deja pasar el original.
  if (command.match && !command.match(args)) return false;
  if (command.guildOnly !== false && !message.guild) {
    await message.reply('Ese comando solo funciona dentro de un servidor.');
    return true;
  }

  const mentioned = message.mentions?.users?.first?.() ?? null;
  const resolved = mentioned || !message.guild || command.resolveMember === false
    ? null : (await members.resolveMemberAsync(message.guild, args.join(' '))).member?.user;
  const context = buildContext(command, {
    message,
    args,
    text: args.join(' '),
    invokedName: parts[0].toLowerCase(),
    target: resolved,
  });
  const denied = checkAccess(command, context);
  if (denied) {
    await message.reply(denied);
    return true;
  }

  try {
    await command.execute(context);
  } catch (error) {
    logger.error(`Error en el comando ${command.name}`, error);
    await message.reply('Hubo un error con ese comando. Revisa `logs/bot.log`.');
  }
  return true;
}

/** Comandos slash que aún no estaban registrados en index.js. */
async function handleSlashCommand(interaction) {
  const command = findCommand(interaction.commandName);
  if (!command) return false;

  const context = buildContext(command, {
    message: null,
    interaction,
    args: [],
    text: '',
    invokedName: interaction.commandName,
  });
  const denied = checkAccess(command, context);
  if (denied) {
    await interaction.reply({ content: denied, flags: MessageFlags.Ephemeral });
    return true;
  }

  try {
    await command.execute(context);
  } catch (error) {
    logger.error(`Error en el comando /${command.name}`, error);
    if (interaction.isRepliable()) {
      const payload = { content: 'Hubo un error con ese comando. Revisa `logs/bot.log`.', flags: MessageFlags.Ephemeral };
      if (interaction.deferred || interaction.replied) await interaction.followUp(payload);
      else await interaction.reply(payload);
    }
  }
  return true;
}

module.exports = {
  PREFIX,
  findCommand,
  listCommands,
  handlePrefixCommand,
  handleSlashCommand,
  buildContext,
};
