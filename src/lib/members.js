function normalize(value) {
  return String(value ?? '').trim().toLocaleLowerCase();
}

function memberNames(member) {
  return [
    member?.displayName,
    member?.user?.username,
    member?.user?.globalName,
    member?.user?.tag,
    member?.id,
  ].filter(Boolean).map(normalize);
}

/**
 * Encuentra una única persona por apodo, usuario, tag o ID dentro del caché
 * del servidor. Las coincidencias parciales solo se aceptan si no son
 * ambiguas: así `kiss ana` nunca puede besar a la Ana equivocada.
 */
function resolveFromList(list, query) {
  const wanted = normalize(query);
  if (!wanted) return { member: null, reason: 'not_found' };

  const members = [...list];
  const exact = members.filter((member) => memberNames(member).includes(wanted));
  const matches = exact.length ? exact : members.filter((member) => memberNames(member).some((name) => name.startsWith(wanted)));

  if (matches.length === 1) return { member: matches[0], reason: null };
  return { member: null, reason: matches.length > 1 ? 'ambiguous' : 'not_found' };
}

function resolveMember(guild, query) {
  if (!guild?.members?.cache) return { member: null, reason: 'not_found' };
  return resolveFromList(guild.members.cache.values(), query);
}

/**
 * La caché puede estar incompleta si no se usa el intent de miembros. En ese
 * caso Discord permite buscar por nombre mediante REST; solo se consulta
 * cuando el caché no encontró a nadie.
 */
async function resolveMemberAsync(guild, query) {
  const cached = resolveMember(guild, query);
  if (cached.member || cached.reason === 'ambiguous' || typeof guild?.members?.fetch !== 'function') return cached;

  try {
    const fetched = await guild.members.fetch({ query: String(query).trim(), limit: 10 });
    if (!fetched?.values) return cached;
    return resolveFromList(fetched.values(), query);
  } catch {
    return cached;
  }
}

function personHelp(reason) {
  return reason === 'ambiguous'
    ? 'Hay varias personas con ese nombre. Menciónala o usa su ID.'
    : 'No encontré a esa persona. Revisa el nombre, menciónala o usa su ID.';
}

module.exports = { memberNames, normalize, personHelp, resolveMember, resolveMemberAsync };
