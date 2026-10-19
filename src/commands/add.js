const { PermissionFlagsBits } = require('discord.js');
const autoresponder = require('../lib/autoresponder');
const autoreact = require('../lib/autoreact');

function usage() {
  return 'Uso: `xyb add autoresponder palabra respuesta [| respuesta]` o `xyb add autoreact palabra emoji [| emoji]`.';
}

module.exports = {
  name: 'add',
  aliases: ['agregar', 'anadir'],
  description: 'Añade y activa una regla de autorespuesta o autoreacción.',
  usage: 'xyb add autoresponder|autoreact palabra respuesta|emoji',
  permissions: [PermissionFlagsBits.ManageGuild],
  guildOnly: true,
  match: (args) => ['autoresponder', 'autorespuesta', 'autoreact'].includes(args[0]?.toLocaleLowerCase()),

  async execute({ guild, args, fail, reply }) {
    const kind = args[0]?.toLocaleLowerCase();
    const trigger = args[1];
    const value = args.slice(2).join(' ').trim();
    if (!trigger || !value) {
      await fail(usage());
      return;
    }

    if (kind === 'autoreact') {
      const result = autoreact.addRule(guild.id, trigger, value);
      if (!result.ok) { await fail(result.reason); return; }
      await reply(`✅ Añadido y activado: reaccionaré a \`${trigger.replace(/^@+/, '')}\` con ${value}.`);
      return;
    }

    const result = autoresponder.addRule(guild.id, trigger, value);
    if (!result.ok) { await fail(result.reason); return; }
    await reply(`✅ Añadido y activado: responderé a \`${trigger.replace(/^@+/, '')}\` con: ${value}`);
  },
};
