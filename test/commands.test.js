const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

process.env.XYB_DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'xyb-e2e-'));

const { Collection, ChannelType } = require('discord.js');
const { listCommands } = require('../src/commands');

const AVATAR = 'https://cdn.discordapp.com/embed/avatars/1.png';

function role(id, name, position, extra = {}) {
  return {
    id,
    name,
    position,
    managed: false,
    toString: () => `@${name}`,
    ...extra,
  };
}

/** Un contexto falso pero con TODO lo que un comando puede tocar. */
function makeContext({ args = [], options = {}, target = null, mentionRole = null } = {}) {
  const replies = [];
  const record = (payload) => { replies.push(payload); return payload; };
  // channel.send devuelve el mensaje creado, como en Discord de verdad.
  const sent = (payload) => {
    replies.push(payload);
    return { ...payload, createdTimestamp: Date.now(), edit: async () => record({ editado: true }) };
  };

  const roles = new Collection([
    ['r1', role('r1', 'mecos', 3)],
    ['r2', role('r2', 'VIP', 4)],
    ['r3', role('r3', '@everyone', 0)],
  ]);

  const channel = {
    id: 'c1',
    name: 'general',
    type: ChannelType.GuildText,
    guild: null,
    send: async (payload) => sent(payload),
    messages: { fetch: async () => new Collection() },
    bulkDelete: async (batch) => batch,
    permissionOverwrites: { edit: async () => ({}) },
    members: { size: 4 },
  };

  const user = { id: 'u1', tag: 'akira#0001', username: 'akira', premium_type: 2, flags: { has: () => false } };
  const member = {
    id: 'u1',
    user,
    displayName: 'akira',
    displayAvatarURL: () => AVATAR,
    premiumSince: null,
    premiumSinceTimestamp: null,
    joinedTimestamp: Date.now() - 1000,
    roles: { cache: new Collection(), highest: { position: 1 } },
    permissions: { has: () => true },
    voice: { channel: null },
  };

  const guild = {
    id: 'g1',
    name: 'Servidor',
    ownerId: 'u1',
    memberCount: 42,
    roles: { cache: roles },
    emojis: { cache: new Collection() },
    channels: { cache: new Collection(), create: async () => ({}) },
    features: [],
    verificationLevel: 0,
    premiumSubscriptionCount: 0,
    iconURL: () => null,
    voiceAdapterCreator: () => ({}),
    fetchOwner: async () => ({ user }),
    members: {
      me: { roles: { highest: { position: 10 } }, permissionsIn: () => ({ has: () => true }) },
      fetch: async () => ({
        id: 'u2',
        user: { id: 'u2', tag: 'csr#2' },
        roles: {
          cache: new Collection(),
          highest: { position: 2 },
          add: async () => {},
          remove: async () => {},
        },
      }),
    },
  };
  channel.guild = guild;

  const message = {
    id: 'm1',
    content: 'xyb prueba',
    author: user,
    member,
    guild,
    channel,
    reference: null,
    mentions: {
      users: { first: () => target, get: () => target },
      members: { first: () => target },
      roles: { first: () => mentionRole },
    },
    reply: async (payload) => record(payload),
  };

  const interaction = {
    user,
    member,
    guild,
    channel,
    message,
    client: { user: { tag: 'xyb#1', displayAvatarURL: () => AVATAR }, ws: { ping: 42 }, uptime: 1000, guilds: { cache: new Collection() }, users: { cache: new Collection() } },
    isButton: () => false,
    isStringSelectMenu: () => false,
    isChatInputCommand: () => true,
    isRepliable: () => true,
    replied: false,
    deferred: false,
    createdTimestamp: Date.now(),
    options: {
      getString: (name, required) => (required && !options[name] ? null : options[name] ?? null),
      getUser: () => options.usuario ?? target,
      getRole: () => options.rol ?? null,
      getInteger: () => options.numero ?? null,
      getChannel: () => channel,
    },
    reply: async (payload) => record({ ...payload, deferred: true }),
    followUp: async (payload) => record(payload),
    editReply: async (payload) => record(payload),
    deferReply: async () => { interaction.deferred = true; },
  };

  return { replies, context: { args, text: args.join(' '), isSlash: false, message, interaction, client: interaction.client, user, member, guild, channel, target, reply: async (payload) => record(payload), fail: async (payload) => record(payload), send: async (payload) => record(payload), defer: async () => {} } };
}

