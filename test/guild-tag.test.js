const { test } = require('node:test');
const assert = require('node:assert/strict');
const { classify, isServerBooster, createMonitor, listMembers, HOUR, WARNING_GRACE } = require('../src/lib/guild-tag');
const GUILD = '1494581763899396136';
const OWNER = '1452515467645292584';
const USER = '111111111111111111';
const CHANNEL = '333333333333333333';
const valid = id => ({ id, primary_guild: { identity_enabled: true, identity_guild_id: GUILD, tag: 'xyb' } });
const missing = id => ({ id, primary_guild: null });

test('recognizes server boosters from the Guild Member payload', () => {
  assert.equal(isServerBooster({ premium_since: '2026-10-18T00:00:00.000Z' }), true);
  assert.equal(isServerBooster({ premiumSince: new Date() }), true);
  assert.equal(isServerBooster({ premiumSinceTimestamp: 123 }), true);
  assert.equal(isServerBooster({ premium_since: null }), false);
  assert.equal(isServerBooster({}), false);
});

test('checks exact guild identity and visibility, never names or missing data', () => {
  assert.equal(classify(valid(USER), GUILD), 'valid');
  assert.equal(classify({ primary_guild: { identity_enabled: true, identity_guild_id: USER, tag: 'xyb' } }, GUILD), 'missing');
  assert.equal(classify({ primary_guild: { identity_enabled: false, identity_guild_id: GUILD } }, GUILD), 'missing');
  assert.equal(classify(missing(USER), GUILD), 'missing');
  for (const value of [{}, null, { primary_guild: {} }, { primary_guild: { identity_enabled: null } }, { primary_guild: { identity_enabled: true } }]) {
    assert.equal(classify(value, GUILD), 'unknown');
  }
});

function fixture() {
  let time = 0;
  let reads = 0;
  const f = { bans: [], warnings: [], user: missing(USER), features: ['GUILD_TAGS'], bannable: true, fail: false, restoreAt: Infinity, sendFail: false, channelGuildId: GUILD, booster: false };
  const member = { id: USER, user: { bot: false }, get bannable() { return f.bannable; }, ban: async options => f.bans.push(options) };
  const guild = { ownerId: OWNER, roles: { fetch: async () => {} }, members: { fetchMe: async () => {}, fetch: async () => member } };
  f.client = {
    channels: { fetch: async () => ({ guildId: f.channelGuildId, isTextBased: () => true, send: async payload => {
      if (f.sendFail) throw new Error('Missing Access');
      f.warnings.push(payload);
    } }) },
    guilds: { fetch: async () => guild },
    rest: { get: async route => {
      if (f.fail) throw new Error('HTTP 503');
      if (route === `/guilds/${GUILD}`) return { owner_id: OWNER, features: f.features };
      if (route === `/guilds/${GUILD}/members/${USER}`) return { user: f.memberUser ?? f.user };
      if (route.endsWith('/members')) return [{ user: valid(OWNER) }, { user: f.user, ...(f.booster ? { premium_since: '2026-10-18T00:00:00.000Z' } : {}) }, { user: { id: '222222222222222222', bot: true } }];
      if (route === `/users/${OWNER}`) return valid(OWNER);
      if (route === `/users/${USER}`) return ++reads >= f.restoreAt ? valid(USER) : f.user;
      throw new Error(`Unexpected route ${route}`);
    } },
  };
  f.monitor = createMonitor(f.client, { guildId: GUILD, warningChannelId: CHANNEL, now: () => time, log: { info() {}, warn() {} } });
  f.advance = (ms = HOUR) => { time += ms; };
  return f;
}

test('requires an hour of evidence; preserves messages and exempts bots/owner', async () => {
  const f = fixture();
  assert.equal((await f.monitor.scan({ auditOnly: true })).exempt, 2);
  await f.monitor.scan();
  assert.equal(f.bans.length, 0);
  f.advance();
  await f.monitor.scan();
  assert.equal(f.bans.length, 0);
  assert.equal(f.warnings.length, 1);
  assert.deepEqual(f.warnings[0].allowedMentions, { parse: [], users: [USER] });
  f.advance(WARNING_GRACE - 1);
  await f.monitor.checkDue();
  assert.equal(f.bans.length, 0);
  f.advance(1);
  await f.monitor.checkDue();
  assert.equal(f.bans.length, 1);
  assert.equal(f.bans[0].deleteMessageSeconds, 0);
});

test('restoring tag immediately before ban prevents action', async () => {
  const f = fixture();
  await f.monitor.scan();
  f.advance();
  await f.monitor.scan();
  assert.equal(f.warnings.length, 1);
  f.advance(WARNING_GRACE);
  f.restoreAt = 5;
  await f.monitor.checkDue();
  assert.equal(f.bans.length, 0);
});

