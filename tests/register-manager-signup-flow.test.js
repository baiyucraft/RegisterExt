const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

function loadSignupFlowHelpersModule() {
  const filePath = path.join(__dirname, '..', 'background', 'signup-flow-helpers.js');
  const source = fs.readFileSync(filePath, 'utf8');
  const sandbox = { console, setTimeout, clearTimeout };
  sandbox.globalThis = sandbox;
  sandbox.self = sandbox;
  vm.runInNewContext(source, sandbox, { filename: filePath });
  return sandbox.MultiPageSignupFlowHelpers;
}

test('signup flow resolves email from claimed register-manager account', async () => {
  const module = loadSignupFlowHelpersModule();
  const apiCalls = [];
  const state = { mailProvider: 'register-manager-api', email: '' };

  const helpers = module.createSignupFlowHelpers({
    claimRegisterManagerAccount: async () => {
      apiCalls.push('claim');
      return { runId: 'run-1', account: { accountId: 7, email: 'claimed@outlook.com' } };
    },
    isRegisterManagerProvider: (candidate = {}) => candidate.mailProvider === 'register-manager-api',
    persistRegistrationEmailState: async (_state, email, options = {}) => {
      state.email = email;
      state.registerExtRunId = options.runId;
      state.registerExtAccountId = options.accountId;
    },
    isHotmailProvider: () => false,
    isLuckmailProvider: () => false,
    isGeneratedAliasProvider: () => false,
  });

  const email = await helpers.resolveSignupEmailForFlow(state);

  assert.equal(email, 'claimed@outlook.com');
  assert.equal(state.registerExtRunId, 'run-1');
  assert.equal(state.registerExtAccountId, 7);
  assert.deepEqual(apiCalls, ['claim']);
});

test('signup flow sends selected register-manager account into claim dependency', async () => {
  const module = loadSignupFlowHelpersModule();
  const state = {
    mailProvider: 'register-manager-api',
    registerExtSelectedAccountId: 232,
    registerExtSelectedEmail: 'picked@outlook.com',
    email: '',
  };
  const claimStates = [];

  const helpers = module.createSignupFlowHelpers({
    claimRegisterManagerAccount: async (claimState) => {
      claimStates.push({ ...claimState });
      return { runId: 'run-2', account: { accountId: 232, email: 'picked@outlook.com' } };
    },
    isRegisterManagerProvider: (candidate = {}) => candidate.mailProvider === 'register-manager-api',
    persistRegistrationEmailState: async (_state, email, options = {}) => {
      state.email = email;
      state.registerExtRunId = options.runId;
      state.registerExtAccountId = options.accountId;
    },
    isHotmailProvider: () => false,
    isLuckmailProvider: () => false,
    isGeneratedAliasProvider: () => false,
  });

  const email = await helpers.resolveSignupEmailForFlow(state);

  assert.equal(email, 'picked@outlook.com');
  assert.equal(claimStates[0].registerExtSelectedAccountId, 232);
  assert.equal(claimStates[0].registerExtSelectedEmail, 'picked@outlook.com');
  assert.equal(state.registerExtRunId, 'run-2');
  assert.equal(state.registerExtAccountId, 232);
});

test('background persists RegisterExt run identity when claim returns the current email', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'background.js'), 'utf8');
  const start = source.indexOf('async function persistRegistrationEmailState');
  const end = source.indexOf('async function setSignupPhoneStateSilently', start);
  assert.notEqual(start, -1);
  assert.notEqual(end, -1);
  const body = source.slice(start, end);

  assert.match(body, /const registerExtRunId = String\(options\?\.runId/);
  assert.match(body, /registerExtAccountId/);
  assert.match(body, /registerExtCompletedAt:\s*0/);
  assert.match(body, /registerExtCompletionStatus:\s*''/);
  assert.doesNotMatch(body, /normalizedEmail === currentEmail\) \{\s*return;/);
});

test('background claim passes selected register-manager account when configured', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'background.js'), 'utf8');
  const start = source.indexOf('async function claimRegisterManagerAccount');
  const end = source.indexOf('async function pollRegisterManagerRunCode', start);
  assert.notEqual(start, -1);
  assert.notEqual(end, -1);
  const body = source.slice(start, end);

  assert.match(body, /accountId:\s*normalizeRegisterExtSelectedAccountId\(state\.registerExtSelectedAccountId\)/);
  assert.match(body, /email:\s*String\(state\.registerExtSelectedEmail/);
  assert.match(body, /groupName:\s*state\.registerManagerGroupName/);
});
