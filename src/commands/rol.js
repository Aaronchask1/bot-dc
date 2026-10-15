const { EmbedBuilder, PermissionFlagsBits } = require('discord.js');

const ACCIONES = {
  add: 'Agregado',
  quitar: 'Quitado',
  remove: 'Quitado',
  toggle: 'Cambiado',
  poner: 'Agregado',
  dar: 'Agregado',
};

// Si el rol viene pegado en el texto ("xyb rol add @fulana mecos"), se busca por
// nombre entre los del servidor en vez de pedir que lo mencionen.
function textoDelRol(args) {
  return args.join(' ')
    .replace(/<@!?\d+>/g, ' ')   // la persona
    .replace(/<@&\d+>/g, ' ')    // un rol mencionado
    .replace(/\d{17,20}/g, ' ')  // un id suelto
    .replace(/\b(add|remove|quitar|toggle|poner|dar)\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function resolveRole({ isSlash, interaction, message, guild, args }) {
  if (isSlash) return interaction.options.getRole('rol', true);
  const mentioned = message.mentions.roles?.first?.();
  if (mentioned) return mentioned;

  const palabras = textoDelRol(args);
  if (!palabras) return null;
  const roles = [...guild.roles.cache.values()].filter((role) => !guild.id || role.id !== guild.id);

  return roles.find((role) => role.name.toLowerCase() === palabras)
    ?? roles.find((role) => role.name.toLowerCase().startsWith(palabras))
    ?? roles.find((role) => role.name.toLowerCase().includes(palabras))
    ?? null;
}

function sugerencias(guild, args) {
  const palabras = textoDelRol(args);
  if (!palabras) return '';
  const parecidos = [...guild.roles.cache.values()]
    .filter((role) => (!guild.id || role.id !== guild.id) && role.name.toLowerCase().includes(palabras.slice(0, 3)))
    .slice(0, 5)
    .map((role) => `${role}`)
    .join(' · ');
  return parecidos ? `\n¿Quisiste decir: ${parecidos}?` : `\nNo encontré ningún rol con ese nombre. Usa \`xyb roles\` para ver la lista.`;
}

module.exports = {
  name: 'rol',
  aliases: ['role', 'agregarrol'],
  description: 'Agrega, quita o alterna un rol de alguien.',
  usage: 'xyb rol [add|remove|toggle] @persona @rol',
  permissions: [PermissionFlagsBits.ManageRoles],
  botPermissions: [PermissionFlagsBits.ManageRoles],
  guildOnly: true,
  slash: {
    description: 'Agrega, quita o alterna un rol de alguien.',
    setup(builder) {
      return builder
        .addUserOption((option) => option.setName('persona').setDescription('A quién se lo pones.').setRequired(true))
        .addRoleOption((option) => option.setName('rol').setDescription('El rol.').setRequired(true))
        .addStringOption((option) => option
          .setName('accion')
          .setDescription('add, remove o toggle.')
          .addChoices(
            { name: 'Agregar', value: 'add' },
            { name: 'Quitar', value: 'remove' },
            { name: 'Alternar', value: 'toggle' },
          ));
    },
  },

  async execute({ target, args, isSlash, interaction, message, guild, member, fail, reply }) {
    const person = target ?? (isSlash ? null : message.mentions.members?.first?.());
    const role = resolveRole({ isSlash, interaction, message, guild, args });
    if (!person) {
      await fail('Dime a quién: `xyb rol add @persona mecos`');
      return;
    }
    if (!role) {
      await fail(`No encontré el rol.${sugerencias(guild, args)}`);
      return;
    }

    const accion = (isSlash ? interaction.options.getString('accion') : args[0])?.toLowerCase() ?? 'add';
    if (!ACCIONES[accion]) {
      await fail('Acción válida: `add`, `remove` o `toggle`.');
      return;
    }

    if (person.id === member.id && accion !== 'remove') {
      await fail('No puedo darte roles a ti mismo con este comando.');
      return;
    }

    const objetivo = await guild.members.fetch(person.id).catch(() => null);
    if (!objetivo) {
      await fail('Esa persona no está en el servidor.');
      return;
    }

    // El rol del bot tiene que estar por encima del rol que manipula,
    // y el rol de la persona por encima del que se le pone.
    if (role.position >= guild.members.me.roles.highest.position) {
      await fail('Ese rol está por encima del mío. Súbeme el rol del bot.');
      return;
    }
    if (accion !== 'remove' && objetivo.roles.highest.position >= role.position) {
      await fail('Esa persona tiene un rol igual o superior al que quieres ponerle.');
      return;
    }
    if (role.managed) {
      await fail('Ese rol lo maneja una integración, no se puede poner a mano.');
      return;
    }

    if (accion === 'add') await objetivo.roles.add(role);
    else if (accion === 'remove') await objetivo.roles.remove(role);
    else if (objetivo.roles.cache.has(role.id)) await objetivo.roles.remove(role);
    else await objetivo.roles.add(role);

    const embed = new EmbedBuilder()
      .setColor(0x5865F2)
      .setDescription(`${ACCIONES[accion]} ${role} a ${person}.`)
      .setFooter({ text: `Por ${member.user?.tag ?? 'alguien'} · 🐰 xyb` });

    // Los chistes del server: dependen de si el rol se pone o se quita.
    if (role.name.toLowerCase() === 'mecos') {
      const chiste = accion === 'remove' || accion === 'quitar'
        ? 'jajaj pendejo violado'
        : 'jajaja te tiro los mecos puta';
      embed.setDescription(`${ACCIONES[accion]} ${role} a ${person}.\n${chiste}`);
    }

    await reply({ embeds: [embed] });
  },
};

module.exports.resolveRole = resolveRole;
module.exports.textoDelRol = textoDelRol;
