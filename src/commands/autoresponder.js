const { PermissionFlagsBits } = require('discord.js');
const autoresponder = require('../lib/autoresponder');

const ACTIONS = {
  ver: 'ver', lista: 'ver', list: 'ver', show: 'ver', estado: 'ver',
  agregar: 'agregar', anadir: 'agregar', add: 'agregar', set: 'agregar',
  quitar: 'quitar', borrar: 'quitar', remove: 'quitar', delete: 'quitar',
  activar: 'activar', on: 'activar', enable: 'activar',
  desactivar: 'desactivar', off: 'desactivar', disable: 'desactivar',
  reset: 'reset', restablecer: 'reset',
};

function readInput({ args, isSlash, interaction }) {
  if (isSlash) {
    const actionOption = interaction.options.get?.('accion');
    return {
      action: actionOption ? String(actionOption.value) : 'ver',
      trigger: interaction.options.getString('palabra'),
      reply: interaction.options.getString('respuesta'),
    };
  }
  return {
    action: args[0]?.toLocaleLowerCase() ?? 'ver',
    trigger: args[1],
    reply: args.slice(2).join(' ') || null,
  };
}

function usage(prefix = 'xyb') {
  return `Uso: \`${prefix} autoresponder ver\`, \`${prefix} autoresponder agregar palabra respuesta\`, \`${prefix} autoresponder quitar palabra\`, \`${prefix} autoresponder activar|desactivar\` o \`${prefix} autoresponder reset\`.`;
}

function createCommand(name) {
  return {
    name,
    aliases: name === 'autoresponder' ? ['autorespuesta'] : [],
    description: 'Configura respuestas automáticas añadidas manualmente.',
    usage: `xyb ${name} [ver|agregar|quitar|activar|desactivar|reset]`,
    permissions: [PermissionFlagsBits.ManageGuild],
    guildOnly: true,
    slash: {
      description: 'Configura las respuestas automáticas del servidor.',
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
          .addStringOption((option) => option
            .setName('palabra')
            .setDescription('Palabra o frase que añadiste manualmente.')
            .setRequired(false))
          .addStringOption((option) => option
            .setName('respuesta')
            .setDescription('Texto que enviará el bot.')
            .setRequired(false));
      },
    },

    async execute(context) {
      const { guild, reply, fail } = context;
      const input = readInput(context);
      const action = ACTIONS[input.action] ?? null;
      if (!action) {
        await fail(usage(context.isSlash ? 'xyb' : context.command.name));
        return;
      }

      if (action === 'ver') {
        await reply({ content: autoresponder.formatConfig(guild.id), allowedMentions: { parse: [] } });
        return;
      }
      if (action === 'activar' || action === 'desactivar') {
        const config = autoresponder.setEnabled(guild.id, action === 'activar');
        await reply(`✅ Autoresponder ${config.enabled ? 'activado' : 'desactivado'} en este servidor.`);
        return;
      }
      if (action === 'reset') {
        const config = autoresponder.resetConfig(guild.id);
        await reply({ content: `✅ Restablecido. ${config.rules.length} reglas manuales activas.`, allowedMentions: { parse: [] } });
        return;
      }
      if (!input.trigger || (action === 'agregar' && !input.reply)) {
        await fail(usage(context.isSlash ? 'xyb' : context.command.name));
        return;
      }
      const result = action === 'agregar'
        ? autoresponder.addRule(guild.id, input.trigger, input.reply)
        : autoresponder.removeRule(guild.id, input.trigger);
      if (!result.ok) {
        await fail(result.reason);
        return;
      }
      await reply({
        content: action === 'agregar'
          ? `✅ Añadí respuesta(s) para \`${input.trigger.replace(/^@+/, '')}\`: ${input.reply}`
          : `✅ Quité la respuesta para \`${input.trigger.replace(/^@+/, '')}\`.`,
        allowedMentions: { parse: [] },
      });
    },
  };
}

module.exports = createCommand('autoresponder');
module.exports.createCommand = createCommand;
module.exports.readInput = readInput;
