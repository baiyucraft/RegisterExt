const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

function loadVerificationFlowModule() {
  const filePath = path.join(__dirname, '..', 'background', 'verification-flow.js');
  const source = fs.readFileSync(filePath, 'utf8');
  const sandbox = { console, setTimeout, clearTimeout };
  sandbox.globalThis = sandbox;
  sandbox.self = sandbox;
  vm.runInNewContext(source, sandbox, { filename: filePath });
  return sandbox.MultiPageBackgroundVerificationFlow;
}

test('signup code polling uses register-manager run code API', async () => {
  const module = loadVerificationFlowModule();
  const requests = [];
  const helpers = module.createVerificationFlowHelpers({
    pollRegisterManagerRunCode: async (runId, payload) => {
      requests.push({ runId, payload });
      return { ok: true, code: '654321', selectionSource: 'pattern' };
    },
    isRegisterManagerProvider: (mail = {}) => mail.provider === 'register-manager-api',
    getHotmailVerificationRequestTimestamp: () => 1700000000000,
    getHotmailVerificationPollConfig: () => ({}),
    isStopError: () => false,
    throwIfStopped: () => {},
    sleepWithStop: async () => {},
    VERIFICATION_POLL_MAX_ROUNDS: 1,
  });
  const state = { mailProvider: 'register-manager-api', registerExtRunId: 'run-1', email: 'claimed@outlook.com' };

  const result = await helpers.pollFreshVerificationCode(
    4,
    state,
    { provider: 'register-manager-api', label: 'register-manager API' },
    {
      senderFilters: ['openai.com'],
      excludeCodes: ['111111'],
      filterAfterTimestamp: 1700000000000,
    },
  );

  assert.equal(result.code, '654321');
  assert.equal(requests[0].runId, 'run-1');
  assert.equal(requests[0].payload.senderFilters[0], 'openai.com');
  assert.deepEqual(requests[0].payload.excludeCodes, ['111111']);
});
