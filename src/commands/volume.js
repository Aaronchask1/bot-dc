const music = require('../music/manager');

function icon(volume) {
    if (volume === 0) return '🔇';
    if (volume < 0.5) return '🔈';
    if (volume <= 1) return '🔉';
    return '🔊';
}

module.exports = {
    name: 'volume',
    aliases: ['vol', 'v'],
    description: 'Muestra o cambia el volumen (0-200 %).',
    usage: 'xyb volume [0-200]',
    guildOnly: true,
    slash: {
        description: 'Muestra o cambia el volumen (0-200 %).',
        setup(builder) {
            return builder.addIntegerOption((option) => option
                .setName('nivel')
                .setDescription('Porcentaje del 0 al 200. Sin valor muestra el actual.')
                .setMinValue(0)
                .setMaxValue(200));
        }
    },

    async execute(ctx) {
        const current = music.getVolume(ctx.guild.id);

        const rawValue = ctx.isSlash
            ? ctx.interaction.options.getInteger('nivel')
            : (ctx.args.length ? String(ctx.args[0]).replace('%', '').replace(',', '.') : null);

        if (rawValue === null || rawValue === undefined) {
            return ctx.reply(`${icon(current)} Volumen actual: **${Math.round(current * 100)}%**`);
        }

        const raw = Number(rawValue);
        if (!Number.isFinite(raw)) {
            return ctx.fail('❌ Uso: `xyb volume <0-200>` (ej: `xyb volume 80`)');
        }

        const volume = music.setVolume(ctx.guild.id, raw / 100);
        const porcentaje = Math.round(volume * 100);

        return ctx.reply(
            `${icon(volume)} Volumen ajustado a **${porcentaje}%**` +
            (volume === 0 ? ' (silencio)' : '')
        );
    }
};
