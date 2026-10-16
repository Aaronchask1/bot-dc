const polls = require('../lib/polls');

function parse(raw) {
  const parts = String(raw ?? '').split('|').map((part) => part.trim()).filter(Boolean);
  const [question, ...options] = parts;
  if (!question || options.length < 2 || options.length > 5 || options.some((option) => option.length > 80)) return null;
  return { question, options };
}
module.exports = {
  name: 'poll', aliases: ['encuesta'], description: 'Crea una encuesta con botones y voto cambiable.', usage: 'xyb poll Pregunta | opción 1 | opción 2', guildOnly: true,
  slash: { description: 'Crea una encuesta con botones.', setup(builder) {
    builder.addStringOption((option) => option.setName('pregunta').setDescription('Pregunta').setRequired(true));
    for (let index = 1; index <= 5; index += 1) builder.addStringOption((option) => option.setName(`opcion${index}`).setDescription(`Opción ${index}`).setRequired(index <= 2));
    return builder;
  } },
  async execute({ guild, user, text, isSlash, interaction, send, fail }) {
    const input = isSlash
      ? { question: interaction.options.getString('pregunta', true), options: [1, 2, 3, 4, 5].map((index) => interaction.options.getString(`opcion${index}`)).filter(Boolean) }
      : parse(text);
    if (!input || !input.question || input.options.length < 2 || input.options.length > 5) return fail('Uso: `xyb poll ¿Qué vemos? | Anime | Película` (de 2 a 5 opciones).');
    const poll = polls.create(guild.id, user.id, input.question, input.options.map((option) => option.slice(0, 80)));
    await send(polls.payload(poll));
  },
};
