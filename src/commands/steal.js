const { PermissionFlagsBits, StickerFormatType } = require('discord.js');

// Discord solo acepta PNG, APNG y Lottie como stickers. Los GIF hay que
// convertirlos aparte, así que aquí se avisa en vez de fallar en silencio.
const EMOJI_PATTERN = /<a?:(\w{2,32}):(\d{17,20})>|:(\w{2,32}):(\d{17,20}):>/;
const ALLOWED_EXTENSIONS = /\.(png|apng|json)(?:\?|$)/i;

function emojiUrl(id) {
  return `https://cdn.discordapp.com/emojis/${id}.png?size=320`;
}

function cleanName(raw) {
  return String(raw ?? 'sticker')
    .replace(/[^\p{L}\p{N}_]/gu, '_')
    .slice(0, 30) || 'sticker';
}

/** Saca el emoji o sticker del mensaje respondido (o del argumento). */
function sourceFromMessage(message) {
  if (!message) return null;
  const sticker = message.stickers?.first?.();
  if (sticker) {
    if (sticker.format === StickerFormatType.Lottie) return { url: sticker.url, name: sticker.name, lottie: true };
    if (sticker.format === StickerFormatType.PNG || sticker.format === StickerFormatType.APng) {
      return { url: sticker.url, name: sticker.name };
    }
    return null;
  }
  const emoji = parseEmoji(message.content);
  if (emoji) return emoji;
  const attachment = message.attachments?.first?.();
  if (attachment && ALLOWED_EXTENSIONS.test(attachment.url)) {
    return { url: attachment.url, name: attachment.name?.split('.')[0] };
  }
  return null;
}

module.exports = {
  name: 'steal',
  aliases: ['rob', 'stickersteal'],
  description: 'Crea un sticker en este servidor a partir de un emoji o sticker.',
  usage: 'xyb steal [responde a un mensaje con emoji/sticker | pega un emoji o URL .png]',
  guildOnly: true,
  botPermissions: [PermissionFlagsBits.ManageGuildExpressions],
  slash: {
    description: 'Crea un sticker en este servidor a partir de un emoji.',
    setup(builder) {
      return builder
        .addStringOption((option) => option
          .setName('emoji')
          .setDescription('El emoji o la URL de la imagen (.png, .apng o .json).')
          .setRequired(true));
    },
  },

  async execute({ message, isSlash, interaction, guild, channel, user, fail, reply }) {
    let source = null;

    if (isSlash) {
      const value = interaction.options.getString('emoji', true).trim();
      source = parseEmoji(value);
      if (!source && /^https?:\/\//i.test(value)) {
        source = { url: value, name: value.split('/').pop().split('.')[0] };
      }
    } else {
      const replied = message.reference?.messageId
        ? await channel.messages.fetch(message.reference.messageId).catch(() => null)
        : null;
      source = sourceFromMessage(replied ?? message) ?? sourceFromText(message);

    }

    if (!source) {
      return fail('Responde a un mensaje con un emoji o sticker, o pásame un emoji/URL: `xyb steal <:name:123456789>`');
    }

    if (!ALLOWED_EXTENSIONS.test(source.url) && !source.url.includes('cdn.discordapp.com/emojis/')) {
      return fail('Ese archivo no sirve como sticker. Solo PNG, APNG o Lottie.');
    }

    try {
      const sticker = await guild.stickers.create({
        file: source.url,
        name: cleanName(source.name),
        tags: '🙂',
        description: `Sticker creado por el bot para ${user.tag}`,
      });
      await reply({
        content: `✅ Sticker **${sticker.name}** creado. Ya puedes usarlo con \`:${sticker.name}:\``,
        stickers: [sticker.id],
      });
    } catch (error) {
      return fail('Discord no me dejó crear el sticker. Revisa que el bot tenga **Gestionar stickers y emojis** y que el archivo sea PNG, APNG o Lottie.');
    }
  },
};

function parseEmoji(content) {
  const match = EMOJI_PATTERN.exec(content ?? '');
  if (!match) return null;
  // <a?:nombre:id> → grupo 1 nombre, grupo 2 id. :nombre:id: → grupo 3 y 4.
  return { url: emojiUrl(match[2] ?? match[4]), name: match[1] ?? match[3] };
}

// Si no venía en un mensaje, se busca en el texto del comando.
function sourceFromText(message) {
  const fromEmoji = parseEmoji(message.content);
  if (fromEmoji) return fromEmoji;
  const url = (message.content.match(/https?:\/\/\S+/i) ?? [])[0] ?? null;
  if (url && ALLOWED_EXTENSIONS.test(url)) return { url, name: url.split('/').pop().split('.')[0] };
  return null;
}

// Se exporta lo puro para poder probarlo sin levantar el bot.
module.exports.__test = {
  isAllowed: (url) => ALLOWED_EXTENSIONS.test(url),
  cleanName,
  parseEmoji,
};
