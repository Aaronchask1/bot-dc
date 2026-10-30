const { randomInt } = require('node:crypto');
const { EmbedBuilder } = require('discord.js');
function parseColor(input) {
  const value = String(input ?? '').trim();
  if (!value) return randomInt(0x1000000);
  if (!/^#?[0-9a-fA-F]{6}$/.test(value)) throw new Error('Escribe un color hexadecimal de seis dígitos, por ejemplo #A47BFA.');
  return Number.parseInt(value.replace(/^#/, ''), 16);
}
module.exports = {
  name: 'color', aliases: ['colour'], description: 'Muestra un color hexadecimal o elige uno al azar.', usage: 'xyb color #A47BFA', guildOnly: false,
  slash: { description: 'Muestra un color o elige uno al azar.', setup(builder) { return builder.addStringOption(o => o.setName('hex').setDescription('Código de seis dígitos, por ejemplo #A47BFA')); } },
  async execute({ text, isSlash, interaction, reply, fail }) {
    try {
      const color = parseColor(isSlash ? interaction.options.getString('hex') : text);
      const hex = `#${color.toString(16).padStart(6, '0').toUpperCase()}`;
      return reply({ embeds: [new EmbedBuilder().setColor(color).setTitle('🎨 Color XYB').setDescription(`**${hex}**`)], allowedMentions: { parse: [] } });
    } catch (error) { return fail(error.message); }
  },
  parseColor,
};
