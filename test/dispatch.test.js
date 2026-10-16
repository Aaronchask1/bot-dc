const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

process.env.XYB_DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'xyb-dispatch-'));

const { PermissionFlagsBits, Collection } = require('discord.js');
const { handlePrefixCommand, findCommand } = require('../src/commands');

const ADMIN = { has: () => true, bitfield: PermissionFlagsBits.Administrator };
const NO_PERMS = { has: () => false, bitfield: 0n };

function makeGuild() {
  const roles = new Map();
  roles.set('111', { id: '111', toString: () => '@everyone', position: 0, managed: false });
  roles.set('222', { id: '222', toString: () => '@Mods', position: 5, managed: false });
  const guild = {
    id: 'g1',
    name: 'Servidor',
    iconURL: () => null,
    memberCount: 10,
    roles: { cache: roles },
    members: { me: { permissionsIn: () => ({ has: () => true }) } },
    channels: { cache: new Map() },
  };
  return guild;
}

function makeMessage(content, { permissions = ADMIN, guild = makeGuild() } = {}) {
  const replies = [];
  return {
    replies,
    message: {
      id: `m${Math.random()}`,
      content,
      author: { id: 'u1', tag: 'akira#0001', bot: false, toString: () => '<@u1>' },
      member: { permissions },
      guild,
      channel: { id: 'c1', send: async (payload) => replies.push(payload), guild },
      mentions: { users: { first: () => null, get: () => null } },
      reply: async (payload) => replies.push(payload),
    },
  };
}

function textOf(payload) {
  return typeof payload === 'string' ? payload : String(payload?.content ?? '');
}

test('xyb s responde aunque no haya nada borrado', async () => {
  const { message, replies } = makeMessage('xyb s');
  const handled = await handlePrefixCommand(message);
  assert.equal(handled, true);
  assert.equal(replies.length, 1, 'debe contestar algo, no quedarse mudo');
  assert.match(textOf(replies[0]), /No guardé/i);
});

test('xyb snipe también funciona con el nombre completo', async () => {
  const { message, replies } = makeMessage('xyb snipe 2');
  assert.equal(await handlePrefixCommand(message), true);
  assert.equal(replies.length, 1);
});

test('xyb roles lista los roles del servidor', async () => {
  const { message, replies } = makeMessage('xyb roles');
  assert.equal(await handlePrefixCommand(message), true);
  const embed = replies[0].embeds[0].toJSON();
  assert.match(embed.title, /2 roles/);
  assert.match(embed.description, /@Mods/);
});

test('xyb roles pide permiso para verlos', async () => {
  const { message, replies } = makeMessage('xyb roles', { permissions: NO_PERMS });
  assert.equal(await handlePrefixCommand(message), true);
  assert.match(textOf(replies[0]), /Gestionar servidor/);
});

test('xyb sin comando sugiere la ayuda', async () => {
  const { message, replies } = makeMessage('xyb');
  assert.equal(await handlePrefixCommand(message), true);
  assert.match(textOf(replies[0]), /xyb help/);
});

test('un comando desconocido lo ignora para que lo atienda el bot original', async () => {
  const { message, replies } = makeMessage('xyb moderacionrara');
  assert.equal(await handlePrefixCommand(message), false);
  assert.equal(replies.length, 0);
});

test('resuelve un apodo único, pero nunca adivina entre varias personas', () => {
  const { resolveMember } = require('../src/lib/members');
  const ana = { id: '1', displayName: 'Ana', user: { id: '1', username: 'ana', tag: 'ana#0001' } };
  const anabel = { id: '2', displayName: 'Anabel', user: { id: '2', username: 'anabel', tag: 'anabel#0001' } };
  const carlos = { id: '3', displayName: 'CSR', user: { id: '3', username: 'csr', tag: 'csr#0001' } };
  const guild = { members: { cache: new Map([['1', ana], ['2', anabel], ['3', carlos]]) } };

  assert.equal(resolveMember(guild, 'csr').member, carlos);
  assert.equal(resolveMember(guild, 'ana').member, ana, 'la coincidencia exacta gana');
  assert.equal(resolveMember(guild, 'an').reason, 'ambiguous');
  assert.equal(resolveMember(guild, 'nadie').reason, 'not_found');
});

