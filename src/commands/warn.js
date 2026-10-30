const { PermissionFlagsBits } = require('discord.js');
const { createStore } = require('../store');

const store = createStore('moderation-warnings', {});
const MAX_RECORDS = 5000;

function cleanId(value) {
  const match = String(value ?? '').match(/^(?:<@!?(\d{17,20})>|(\d{17,20}))$/);
  return match?.[1] ?? match?.[2] ?? null;
}

function applyWarning(data, { guildId, targetId, actorId, action, reason, caseId }) {
  const records = Array.isArray(data[guildId]) ? data[guildId] : [];
  if (action === 'list') return { records: records.filter(item => item.targetId === targetId).slice(-10).reverse() };
  if (action === 'remove') {
    const index = records.findIndex(item => item.id === caseId && item.targetId === targetId);
    if (index < 0) return { error: 'No encontré esa advertencia para este usuario.' };
    records.splice(index, 1);
    data[guildId] = records;
    return { removed: true };
  }
  if (records.length >= MAX_RECORDS) return { error: 'El registro de este servidor está lleno.' };
  const id = require('node:crypto').randomBytes(6).toString('hex');
  records.push({ id, targetId, actorId, reason: reason || 'Sin motivo indicado', createdAt: new Date().toISOString() });
  data[guildId] = records;
  return { id };
}

module.exports = {
  name: 'warn', aliases: ['advertencia', 'warnings'],
  description: 'Registra y consulta advertencias de moderación.',
  usage: 'xyb warn add|list|remove @usuario [motivo o ID]', guildOnly: true,
  permissions: [PermissionFlagsBits.ModerateMembers],
  slash: { description: 'Gestiona advertencias del servidor.', setup(builder) {
    return builder.addStringOption(o => o.setName('accion').setDescription('add, list o remove').setRequired(true).addChoices({name:'Añadir',value:'add'},{name:'Consultar',value:'list'},{name:'Eliminar',value:'remove'}))
      .addUserOption(o => o.setName('usuario').setDescription('Miembro o usuario').setRequired(true))
      .addStringOption(o => o.setName('detalle').setDescription('Motivo o ID de advertencia').setMaxLength(400));
  } },
  async execute({ guild, user, args, isSlash, interaction, reply, fail }) {
    const action = (isSlash ? interaction.options.getString('accion', true) : args[0] || '').toLowerCase();
    const targetId = isSlash ? interaction.options.getUser('usuario', true).id : cleanId(args[1]);
    const detail = (isSlash ? interaction.options.getString('detalle') || '' : args.slice(2).join(' ')).trim();
    if (!['add','list','remove'].includes(action) || !targetId) return fail('Uso: `xyb warn add|list|remove @usuario [motivo o ID]`.');
    if (detail.length > 400 || (action === 'remove' && !/^[a-f0-9]{12}$/.test(detail))) return fail('Motivo demasiado largo o ID de advertencia inválido.');
    const data = store.read();
    const result = applyWarning(data, { guildId: guild.id, targetId, actorId: user.id, action, reason: detail, caseId: detail });
    if (result.error) return fail(result.error);
    if (action !== 'list') store.set(guild.id, data[guild.id]);
    const content = action === 'add' ? `Advertencia registrada para el usuario \`${targetId}\`. ID: \`${result.id}\`.` : action === 'remove' ? 'Advertencia eliminada.' : result.records.length ? `Últimas advertencias de \`${targetId}\`:\n` + result.records.map(r => `\`${r.id}\` · ${r.createdAt.slice(0,10)} · ${r.reason.replace(/[\r\n]+/g, ' ').slice(0,120)}`).join('\n') : 'No hay advertencias para este usuario.';
    return reply({ content, allowedMentions: { parse: [] } });
  },
  applyWarning,
};
