const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

function loadRuntimeStateModule() {
  const filePath = path.join(__dirname, '..', 'background', 'runtime-state.js');
  const source = fs.readFileSync(filePath, 'utf8');
  const sandbox = { console };
  sandbox.globalThis = sandbox;
  sandbox.self = sandbox;
  vm.runInNewContext(source, sandbox, { filename: filePath });
  return sandbox.MultiPageBackgroundRuntimeState;
}

test('registration terminal states complete register-manager run', async () => {
  const module = loadRuntimeStateModule();
  const helpers = module.createRuntimeStateHelpers();
  const completions = [];
  const completeRun = async (runId, payload) => completions.push({ runId, payload });
  const state = { mailProvider: 'register-manager-api', registerExtRunId: 'run-1', password: 'gpt-secret' };

  await helpers.completeRegisterManagerRegistrationRun(state, { status: 'success' }, { completeRun });
  await helpers.completeRegisterManagerRegistrationRun(state, { status: 'failed', reason: 'masked' }, { completeRun });
  await helpers.completeRegisterManagerRegistrationRun(state, { status: 'stopped', reason: 'user stopped' }, { completeRun });

  assert.deepEqual(completions.map((item) => item.payload.status), ['success', 'failed', 'stopped']);
  assert.equal(completions[0].payload.gptPassword, 'gpt-secret');
  assert.equal(completions.some((item) => item.payload.accessToken || item.payload.refreshToken || item.payload.sub2api), false);
});

test('completed register-manager run is not completed twice by helper', async () => {
  const module = loadRuntimeStateModule();
  const helpers = module.createRuntimeStateHelpers();
  let completed = false;

  await helpers.completeRegisterManagerRegistrationRun(
    { mailProvider: 'register-manager-api', registerExtRunId: 'run-1', registerExtCompletedAt: Date.now(), password: 'secret' },
    { status: 'success' },
    { completeRun: async () => { completed = true; } },
  );

  assert.equal(completed, false);
});

test('background terminal paths call RegisterExt complete bridge', () => {
  const backgroundPath = path.join(__dirname, '..', 'background.js');
  const source = fs.readFileSync(backgroundPath, 'utf8');

  const completeNodeStart = source.indexOf('async function completeNodeFromBackground');
  const failNodeStart = source.indexOf('async function failNodeFromBackground');
  const requestStopStart = source.indexOf('async function requestStop');
  assert.notEqual(completeNodeStart, -1);
  assert.notEqual(failNodeStart, -1);
  assert.notEqual(requestStopStart, -1);

  const completeNodeBody = source.slice(completeNodeStart, failNodeStart);
  const failNodeBody = source.slice(failNodeStart, source.indexOf('async function appendManualAccountRunRecordIfNeeded'));
  const requestStopBody = source.slice(requestStopStart, source.indexOf('// ============================================================', requestStopStart));

  assert.match(completeNodeBody, /normalizedNodeId === 'wait-registration-success'[\s\S]*completeRegisterManagerRunForState\(latestState,\s*\{\s*status:\s*'success'/);
  assert.match(completeNodeBody, /stopRequested[\s\S]*completeRegisterManagerRunForState\(stoppedState,[\s\S]*status:\s*'stopped'/);
  assert.match(failNodeBody, /completeRegisterManagerRunForState\(latestState,[\s\S]*status:\s*'failed'/);
  assert.match(failNodeBody, /completeRegisterManagerRunForState\(stoppedState,[\s\S]*status:\s*'stopped'/);
  assert.match(requestStopBody, /completeRegisterManagerRunForState\(state,[\s\S]*status:\s*'stopped'/);
  assert.match(source, /isRegisterManagerRunAlreadyCompletedError[\s\S]*RUN_ALREADY_COMPLETED/);
});