test('busca por REST si la persona no está en caché', async () => {
  const { resolveMemberAsync } = require('../src/lib/members');
  const csr = { id: '3', displayName: 'CSR', user: { id: '3', username: 'csr', tag: 'csr#0001' } };
  let received;
  const guild = {
    members: {
      cache: new Map(),
      fetch: async (options) => {
        received = options;
        return new Map([['3', csr]]);
      },
    },
  };
  const result = await resolveMemberAsync(guild, 'csr');
  assert.equal(result.member, csr);
  assert.deepEqual(received, { query: 'csr', limit: 10, time: 2500 });
});

test('no interpreta palabras que solo empiezan por el prefijo como comandos', async () => {
  const { message, replies } = makeMessage('xybroles');
  assert.equal(await handlePrefixCommand(message), false);
  assert.equal(replies.length, 0);
});

test('xyb avatar sin mención muestra el avatar de quien pregunta', async () => {
  const { message, replies } = makeMessage('xyb avatar');
  const person = {
    id: 'u1',
    username: 'akira',
    displayAvatarURL: (options) => `https://cdn.discordapp.com/avatars/1/${options?.size ?? 128}.png`,
  };
  message.author = { ...person, bot: false, tag: 'akira#0001', toString: () => '<@u1>' };
  assert.equal(await handlePrefixCommand(message), true);
  const embed = replies[0].embeds[0].toJSON();
  assert.match(embed.description, /cdn.discordapp.com/);
});

test('el prefijo ! funciona pegado y con espacio', () => {
  const { normalizeCustomPrefix } = require('../src/index');
  for (const [entrada, esperado] of [['!roles', 'xyb roles'], ['! roles', 'xyb roles'], ['!kiss @ana', 'xyb kiss @ana']]) {
    const { message } = makeMessage(entrada);
    assert.equal(normalizeCustomPrefix(message), true, `no reconoció ${entrada}`);
    assert.equal(message.content, esperado);
  }
});

test('un prefijo que no está configurado no se toca', () => {
  const { normalizeCustomPrefix } = require('../src/index');
  for (const entrada of ['?roles', 'hola', 'xyb roles']) {
    const { message } = makeMessage(entrada);
    assert.equal(normalizeCustomPrefix(message), false, `no debería tocar ${entrada}`);
    assert.equal(message.content, entrada);
  }
});

test('!roles ejecuta el comando de roles', async () => {
  const { normalizeCustomPrefix } = require('../src/index');
  const { message, replies } = makeMessage('!roles');
  normalizeCustomPrefix(message);
  assert.equal(await handlePrefixCommand(message), true);
});

test('purge bots y c bots atienden solo bots y dejan los números al original', async () => {
  const { findCommand } = require('../src/commands');
  const purge = findCommand('purge');
  assert.equal(purge.name, 'purge');
  assert.equal(purge.match(['bots']), true, 'atiende "purge bots"');
  assert.equal(findCommand('c').match(['bots']), true, '"c bots" también');
  assert.equal(purge.match(['50']), false, 'los números los sigue el comando original');
  assert.equal(findCommand('pg'), null, '"pg" queda reservado para borrar mensajes propios');
});

test('la barredora de bots solo se queda con mensajes de bots', async () => {
  const { collect } = require('../src/commands/purge-bots');
  const { Collection } = require('discord.js');
  const ahora = Date.now();
  const mensajes = [
    { id: '1', author: { bot: true }, createdTimestamp: ahora - 1000 },
    { id: '2', author: { bot: false }, createdTimestamp: ahora - 2000 },
    { id: '3', author: { bot: true }, createdTimestamp: ahora - 3000 },
    { id: '4', author: { bot: false }, createdTimestamp: ahora - 4000 },
  ];
  const channel = {
    messages: {
      fetch: async () => new Collection(mensajes.map((m) => [m.id, m])),
    },
  };
  const encontrados = await collect(channel, (m) => m.author.bot, 100);
  assert.deepEqual(encontrados.map((m) => m.id), ['1', '3']);
});

test('los alias de purge no chocan con comandos ya hechos', () => {
  const { findCommand } = require('../src/commands');
  // Estos nombres ya existen en index.js y deben seguir funcionando igual.
  assert.equal(findCommand('purge').match(['10']), false);
  assert.equal(findCommand('c').match(['10']), false);
  assert.equal(findCommand('apg'), null);
});