test('explicit one-person live test warns immediately but still waits full 20 minutes', async () => {
  const f = fixture();
  await f.monitor.scan({ auditOnly: true });
  await f.monitor.scan({ testUserId: USER });
  assert.equal(f.warnings.length, 1);
  assert.equal(f.bans.length, 0);
  f.advance(WARNING_GRACE - 1); await f.monitor.checkDue();
  assert.equal(f.bans.length, 0);
  f.advance(1); await f.monitor.checkDue();
  assert.equal(f.bans.length, 1);
});

test('server booster is exempt from warning and ban', async () => {
  const f = fixture();
  f.booster = true;
  const report = await f.monitor.scan({ testUserId: USER });
  assert.equal(f.warnings.length, 0);
  assert.equal(f.bans.length, 0);
  assert.equal(report.exempt, 3);
});

test('live test for another ID does not warn the candidate', async () => {
  const f = fixture();
  await f.monitor.scan({ testUserId: OWNER });
  assert.equal(f.warnings.length, 0);
  assert.equal(f.bans.length, 0);
});

for (const scenario of ['send-failure', 'wrong-channel', 'bot']) {
  test(`no warning or ban on ${scenario}`, async () => {
    const f = fixture();
    await f.monitor.scan();
    f.advance();
    if (scenario === 'send-failure') f.sendFail = true;
    if (scenario === 'wrong-channel') f.channelGuildId = USER;
    if (scenario === 'bot') f.user = { ...missing(USER), bot: true };
    await f.monitor.scan();
    f.advance(WARNING_GRACE);
    await f.monitor.checkDue();
    assert.equal(f.warnings.length, 0);
    assert.equal(f.bans.length, 0);
  });
}

test('successful warning is not repeated and restored tag cancels deadline', async () => {
  const f = fixture();
  await f.monitor.scan(); f.advance(); await f.monitor.scan();
  await f.monitor.scan();
  assert.equal(f.warnings.length, 1);
  f.user = valid(USER);
  f.advance(WARNING_GRACE);
  await f.monitor.checkDue();
  assert.equal(f.bans.length, 0);
  f.user = missing(USER);
  f.advance(); await f.monitor.scan();
  assert.equal(f.warnings.length, 1);
  assert.equal(f.bans.length, 0);
});

test('audit mode never warns or bans even with mature evidence', async () => {
  const f = fixture();
  await f.monitor.scan({ auditOnly: true });
  f.advance(); await f.monitor.scan({ auditOnly: true });
  assert.equal(f.warnings.length, 0);
  assert.equal(f.bans.length, 0);
});

for (const scenario of ['unknown', 'permission', 'feature', 'http', 'correct']) {
  test(`no bans on ${scenario}`, async () => {
    const f = fixture();
    await f.monitor.scan();
    f.advance();
    if (scenario === 'unknown') f.user = { id: USER };
    if (scenario === 'permission') f.bannable = false;
    if (scenario === 'feature') f.features = [];
    if (scenario === 'http') f.fail = true;
    if (scenario === 'correct') f.user = valid(USER);
    await f.monitor.scan();
    assert.equal(f.bans.length, 0);
  });
}

test('HTTP failure clears previous evidence', async () => {
  const f = fixture();
  await f.monitor.scan();
  f.advance(); f.fail = true;
  await f.monitor.scan();
  f.advance(); f.fail = false;
  await f.monitor.scan();
  assert.equal(f.bans.length, 0);
});

test('valid tag in member endpoint prevents ban despite empty user endpoint', async () => {
  const f = fixture();
  await f.monitor.scan(); f.advance(); await f.monitor.scan();
  assert.equal(f.warnings.length, 1);
  f.memberUser = valid(USER);
  f.advance(WARNING_GRACE);
  await f.monitor.checkDue();
  assert.equal(f.bans.length, 0);
});

test('Aaronchasd real profile belongs to Xyb and is classified valid', () => {
  assert.equal(classify({ id: '961823716273176698', primary_guild: {
    identity_guild_id: GUILD, identity_enabled: true, tag: 'xyb',
    badge: 'e08bd1473bf781ca021c4dbf74bff1bf',
  } }, GUILD), 'valid');
});

test('member enumeration paginates beyond 1000', async () => {
  let calls = 0;
  const rest = { get: async (route, options) => {
    calls++;
    if (calls === 1) return Array.from({ length: 1000 }, (_, i) => ({ user: { id: String(1000 + i) } }));
    assert.equal(options.query.get('after'), '1999');
    return [{ user: { id: '2000' } }];
  } };
  assert.equal((await listMembers(rest, GUILD)).length, 1001);
});

test('overlapping scans are skipped', async () => {
  const f = fixture();
  const first = f.monitor.scan();
  assert.deepEqual(await f.monitor.scan(), { skipped: 'scan-running' });
  await first;
});
