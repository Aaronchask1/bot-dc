function parseTimestamp(value) {
  const input = String(value ?? '').trim();
  // Require an explicit timezone; avoid interpreting the server's timezone as the user's.
  let seconds;
  if (/^\d{1,11}$/.test(input)) seconds = Number(input);
  else {
    const date = input.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?(Z|[+-]\d{2}:\d{2})$/i);
    if (date) {
      const [, y, m, d, h, min, sec = '0', zone] = date;
      const year = Number(y), month = Number(m), day = Number(d);
      const days = [31, (year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0)) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
      const validZone = zone.toUpperCase() === 'Z' || (Number(zone.slice(1, 3)) <= 23 && Number(zone.slice(4, 6)) <= 59);
      if (month >= 1 && month <= 12 && day >= 1 && day <= days[month - 1] && Number(h) <= 23 && Number(min) <= 59 && Number(sec) <= 59 && validZone) seconds = Math.floor(Date.parse(input) / 1000);
    }
  }
  if (!Number.isSafeInteger(seconds) || seconds < 0 || seconds > 253402300799) throw new Error('Usa segundos Unix o una fecha ISO con zona horaria.');
  return seconds;
}
module.exports = {
  name: 'timestamp', aliases: ['fecha', 'hora'], description: 'Crea una fecha que Discord adapta a cada zona horaria.', usage: 'xyb timestamp 2030-01-01T18:00Z', guildOnly: false,
  slash: { description: 'Crea una fecha adaptable a la zona horaria.', setup(builder) { return builder.addStringOption(o => o.setName('fecha').setDescription('Segundos Unix o fecha ISO con zona: 2030-01-01T18:00Z').setRequired(true)); } },
  async execute({ text, isSlash, interaction, reply, fail }) {
    try {
      const seconds = parseTimestamp(isSlash ? interaction.options.getString('fecha', true) : text);
      return reply({ content: `🗓️ <t:${seconds}:F> · <t:${seconds}:R>\nCopia: \`<t:${seconds}:F>\``, allowedMentions: { parse: [] } });
    } catch (error) { return fail(`${error.message} Ejemplo: \`xyb timestamp 2030-01-01T18:00Z\`.`); }
  },
  parseTimestamp,
};