test('ningún comando se cae al ejecutarse de verdad', async () => {
  // Esto corre el execute() de cada comando con un contexto falso completo.
  // Antes un simple renombrado de variable (rol vs role) se colaba hasta
  // Discord porque aquí nadie ejecutaba los comandos.
  const fallos = [];

  for (const command of listCommands()) {
    // Los comandos de música y metadatos consultan servicios externos
    // (YouTube, MusicBrainz, Python); se prueban aparte para no depender de la red.
    if (command.requiresNetwork) continue;
    const { context } = makeContext({
      args: ['add', '<@961823716273176698>', 'mecos'],
      target: { id: 'u2', username: 'csr', tag: 'csr#2', toString: () => '<@961823716273176698>', displayAvatarURL: () => AVATAR },
    });
    context.command = command;
    try {
      await command.execute(context);
    } catch (error) {
      fallos.push(`${command.name}: ${error.message}`);
    }
  }

  assert.deepEqual(fallos, [], `comandos que se caen:\n${fallos.join('\n')}`);
});

test('xyb rol add @csr mecos da el rol y suelta el chiste', async () => {
  const { findCommand } = require('../src/commands');
  const command = findCommand('rol');
  const { context, replies } = makeContext({
    args: ['add', '<@961823716273176698>', 'mecos'],
    target: { id: 'u2', username: 'csr', tag: 'csr#2', toString: () => '<@961823716273176698>' },
  });

  await command.execute(context);
  assert.equal(replies.length, 1, 'debe contestar una vez');
  const texto = replies[0].embeds[0].toJSON().description;
  assert.match(texto, /jajaja te tiro los mecos puta/);
});

test('xyb rol avisa con claridad cuando falta el rol', async () => {
  const { findCommand } = require('../src/commands');
  const command = findCommand('rol');
  const { context, replies } = makeContext({
    args: ['add', '<@961823716273176698>', 'rolquenoexiste'],
    target: { id: 'u2', username: 'csr', tag: 'csr#2', toString: () => '<@961823716273176698>' },
  });

  await command.execute(context);
  const first = replies[0];
  const texto = typeof first === 'string' ? first : String(first.content ?? first.embeds?.[0]?.toJSON().description ?? '');
  assert.match(texto, /No encontré el rol/);
});

test('al quitar el rol de mecos suelta el otro chiste', async () => {
  const { findCommand } = require('../src/commands');
  const command = findCommand('rol');
  const { context, replies } = makeContext({
    args: ['remove', '<@961823716273176698>', 'mecos'],
    target: { id: 'u2', username: 'csr', tag: 'csr#2', toString: () => '<@u2>' },
  });

  await command.execute(context);
  const texto = replies[0].embeds[0].toJSON().description;
  assert.match(texto, /jajaj pendejo violado/);
  assert.equal(texto.includes('te tiro los mecos'), false, 'no es el chiste de agregarlo');
});

test('unban all saca a todo el mundo y unban <id> quita un solo ban', async () => {
  const { findCommand } = require('../src/commands');
  const command = findCommand('unban');

  assert.equal(command.esTodo(['all']), true, 'atiende "unban all"');
  assert.equal(command.esTodo(['todos']), true);
  assert.equal(command.esTodo(['123456789012345678']), false, 'un ID no es "all"');
  assert.equal(command.esTodo([]), false);
  // Se queda con el nombre para que el /unban no se registre dos veces.
  assert.equal(command.match(['123456789012345678']), true, 'el comando no se aparta nunca');

  const quitados = [];
  const guild = {
    id: 'g1',
    bans: { fetch: async () => new Collection([
      ['1', { id: '1' }],
      ['2', { id: '2' }],
      ['3', { id: '3' }],
    ]) },
    members: { unban: async (id, reason) => { quitados.push(id); void reason; } },
  };
  const { context, replies } = makeContext();
  context.guild = guild;
  context.interaction.guild = guild;
  context.args = ['all'];

  await command.execute(context);
  assert.deepEqual(quitados, ['1', '2', '3'], 'debe quitar los tres');
  const embed = replies.at(-1).embeds[0].toJSON();
  assert.match(embed.description, /\*\*3\*\* de \*\*3\*\*/);
});