test('xyb purge bots entra al comando nuevo y xyb purge 50 pasa al original', async () => {
  // Esto va por el despachador de verdad: antes daba "Cannot access 'args'
  // before initialization" y los tests que había no lo cazaban.
  const { handlePrefixCommand } = require('../src/commands');

  const conBots = makeMessage('xyb purge bots');
  conBots.message.guild.members.me = { permissionsIn: () => ({ has: () => true }) };
  conBots.message.channel.bulkDelete = async (batch) => {
    conBots.message.channel.borrados = (conBots.message.channel.borrados ?? 0) + batch.size;
    return batch;
  };
  conBots.message.channel.messages = { fetch: async () => new Collection() };
  assert.equal(await handlePrefixCommand(conBots.message), true, '"purge bots" lo debe atender el nuevo');

  const conNumero = makeMessage('xyb purge 50');
  assert.equal(await handlePrefixCommand(conNumero.message), false, '"purge 50" lo deja al original de index.js');
  assert.equal(conNumero.replies.length, 0, 'y no contesta nada por su cuenta');
});

test('c bots avisa cuando no hay mensajes de bots', async () => {
  const { handlePrefixCommand } = require('../src/commands');
  const { message, replies } = makeMessage('xyb c bots');
  message.guild.members.me = { permissionsIn: () => ({ has: () => true }) };
  message.channel.messages = { fetch: async () => new Collection() };
  assert.equal(await handlePrefixCommand(message), true);
  assert.match(textOf(replies[0]), /No encontré mensajes de bots/);
});

test('c bots acepta una cantidad explícita de mensajes', async () => {
  const messages = Array.from({ length: 150 }, (_, index) => ({
    id: String(150 - index),
    author: { bot: true },
    createdTimestamp: Date.now(),
  }));
  let page = 0;
  const deleted = [];
  const channel = {
    messages: {
      fetch: async () => new Collection((page++ === 0 ? messages.slice(0, 100) : page === 2 ? messages.slice(100) : []).map((item) => [item.id, item])),
    },
    bulkDelete: async (batch) => {
      deleted.push(batch.size);
      return batch;
    },
  };
  const command = findCommand('c');
  await command.execute({
    channel,
    args: ['bots', '150'],
    invokedName: 'c',
    isSlash: false,
    fail: async () => {},
    reply: async () => {},
  });
  assert.equal(deleted.reduce((sum, count) => sum + count, 0), 150);
});

test('lock y unlock avisan sin mencionar a @everyone', async () => {
  const { executeModeration } = require('../src/index');
  const channel = { permissionOverwrites: { edit: async () => ({}) } };
  const base = {
    guild: makeGuild(),
    channel,
    actor: { user: { tag: 'papi#1' } },
    reason: 'prueba',
  };

  const cerrado = await executeModeration({ ...base, command: 'lock' });
  assert.match(cerrado, /lock/i);
  assert.equal(cerrado.includes('@everyone'), false, 'no debe mencionar a @everyone');
  assert.equal(cerrado.includes('<@&'), false, 'ni en forma de mención');

  const abierto = await executeModeration({ ...base, command: 'unlock' });
  assert.match(abierto, /unlock/i);
  assert.equal(abierto.includes('@everyone'), false, 'no debe mencionar a @everyone');
});

test('la ayuda tiene categorías y selector válido', () => {
  const { HELP_CATEGORIES, helpComponents, helpEmbed, helpText } = require('../src/index');
  assert.ok(HELP_CATEGORIES.length >= 4);
  const menu = helpComponents()[0].toJSON().components[0];
  assert.equal(menu.custom_id, 'help:category');
  assert.equal(menu.options.length, HELP_CATEGORIES.length + 1);
  const moderation = helpEmbed('moderacion').toJSON();
  assert.match(moderation.description, /purge\|c bots/);
  assert.match(helpText(), /Elige una categoría/);
});

test('el botón de abrazar de vuelta solo lo puede tocar quien recibió', async () => {
  const hugs = require('../src/lib/hugs');
  const otro = {
    isButton: () => true,
    customId: 'hug:back:u1:u2',
    user: { id: 'u3' },
    replied: null,
    reply: async (payload) => { otro.replied = payload; },
  };
  assert.equal(await hugs.handleComponent(otro), true, 'lo reconoce');
  assert.match(otro.replied.content, /Solo la persona que recibió/);
});

