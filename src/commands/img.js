const { EmbedBuilder } = require('discord.js');
const images = require('../lib/image-search');
const memes = require('../lib/meme-search');

module.exports = {
  name: 'img',
  aliases: ['imagen'],
  description: 'Busca fotos y memes existentes en sitios web, sin IA ni clave API.',
  usage: 'xyb img descripción',
  async execute(context) {
    const { text, reply, fail } = context;
    const query = String(text ?? '').trim();
    if (!query || query.length > 300) return fail('Uso: `xyb img gato encima de perro` (máximo 300 caracteres).');
    const more = `https://www.google.com/search?tbm=isch&q=${encodeURIComponent(query)}`;
    try {
      if (/\b(meme|memes|gracioso|graciosa)\b/i.test(query)) {
        const terms = query.replace(/\b(un|una|de|del|meme|memes|gracioso|graciosa)\b/gi, ' ').replace(/\s+/g, ' ').trim();
        const meme = await memes.search(terms).catch(() => null);
        if (meme) return await reply({ allowedMentions: { parse: [] }, embeds: [new EmbedBuilder().setTitle(meme.name)
          .setURL(`https://imgflip.com/memegenerator/${meme.id}`).setImage(meme.url)
          .setFooter({ text: 'Plantilla existente · Imgflip' })] });
      }
      const result = await images.search(query);
      if (!result) return reply({ content: `No encontré una imagen suficientemente relacionada. [Buscar en Google Imágenes](${more})`, allowedMentions: { parse: [] } });
      return await reply({ allowedMentions: { parse: [] }, embeds: [new EmbedBuilder()
        .setColor(0xFF8C69).setTitle(`Imagen: ${query.slice(0, 240)}`).setURL(result.source)
        .setImage(result.image).setDescription(`${result.related ? 'Imagen relacionada; puede no reproducir toda la escena.\n' : ''}[Fuente y licencia](${result.source}) · [Más imágenes](${more})`)
        .setFooter({ text: `${result.artist} · ${result.license} · ${result.provider}` })] });
    } catch {
      return reply({ content: `Los buscadores no respondieron. [Abrir Google Imágenes](${more})`, allowedMentions: { parse: [] } });
    }
  },
};
