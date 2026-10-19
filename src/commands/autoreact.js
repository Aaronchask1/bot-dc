const { PermissionFlagsBits } = require('discord.js');
const autoreact = require('../lib/autoreact');

const ACTIONS = {
  ver: 'ver', lista: 'ver', list: 'ver', show: 'ver', estado: 'ver',
  agregar: 'agregar', anadir: 'agregar', add: 'agregar', set: 'agregar',
  quitar: 'quitar', borrar: 'quitar', remove: 'quitar', delete: 'quitar',
  activar: 'activar', on: 'activar', enable: 'activar',
  desactivar: 'desactivar', off: 'desactivar', disable: 'desactivar',
  reset: 'reset', restablecer: 'reset',
};

function readInput({ args, isSlash, interaction }) {
  if (isSlash) return {
    action: interaction.options.getString('accion') ?? 'ver',
    trigger: interaction.options.getString('palabra'),
    emoji: interaction.options.getString('emoji'),
  };
  return { action: args[0]?.toLocaleLowerCase() ?? 'ver', trigger: args[1], emoji: args.slice(2).join(' ') || null };
}

function usage(prefix = 'xyb') {
  return `Uso: \`${prefix} autoreact ver\`, \`${prefix} autoreact agregar palabra emoji\`, \`${prefix} autoreact quitar palabra\`, \`${prefix} autoreact activar|desactivar\` o \`${prefix} autoreact reset\`.`;
}

module.exports = {
  name: 'autoreact',
  aliases: [],
  description: 'Configura reacciones automáticas por palabra.',
  usage: 'xyb autoreact [ver|agregar|quitar|activar|desactivar|reset]',
  permissions: [PermissionFlagsBits.ManageGuild],
  guildOnly: true,
  slash: {
    description: 'Configura las reacciones automáticas del servidor.',
    setup(builder) {
      builder
        .addStringOption((option) => option
          .setName('accion')
          .setDescription('Qué quieres hacer.')
          .setRequired(false)
          .addChoices(
            { name: 'Ver configuración', value: 'ver' },
            { name: 'Agregar o cambiar', value: 'agregar' },
            { name: 'Quitar palabra', value: 'quitar' },
            { name: 'Activar', value: 'activar' },
            { name: 'Desactivar', value: 'desactivar' },
            { name: 'Restablecer', value: 'reset' },
          ))
        .addStringOption((option) => option.setName('palabra').setDescription('Palabra que disparará la reacción.'))
        .addStringOption((option) => option.setName('emoji').setDescription('Emoji Unicode o emoji personalizado.'));
    },
  },

  async execute(context) {
    const { guild, reply, fail } = context;
    const input = readInput(context);
    const action = ACTIONS[input.action] ?? null;
    if (!action) { await fail(usage(context.isSlash ? 'xyb' : context.command.name)); return; }
    if (action === 'ver') { await reply({ content: autoreact.formatConfig(guild.id), allowedMentions: { parse: [] } }); return; }
    if (action === 'activar' || action === 'desactivar') {
      const config = autoreact.setEnabled(guild.id, action === 'activar');
      await reply(`✅ Autoreact ${config.enabled ? 'activado' : 'desactivado'} en este servidor.`);
      return;
    }
    if (action === 'reset') {
      autoreact.resetConfig(guild.id);
      await reply('✅ Restablecido. No hay reglas de reacción activas.');
      return;
    }
    if (!input.trigger || (action === 'agregar' && !input.emoji)) { await fail(usage(context.isSlash ? 'xyb' : context.command.name)); return; }
    const result = action === 'agregar'
      ? autoreact.addRule(guild.id, input.trigger, input.emoji)
      : autoreact.removeRule(guild.id, input.trigger);
    if (!result.ok) { await fail(result.reason); return; }
    await reply({
      content: action === 'agregar'
        ? `✅ Añadí reacción(es) para \`${input.trigger.replace(/^@+/, '')}\`: ${input.emoji}.`
        : `✅ Quité la reacción para \`${input.trigger.replace(/^@+/, '')}\`.`,
      allowedMentions: { parse: [] },
    });
  },
};
