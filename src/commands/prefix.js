const { EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const prefixes = require('../lib/prefixes');

module.exports = {
  name: 'prefix',
  aliases: ['prefijos', 'prefijo'],
  description: 'Muestra o cambia los prefijos del bot en este servidor.',
  usage: 'xyb prefix [add|remove|set] ...',
  permissions: [PermissionFlagsBits.ManageGuild],
  guildOnly: true,
  slash: {
    description: 'Muestra los prefijos del bot en este servidor.',
  },

  async execute({ guild, args, isSlash, reply, fail }) {
    const action = (isSlash ? null : args[0]?.toLowerCase()) ?? null;
    const current = prefixes.getPrefixes(guild.id);
    const show = () => `📌 Prefijos activos: ${current.map((item) => `\`${item}\``).join(' · ')}`;

    if (!action) {
      await reply({
        content: `${show()}\nUsa \`${prefixes.FIXED_PREFIX} prefix add !\` para agregar uno más (hasta ${prefixes.MAX_PREFIXES}).`,
      });
      return;
    }

    const result = action === 'add' || action === 'remove'
      ? action === 'add' ? prefixes.addPrefix(guild.id, args[1]) : prefixes.removePrefix(guild.id, args[1])
      : action === 'set' ? (() => {
        const wanted = args.slice(1);
        if (!wanted.length) return { ok: false, reason: 'Dime al menos un prefijo.' };
        prefixes.setPrefixes(guild.id, wanted);
        return { ok: true, prefixes: prefixes.getPrefixes(guild.id) };
      })()
      : { ok: false, reason: 'Acción válida: `add`, `remove` o `set`.' };

    if (!result.ok) {
      await fail(`${result.reason}\n${show()}`);
      return;
    }

    const embed = new EmbedBuilder()
      .setColor(0x2ECC71)
      .setTitle('✅ Prefijos actualizados')
      .setDescription(`${result.prefixes.map((item) => `\`${item}\``).join(' · ')}`)
      .setFooter({ text: 'A partir de ahora esos prefijos funcionan con todos los comandos.' })
      .setTimestamp();
    await reply({ embeds: [embed] });
  },
};
