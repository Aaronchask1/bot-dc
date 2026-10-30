// A deliberately small arithmetic parser: no eval, identifiers or function calls.
function calculate(input) {
  const text = String(input ?? '').trim();
  if (!text || text.length > 150 || /[^0-9.()+\-*/\s]/.test(text)) throw new Error('Expresión inválida.');
  let pos = 0;
  const space = () => { while (/\s/.test(text[pos] ?? '') && pos < text.length) pos += 1; };
  const finite = (n) => { if (!Number.isFinite(n) || Math.abs(n) > 1e15) throw new Error('Resultado fuera de rango.'); return n; };
  function primary(depth) {
    if (depth > 24) throw new Error('Demasiados paréntesis.');
    space();
    if (text[pos] === '+' || text[pos] === '-') { const sign = text[pos++]; const n = primary(depth + 1); return sign === '-' ? -n : n; }
    if (text[pos] === '(') { pos += 1; const n = expression(depth + 1); space(); if (text[pos++] !== ')') throw new Error('Falta cerrar paréntesis.'); return n; }
    const match = text.slice(pos).match(/^(?:\d+(?:\.\d*)?|\.\d+)/);
    if (!match) throw new Error('Se esperaba un número.');
    pos += match[0].length;
    return finite(Number(match[0]));
  }
  function product(depth) {
    let result = primary(depth);
    while (true) { space(); const op = text[pos]; if (op !== '*' && op !== '/') break; pos += 1; const n = primary(depth); if (op === '/' && n === 0) throw new Error('No se puede dividir entre cero.'); result = finite(op === '*' ? result * n : result / n); }
    return result;
  }
  function expression(depth) {
    let result = product(depth);
    while (true) { space(); const op = text[pos]; if (op !== '+' && op !== '-') break; pos += 1; const n = product(depth); result = finite(op === '+' ? result + n : result - n); }
    return result;
  }
  const result = expression(0); space(); if (pos !== text.length) throw new Error('Expresión inválida.'); return result;
}

module.exports = {
  name: 'calc', aliases: ['calcular'], description: 'Calcula operaciones aritméticas.', usage: 'xyb calc (12 + 8) / 2', guildOnly: false,
  slash: { description: 'Calcula una expresión aritmética.', setup(builder) { return builder.addStringOption(o => o.setName('expresion').setDescription('Ejemplo: (12 + 8) / 2').setRequired(true).setMaxLength(150)); } },
  async execute({ text, isSlash, interaction, reply, fail }) {
    const expression = isSlash ? interaction.options.getString('expresion', true) : text;
    try { return reply({ content: `🧮 Resultado: **${calculate(expression)}**`, allowedMentions: { parse: [] } }); }
    catch (error) { return fail(`${error.message} Uso: \`xyb calc (12 + 8) / 2\`.`); }
  },
  calculate,
};
