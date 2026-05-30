const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

function loadBackgroundStepModule(relativePath, globalName) {
  const filePath = path.join(__dirname, '..', relativePath);
  const source = fs.readFileSync(filePath, 'utf8');
  const sandbox = { console, URL, setTimeout, clearTimeout };
  sandbox.globalThis = sandbox;
  sandbox.self = sandbox;
  vm.runInNewContext(source, sandbox, { filename: filePath });
  return sandbox[globalName];
}

test('RegisterExt checkout flow stores payment-only run fields and uses extension API paths', () => {
  const apiSource = fs.readFileSync(path.join(__dirname, '..', 'register-manager-api.js'), 'utf8');
  const runtimeSource = fs.readFileSync(path.join(__dirname, '..', 'background', 'runtime-state.js'), 'utf8');
  const createSource = fs.readFileSync(path.join(__dirname, '..', 'background', 'steps', 'create-plus-checkout.js'), 'utf8');
  const returnSource = fs.readFileSync(path.join(__dirname, '..', 'background', 'steps', 'plus-return-confirm.js'), 'utf8');

  assert.match(runtimeSource, /plusCheckoutRunId/);
  assert.match(runtimeSource, /plusCheckoutAccountId/);
  assert.match(runtimeSource, /plusCheckoutSessionId/);
  assert.match(createSource, /createPlusCheckoutRun|createRunCheckout/);
  assert.match(returnSource, /writebackPlusCheckoutStatus|writebackRunCheckoutStatus/);
  assert.doesNotMatch(apiSource, /\/api\/plus\/checkout-runs/);
  assert.doesNotMatch(createSource, /X-Plus-Checkout-Writeback-Token/);
  assert.doesNotMatch(returnSource, /X-Plus-Checkout-Writeback-Token/);
});

test('RegisterExt checkout create executor calls extension API and bypasses legacy converter', async () => {
  const module = loadBackgroundStepModule('background/steps/create-plus-checkout.js', 'MultiPageBackgroundPlusCheckoutCreate');
  const calls = [];
  const states = [];
  const completed = [];
  const tabs = [];

  const executor = module.createPlusCheckoutCreateExecutor({
    addLog: async () => {},
    chrome: { tabs: { create: async (details) => ({ id: 11, ...details }) } },
    completeNodeFromBackground: async (nodeId, payload) => completed.push({ nodeId, payload }),
    createAutomationTab: async (details) => {
      tabs.push(details);
      return { id: 42, ...details };
    },
    ensureContentScriptReadyOnTabUntilStopped: async () => {
      throw new Error('legacy checkout path should not inject content scripts');
    },
    sendTabMessageUntilStopped: async () => {
      throw new Error('legacy converter should not be called');
    },
    setState: async (payload) => states.push(payload),
    sleepWithStop: async () => {},
    waitForTabCompleteUntilStopped: async () => {},
    registerManagerApiClient: {
      createPlusCheckoutRun: async (runId, payload) => {
        calls.push({ runId, payload });
        return {
          checkout: {
            checkoutUuid: 'checkout-1',
            accountId: 7,
            status: 'created',
            paymentStatus: 'pending',
            preferredCheckoutUrl: 'https://chatgpt.com/checkout/session-1',
            checkoutSessionId: '',
            checkoutSessionIdMasked: 'sess...on-1',
            country: 'US',
            currency: 'USD',
          },
        };
      },
    },
  });

  await executor.executePlusCheckoutCreate({
    plusCheckoutRunId: 'pay-run-1',
    plusCheckoutMode: 'us_pp',
    plusCheckoutCloudConversionEnabled: true,
  });

  assert.equal(calls[0].runId, 'pay-run-1');
  assert.equal(calls[0].payload.checkoutRegion, 'us_pp');
  assert.equal(calls[0].payload.plusCheckoutMode, 'us_pp');
  assert.equal(tabs[0].url, 'https://chatgpt.com/checkout/session-1');
  assert.equal(tabs[0].active, true);
  const checkoutState = states.find((payload) => Object.prototype.hasOwnProperty.call(payload, 'plusCheckoutUuid'));
  assert.equal(checkoutState.plusCheckoutSessionId, '');
  assert.equal(checkoutState.plusCheckoutSessionIdMasked, 'sess...on-1');
  assert.equal(completed[0].nodeId, 'plus-checkout-create');
});

test('RegisterExt checkout create executor never stores masked session id as real session id', async () => {
  const module = loadBackgroundStepModule('background/steps/create-plus-checkout.js', 'MultiPageBackgroundPlusCheckoutCreate');
  const states = [];
  const executor = module.createPlusCheckoutCreateExecutor({
    addLog: async () => {},
    chrome: { tabs: { create: async (details) => ({ id: 11, ...details }) } },
    completeNodeFromBackground: async () => {},
    createAutomationTab: async (details) => ({ id: 42, ...details }),
    ensureContentScriptReadyOnTabUntilStopped: async () => {
      throw new Error('legacy checkout path should not inject content scripts');
    },
    sendTabMessageUntilStopped: async () => {
      throw new Error('legacy converter should not be called');
    },
    setState: async (payload) => states.push(payload),
    sleepWithStop: async () => {},
    waitForTabCompleteUntilStopped: async () => {},
    registerManagerApiClient: {
      createPlusCheckoutRun: async () => ({
        checkout: {
          checkoutUuid: 'checkout-1',
          preferredCheckoutUrl: 'https://chatgpt.com/checkout/session-1',
          checkoutSessionId: 'cs_***1234',
          checkoutSessionIdMasked: 'cs_***1234',
        },
      }),
    },
  });

  await executor.executePlusCheckoutCreate({ plusCheckoutRunId: 'pay-run-1' });

  const checkoutState = states.find((payload) => Object.prototype.hasOwnProperty.call(payload, 'plusCheckoutSessionId'));
  assert.equal(checkoutState.plusCheckoutSessionId, '');
  assert.equal(checkoutState.plusCheckoutSessionIdMasked, 'cs_***1234');
});

test('RegisterExt return confirm only writes success for explicit payment success URLs', async () => {
  const module = loadBackgroundStepModule('background/steps/plus-return-confirm.js', 'MultiPageBackgroundPlusReturnConfirm');
  const calls = [];
  const states = [];
  const completed = [];

  const executor = module.createPlusReturnConfirmExecutor({
    addLog: async () => {},
    completeNodeFromBackground: async (nodeId, payload) => completed.push({ nodeId, payload }),
    getTabId: async () => 42,
    isTabAlive: async () => true,
    setState: async (payload) => states.push(payload),
    sleepWithStop: async () => {},
    waitForTabUrlMatchUntilStopped: async () => ({ url: 'https://chatgpt.com/?model=gpt-4' }),
    registerManagerApiClient: {
      writebackPlusCheckoutStatus: async (runId, checkoutUuid, payload) => {
        calls.push({ runId, checkoutUuid, payload });
        return { checkout: { status: payload.status, paymentStatus: payload.paymentStatus } };
      },
    },
  });

  await executor.executePlusReturnConfirm({
    plusCheckoutRunId: 'pay-run-1',
    plusCheckoutUuid: 'checkout-1',
  });

  assert.equal(calls[0].payload.status, 'unknown');
  assert.equal(calls[0].payload.paymentStatus, 'unknown');
  assert.equal(states.some((payload) => payload.plusCodexOauthRunUuid), false);
  assert.equal(completed[0].nodeId, 'plus-checkout-return');
});