test('unban <id> quita solo ese ban y deja el motivo limpio', async () => {
  const { findCommand } = require('../src/commands');
  const llamadas = [];
  const guild = {
    id: 'g1',
    bans: { fetch: async () => { throw new Error('no debe listar para un solo ID'); } },
    members: { unban: async (id, reason) => { llamadas.push([id, reason]); } },
  };
  const { context, replies } = makeContext();
  context.guild = guild;
  context.interaction.guild = guild;
  context.args = ['961823716273176698', 'spameando', 'el', 'chat'];

  await findCommand('unban').execute(context);
  assert.deepEqual(llamadas, [['961823716273176698', 'spameando el chat']]);
  assert.match(String(replies.at(-1)), /Quité el ban a <@961823716273176698>/);
});

test('unban avisa si el texto no es ni ID ni "all"', async () => {
  const { findCommand } = require('../src/commands');
  const { context, replies } = makeContext();
  context.args = ['fulanito'];

  await findCommand('unban').execute(context);
  const first = replies[0];
  const texto = typeof first === 'string' ? first : String(first.content ?? '');
  assert.match(texto, /Pon el ID de la persona baneada/);
});

test('unban all avisa cuando no hay nadie baneado', async () => {
  const { findCommand } = require('../src/commands');
  const guild = {
    id: 'g1',
    bans: { fetch: async () => new Collection() },
    members: { unban: async () => {} },
  };
  const { context, replies } = makeContext();
  context.guild = guild;
  context.interaction.guild = guild;
  context.args = ['all'];

  await findCommand('unban').execute(context);
  const first = replies[0];
  const texto = typeof first === 'string' ? first : String(first.content ?? '');
  assert.match(texto, /No hay nadie baneado/);
});

test('unban all espera el aviso si no puede consultar los baneos', async () => {
  const { findCommand } = require('../src/commands');
  const { context, replies } = makeContext();
  context.guild = {
    id: 'g1',
    bans: { fetch: async () => { throw new Error('sin permiso'); } },
    members: { unban: async () => {} },
  };
  context.args = ['all'];
  await findCommand('unban').execute(context);
  assert.match(String(replies[0]), /No pude ver la lista de baneados/);
});

test('xyb hug responde con imagen y botón de vuelta', async () => {
  const { findCommand } = require('../src/commands');
  const { context, replies } = makeContext({
    target: { id: 'u2', username: 'csr', tag: 'csr#2', toString: () => '<@961823716273176698>' },
  });

  await findCommand('hug').execute(context);
  assert.equal(replies.length, 1);
  const embed = replies[0].embeds[0].toJSON();
  assert.ok(embed.image?.url, 'debe llevar imagen');
  const boton = replies[0].components[0].toJSON().components[0];
  assert.equal(boton.custom_id, 'hug:back:u1:u2');
});

test('xyb marry manda la propuesta con aceptar y rechazar, sin casar a nadie', async () => {
  const { findCommand } = require('../src/commands');
  const marriage = require('../src/lib/marriage');
  const { context, replies } = makeContext({
    target: { id: 'u2', username: 'csr', tag: 'csr#2', toString: () => '<@961823716273176698>' },
  });

  await findCommand('marry').execute(context);
  const botones = replies[0].components[0].toJSON().components.map((b) => b.custom_id);
  assert.deepEqual(botones, ['mry:yes:u1:u2', 'mry:no:u1:u2']);
  assert.equal(marriage.getPartner('g1', 'u1'), null, 'nadie está casado hasta que acepte');
});
