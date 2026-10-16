const afk = require('../lib/afk');

module.exports = {
  name: 'afk', description: 'Marca que estás ausente y avisa cuando te mencionan.', usage: 'xyb afk [motivo]', guildOnly: true,
  slash: { description: 'Marca que estás ausente.', setup(builder) { return builder.addStringOption((option) => option.setName('motivo').setDescription('Motivo opcional')); } },
  async execute({ guild, user, args, interaction, isSlash, reply }) {
    const reason = isSlash ? (interaction.options.getString('motivo') ?? '') : args.join(' ');
    afk.set(guild.id, user.id, reason);
    await reply(`💤 ${user}, marqué tu AFK${reason ? `: **${reason.slice(0, 180)}**` : ''}. Lo quitaré cuando vuelvas a hablar.`);
  },
};
