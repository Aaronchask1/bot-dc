const quoteCard = require('../lib/quote-card');

async function referencedMessage(message) {
  if (!message?.reference?.messageId) return null;
  return message.channel?.messages?.cache?.get(message.reference.messageId)
    ?? message.fetchReference?.().catch(() => null)
    ?? null;
}
module.exports = {
  name: 'quote', aliases: ['cita'], description: 'Crea una tarjeta visual desde texto o un mensaje respondido.', usage: 'xyb quote texto | responde un mensaje con xyb quote', guildOnly: false,
  slash: { description: 'Crea una tarjeta visual con un texto.', setup(builder) { return builder.addStringOption((option) => option.setName('text').setDescription('Texto a citar (opcional)').setRequired(false).setMaxLength(900)); } },
  async execute({ text, isSlash, interaction, message, user, reply, fail }) {
    const supplied = isSlash ? interaction.options.getString('text') : String(text ?? '').trim();
    let content = supplied; let author = user;
    if (!content && !isSlash) {
      const source = await referencedMessage(message);
      if (source) { content = source.content?.trim(); author = source.author ?? user; }
    }
    if (!content) return fail('Uso: `xyb quote texto` o responde a un mensaje con `xyb quote`.');
    return reply(await quoteCard.card({ text: content, author }));
  },
};
