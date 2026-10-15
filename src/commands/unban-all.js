const { EmbedBuilder, PermissionFlagsBits } = require('discord.js');

function esTodo(args) {
  return args[0]?.toLowerCase() === 'all' || args[0]?.toLowerCase() === 'todos';
}

module.exports = {
  name: 'unban',
  aliases: ['unbanall', 'desbanear', 'sacarban'],
  // Atiende el unban de a uno y el de a huevo. El comando original de
  // index.js queda solo si este no interviene, así que aquí se hace todo.
  match: () => true,
  description: 'Quita el ban a alguien por ID, o a todo el mundo con `xyb unban all`.',
  usage: 'xyb unban ID | xyb unban all',
  permissions: [PermissionFlagsBits.BanMembers],
  botPermissions: [PermissionFlagsBits.BanMembers],
  guildOnly: true,
  slash: {
    description: 'Quita el ban de alguien, o de todo el mundo con `all`.',
    setup(builder) {
      return builder.addStringOption((option) => option
        .setName('quien')
        .setDescription('El ID de la persona, o `all` para desbloquear a todo el mundo.')
        .setRequired(true))
        .addStringOption((option) => option
          .setName('razon')
          .setDescription('Motivo del desbloqueo.'));
    },
  },

  async execute({ guild, isSlash, interaction, args, user, defer, fail, reply }) {
    const objetivo = (isSlash ? interaction.options.getString('quien', true) : args[0])?.trim() ?? '';
    // El motivo es lo que viene detrás del ID, sin el ID dentro.
    const resto = args.slice(1).join(' ').trim();
    const razon = (isSlash ? interaction.options.getString('razon') : resto) || `unban por ${user.tag}`;

    if (!/\d{17,20}/.test(objetivo) && !esTodo([objetivo])) {
      await fail('Pon el ID de la persona baneada, o `all` para desbloquear a todo el mundo.');
      return;
    }

    // Uno solo: es el unban de siempre.
    if (!esTodo([objetivo])) {
      const id = (objetivo.match(/\d{17,20}/) ?? [])[0];
      if (!id) {
        await fail('Ese ID no parece válido.');
        return;
      }
      try {
        await guild.members.unban(id, razon);
      } catch {
        await fail('No pude quitar ese ban. Revisa el ID y que el bot tenga **Banear miembros**.');
        return;
      }
      await reply(`🔓 Quité el ban a <@${id}>.`);
      return;
    }

    // El .catch no alcanza si guild.bans no existe: se revisa antes.
    if (typeof guild.bans?.fetch !== 'function') {
      await fail('No pude ver la lista de baneados. Revisa que el bot tenga **Banear miembros**.');
      return;
    }

    let baneados;
    try {
      baneados = await guild.bans.fetch();
    } catch {
      await fail('No pude ver la lista de baneados. Revisa que el bot tenga **Banear miembros**.');
      return;
    }

    if (!baneados.size) {
      await fail('No hay nadie baneado en este servidor.');
      return;
    }

    // Si son muchos, la respuesta tardaría más de 3 segundos en un slash.
    if (isSlash || baneados.size > 20) await defer();

    const total = baneados.size;
    const errores = [];
    let liberados = 0;

    for (const [id] of baneados) {
      try {
        await guild.members.unban(id, `unban all por ${user.tag}`);
        liberados += 1;
      } catch (error) {
        errores.push(`${id} (${error.code ?? error.message})`);
      }
    }

    const embed = new EmbedBuilder()
      .setColor(errores.length ? 0xF1C40F : 0x2ECC71)
      .setTitle('🔓 Unban all')
      .setDescription(`Se quitó el ban a **${liberados}** de **${total}** baneados.`)
      .setFooter({ text: `Pedido por ${user.tag} · 🐰 xyb` })
      .setTimestamp();

    if (errores.length) {
      embed.addFields({
        name: `⚠ No se pudieron quitar ${errores.length}`,
        value: errores.slice(0, 5).map((item) => `\`${item}\``).join('\n'),
      });
    }

    await reply({ embeds: [embed] });
  },
};

module.exports.esTodo = esTodo;
