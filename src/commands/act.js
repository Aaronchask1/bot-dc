const interactionGifs = require('../lib/interaction-gifs');

const ACT_ACTIONS = Object.fromEntries(
  Object.entries(interactionGifs.ACTIONS).filter(([name]) => name !== 'hug'),
);
const ACT_ALIASES = Object.fromEntries(
  Object.entries(interactionGifs.ACTION_ALIASES).filter(([, action]) => ACT_ACTIONS[action]),
);
const ACTION_NAMES = Object.keys(ACT_ACTIONS);

function normalizeAction(raw) {
  const name = String(raw ?? '').toLowerCase();
  if (ACT_ACTIONS[name]) return name;
  return ACT_ALIASES[name] ?? null;
}

module.exports = {
  name: 'act',
  aliases: [...ACTION_NAMES, ...Object.keys(ACT_ALIASES)],
  description: `Interacciones con GIF: ${ACTION_NAMES.join(', ')}.`,
  usage: 'xyb act <acción> [persona] | xyb slap @persona | xyb hi',
  guildOnly: true,
  resolveMember: true,
  // Para `xyb act slap csr`, el nombre que hay que buscar es "csr", no
  // "slap csr". En los alias directos (`xyb slap csr`) se usa todo el texto.
  targetArgs(args, invokedName) {
    return invokedName === 'act' ? args.slice(1).join(' ') : args.join(' ');
  },
  slash: {
    description: 'Haz una interacción con alguien usando un GIF.',
    setup(builder) {
      return builder
        .addStringOption((option) => option
          .setName('accion')
          .setDescription('Acción')
          .setRequired(true)
          .addChoices(...ACTION_NAMES.map((name) => ({ name, value: name }))))
        .addUserOption((option) => option
          .setName('usuario')
          .setDescription('Persona (opcional para saludos y acciones en solitario)'));
    },
  },

  async execute({ invokedName, args, target, user, isSlash, interaction, reply, fail, defer }) {
    const raw = isSlash
      ? interaction.options.getString('accion', true)
      : (invokedName === 'act' ? args.shift() : invokedName);
    const action = normalizeAction(raw);
    if (!action) return fail(`Acciones: ${ACTION_NAMES.join(', ')}.`);

    const person = isSlash
      ? (interaction.options.getUser('usuario') ?? user)
      : (target ?? user);
    if (person.bot) return fail('Esa interacción es solo para personas.');

    if (isSlash) await defer();
    await reply(interactionGifs.payloadFor({ action, user, target: person }));
  },
};
