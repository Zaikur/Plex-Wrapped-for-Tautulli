import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtemp, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { once } from 'node:events';

const account = (id, username) => ({ id, username, title: username, thumb: '', email: '' });

async function start(t, config, accounts) {
  const data = await mkdtemp(path.join(tmpdir(), 'pwft-auth-'));
  await writeFile(path.join(data, 'config.json'), JSON.stringify(config));
  const portFinder = createServer();
  portFinder.listen(0, '127.0.0.1');
  await once(portFinder, 'listening');
  const port = portFinder.address().port;
  await new Promise(resolve => portFinder.close(resolve));
  const child = spawn(process.execPath, ['--require', './tests/fixtures/plex-services.cjs', 'dist-server/server.cjs'], {
    env: { ...process.env, DATA_DIR: data, PORT: String(port), TEST_PLEX_ACCOUNTS: JSON.stringify(accounts) },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let log = '';
  child.stdout.on('data', chunk => { log += chunk; });
  child.stderr.on('data', chunk => { log += chunk; });
  t.after(async () => {
    if (child.exitCode === null) {
      const exited = once(child, 'exit');
      child.kill();
      await exited;
    }
    await rm(data, { recursive: true, force: true });
  });
  const base = `http://127.0.0.1:${port}`;
  for (let i = 0; ; i++) {
    try { if ((await fetch(`${base}/api/session`)).ok) break; } catch { /* wait for startup */ }
    assert.ok(i < 100 && child.exitCode === null, `Server failed to start: ${log}`);
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  const request = async (route, cookie = '', method = 'GET', body) => {
    const response = await fetch(`${base}/api${route}`, {
      method, headers: { Cookie: cookie, 'Content-Type': 'application/json' },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    return { status: response.status, body: await response.json(), cookies: response.headers.getSetCookie() };
  };
  const login = async () => {
    const pin = await request('/auth/plex/pin', '', 'POST', {});
    assert.equal(pin.status, 200);
    assert.equal((await request(`/auth/plex/pin/${pin.body.id}`)).status, 403);
    const cookie = pin.cookies.find(c => c.startsWith('pwft_pin=')).split(';')[0];
    const result = await request(`/auth/plex/pin/${pin.body.id}`, cookie);
    return { ...result, cookie: result.cookies.find(c => c.startsWith('pwft_session='))?.split(';')[0] };
  };
  return { request, login, readConfig: async () => JSON.parse(await readFile(path.join(data, 'config.json'), 'utf8')) };
}

test('first Plex login claims admin before Tautulli is configured; passwords cannot bypass it', async t => {
  const app = await start(t, {}, [account(1, 'Owner'), account(2, 'Stranger')]);
  assert.equal((await app.request('/admin/setup', '', 'POST', { password: 'password' })).status, 401);
  assert.equal((await app.request('/admin/config')).status, 401);
  const owner = await app.login();
  assert.equal(owner.status, 200);
  const session = await app.request('/session', owner.cookie);
  assert.equal(session.body.isAdmin, true);
  assert.equal(session.body.canViewAnyone, true);
  assert.equal((await app.request('/admin/config', owner.cookie)).status, 200);
  assert.equal((await app.readConfig()).plexAuth.adminPlexUserId, 1);
  assert.equal((await app.login()).status, 403);
});

test('migrates admin and overrides; viewers remain restricted even when they own the Plex server', async t => {
  const app = await start(t, {
    plexAuth: {
      adminPlexUsername: 'Owner', clientIdentifier: 'legacy-client',
      userMappingOverrides: [{ plexUsername: 'PlexBob', tautulliUserId: 102 }],
    },
    tautulli: { url: 'http://tautulli.test', apiKey: 'test-key' },
    adminSettings: { allowAllUsers: true, accessMode: 'regular', enableGeolocation: true },
  }, [account(2, 'ALICE'), account(3, 'PlexBob'), account(1, 'owner'), account(4, 'Stranger'), account(3, 'PlexBob')]);
  const alice = await app.login();
  assert.equal(alice.status, 200);
  const session = (await app.request('/session', alice.cookie)).body;
  assert.equal(session.viewer.userId, 101);
  assert.equal(session.isAdmin, false);
  assert.equal(session.canViewAnyone, false);
  assert.equal((await app.request('/users', alice.cookie)).status, 403);
  assert.equal((await app.request('/admin/config', alice.cookie)).status, 401);
  assert.equal((await app.request('/report?user=all&period=2025', alice.cookie)).status, 403);
  assert.equal((await app.request('/report?user=102&period=2025', alice.cookie)).status, 403);
  assert.equal((await app.request('/report?user=me&period=2025', alice.cookie)).status, 200);
  assert.equal((await app.request('/report/locations?user=102&period=2025', alice.cookie)).status, 403);
  const bob = await app.login();
  assert.equal(bob.status, 200);
  assert.equal((await app.request('/session', bob.cookie)).body.viewer.userId, 102);
  const owner = await app.login();
  assert.equal((await app.request('/session', owner.cookie)).body.isAdmin, true);
  const migrated = await app.readConfig();
  assert.equal(migrated.plexClientId, 'legacy-client');
  assert.equal(migrated.plexAuth.adminPlexUserId, 1);
  assert.equal(migrated.plexAuth.userMappingOverrides[0].tautulliUserId, 102);
  assert.equal(migrated.adminSettings.accessMode, 'plex');
  assert.equal(migrated.adminSettings.allowAllUsers, false);
  assert.equal((await app.login()).status, 403);
  const saved = await app.request('/admin/user-mappings', owner.cookie, 'PUT', [{ plexUsername: 'PlexBob', tautulliUserId: 101 }]);
  assert.equal(saved.status, 200);
  assert.equal((await app.request('/session', bob.cookie)).body.viewer, null);
  const newAdminCookie = saved.cookies.find(c => c.startsWith('pwft_session=')).split(';')[0];
  assert.equal((await app.request('/session', newAdminCookie)).body.isAdmin, true);
  const remapped = await app.login();
  assert.equal((await app.request('/session', remapped.cookie)).body.viewer.userId, 101);
});
