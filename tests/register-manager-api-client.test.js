const assert = require('node:assert/strict');
const test = require('node:test');

const { createRegisterManagerApiClient } = require('../register-manager-api.js');
const { DEFAULT_REGISTER_MANAGER_API_BASE_URL } = require('../register-manager-api.js');

function jsonResponse(payload, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    async json() {
      return payload;
    },
  };
}

test('RegisterExt API client calls register-manager endpoints only', async () => {
  const calls = [];
  const client = createRegisterManagerApiClient({
    baseUrl: 'http://127.0.0.1:1455/api/extension/RegisterExt/',
    fetchImpl: async (url, options = {}) => {
      calls.push({ url, options });
      return jsonResponse({ ok: true, runId: 'run-1', items: [], capabilities: [] });
    },
  });

  await client.health();
  await client.listCandidates({ page: 1, pageSize: 10, q: 'a', groupName: 'seed-a' });
  await client.claimAccount({ accountId: 1 });
  await client.getRunCode('run-1', { excludeCodes: ['123456'] });
  await client.completeRun('run-1', { status: 'success', gptPassword: 'secret' });

  assert.equal(calls[0].url, 'http://192.168.31.199:1456/api/extension/RegisterExt/health');
  assert.deepEqual(calls.map((call) => new URL(call.url).pathname), [
    '/api/extension/RegisterExt/health',
    '/api/extension/RegisterExt/accounts/candidates',
    '/api/extension/RegisterExt/accounts/claim',
    '/api/extension/RegisterExt/runs/run-1/code',
    '/api/extension/RegisterExt/runs/run-1/complete',
  ]);
  assert.equal(
    calls.some((call) => {
      const pathname = new URL(call.url).pathname;
      return pathname === '/messages' || pathname === '/code' || pathname.endsWith('/save-auth-json');
    }),
    false,
  );
  const candidatesUrl = new URL(calls[1].url);
  assert.equal(candidatesUrl.searchParams.get('groupName'), 'seed-a');
});

test('RegisterExt API client ignores legacy local base URLs', async () => {
  for (const baseUrl of [
    '',
    'http://127.0.0.1:1455/api/extension/RegisterExt',
    'http://127.0.0.1:1455/api/extension/RegisterExt/',
    'http://localhost:1455/api/extension/RegisterExt',
    'http://127.0.0.1:1456/api/extension/RegisterExt',
    'http://localhost:1456/api/extension/RegisterExt',
    'https://example.invalid/api/extension/RegisterExt',
  ]) {
    const calls = [];
    const client = createRegisterManagerApiClient({
      baseUrl,
      fetchImpl: async (url, options = {}) => {
        calls.push({ url, options });
        return jsonResponse({ ok: true, capabilities: [] });
      },
    });

    await client.health();
    assert.equal(calls[0].url, 'http://192.168.31.199:1456/api/extension/RegisterExt/health');
  }
});

test('RegisterExt API client defaults to deployed register-manager entrypoint', async () => {
  const calls = [];
  const client = createRegisterManagerApiClient({
    fetchImpl: async (url, options = {}) => {
      calls.push({ url, options });
      return jsonResponse({ ok: true, capabilities: [] });
    },
  });

  await client.health();

  assert.equal(DEFAULT_REGISTER_MANAGER_API_BASE_URL, 'http://192.168.31.199:1456/api/extension/RegisterExt');
  assert.equal(calls[0].url, 'http://192.168.31.199:1456/api/extension/RegisterExt/health');
});
