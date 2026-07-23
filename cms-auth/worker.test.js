import test from 'node:test';
import assert from 'node:assert/strict';
import worker from './worker.js';

const env = {
  GITHUB_CLIENT_ID: 'test-client-id',
  GITHUB_CLIENT_SECRET: 'test-client-secret',
  STATE_SECRET: 'test-state-secret-with-at-least-32-characters',
  ALLOWED_SITE_IDS: 'logancome.github.io',
};

test('health endpoint is available without secrets', async () => {
  const response = await worker.fetch(new Request('https://auth.example/health'), {});
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { ok: true, service: 'robai-cms-auth' });
});

test('authorization only accepts the configured site', async () => {
  const request = new Request('https://auth.example/auth?provider=github&site_id=attacker.example');
  const response = await worker.fetch(request, env);
  assert.equal(response.status, 403);
});

test('authorization redirects an allowed site to GitHub with constrained scope', async () => {
  const request = new Request('https://auth.example/auth?provider=github&site_id=logancome.github.io&scope=repo');
  const response = await worker.fetch(request, env);
  const destination = new URL(response.headers.get('location'));
  assert.equal(response.status, 302);
  assert.equal(destination.origin + destination.pathname, 'https://github.com/login/oauth/authorize');
  assert.equal(destination.searchParams.get('client_id'), env.GITHUB_CLIENT_ID);
  assert.equal(destination.searchParams.get('scope'), 'public_repo');
  assert.ok(destination.searchParams.get('state'));
});

test('callback rejects unsigned OAuth state', async () => {
  const request = new Request('https://auth.example/callback?code=fake&state=invalid.invalid');
  const response = await worker.fetch(request, env);
  assert.equal(response.status, 400);
  assert.match(await response.text(), /登录状态已失效/);
});