test('la propuesta solo la acepta la persona mencionada', async () => {
  const props = require('../src/lib/marriage-props');
  const ajeno = {
    isButton: () => true,
    customId: 'mry:yes:u1:u2',
    user: { id: 'u9' },
    reply: async (payload) => { ajeno.replied = payload; },
  };
  assert.equal(await props.handleComponent(ajeno), true);
  assert.match(ajeno.replied.content, /no es para ti/);
});

test('el botón del abrazo se genera con los dos ids', () => {
  const hugs = require('../src/lib/hugs');
  const row = hugs.backButton('111', '222').toJSON();
  assert.equal(row.components[0].custom_id, 'hug:back:111:222');
  assert.equal(row.components[0].label, '🤗 Abrazar de vuelta');
});

test('rol encuentra el rol por nombre sin mención', () => {
  const { resolveRole } = require('../src/commands/rol');
  const roles = [
    { name: 'Mecos', toString: () => '@Mecos' },
    { name: 'Moderadores', toString: () => '@Mods' },
    { name: 'VIP', toString: () => '@VIP' },
  ];
  const guild = { roles: { cache: new Map(roles.map((role, index) => [`r${index}`, role])) } };
  const message = { mentions: { roles: { first: () => null } } };

  const exacto = resolveRole({ isSlash: false, message, guild, args: ['add', 'mecos'] });
  assert.equal(exacto?.name, 'Mecos', 'debe encontrar "mecos" sin mencionar');

  const parcial = resolveRole({ isSlash: false, message, guild, args: ['add', 'mod'] });
  assert.equal(parcial?.name, 'Moderadores', 'también acepta el comienzo');

  const nada = resolveRole({ isSlash: false, message, guild, args: ['add'] });
  assert.equal(nada, null, 'sin texto no adivina');
});

test('rol encuentra el rol por nombre aunque venga la persona pegada', () => {
  const { resolveRole } = require('../src/commands/rol');
  const roles = [
    { id: '1', name: 'mecos', toString: () => '@mecos' },
    { id: '2', name: 'Moderadores', toString: () => '@Mods' },
    { id: '3', name: 'VIP', toString: () => '@VIP' },
  ];
  const guild = { id: 'g1', roles: { cache: new Map(roles.map((role) => [role.id, role])) } };
  const message = { mentions: { roles: { first: () => null } } };

  // Caso real: "xyb rol add @csr mecos" → args = ['add', '@csr', 'mecos']
  const conMencionPegada = resolveRole({ isSlash: false, message, guild, args: ['add', '<@961823716273176698>', 'mecos'] });
  assert.equal(conMencionPegada?.name, 'mecos', 'debe ignorar la mención de la persona');

  const conId = resolveRole({ isSlash: false, message, guild, args: ['add', '123456789012345678', 'mecos'] });
  assert.equal(conId?.name, 'mecos', 'también ignora un id suelto');

  const sinPersona = resolveRole({ isSlash: false, message, guild, args: ['add', 'mecos'] });
  assert.equal(sinPersona?.name, 'mecos');

  const quitar = resolveRole({ isSlash: false, message, guild, args: ['remove', '<@961823716273176698>', 'VIP'] });
  assert.equal(quitar?.name, 'VIP');

  const nada = resolveRole({ isSlash: false, message, guild, args: ['add'] });
  assert.equal(nada, null);
});

test('el rol mecos dispara una respuesta distinta al ponerlo y al quitarlo', () => {
  const fs = require('node:fs');
  const codigo = fs.readFileSync(require.resolve('../src/commands/rol'), 'utf8');
  assert.match(codigo, /jajaja te tiro los mecos puta/, 'al agregarlo');
  assert.match(codigo, /jajaj pendejo violado/, 'al quitarlo');
  assert.equal(codigo.includes('tu dios'), false, 'el texto viejo no debe quedar');
  assert.match(codigo, /'mecos'/, 'y solo salta con ese rol');
});

test('los alias nuevos están registrados', () => {
  assert.equal(findCommand('24x7').name, 'vc');
  assert.equal(findCommand('voz').name, 'vc');
  assert.equal(findCommand('listroles').name, 'roles');
});
