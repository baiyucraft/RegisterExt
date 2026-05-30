const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

function read(relativePath) {
  return fs.readFileSync(path.join(__dirname, '..', relativePath), 'utf8');
}

function loadStepDefinitions() {
  const definitionsPath = path.join(__dirname, '..', 'data', 'step-definitions.js');
  delete require.cache[require.resolve(definitionsPath)];
  require(definitionsPath);
  return globalThis.MultiPageStepDefinitions;
}

test('RegisterExt task mode UI exposes register-only, register-then-pay, and pay-seeded modes', () => {
  const html = read('sidepanel/sidepanel.html');
  const sidepanel = read('sidepanel/sidepanel.js');

  assert.match(html, /id="row-register-ext-task-mode"/);
  assert.match(html, /value="register_only"[\s\S]*只注册/);
  assert.match(html, /value="register_then_pay"[\s\S]*注册后支付/);
  assert.match(html, /value="pay_seeded"[\s\S]*仅支付已有账号/);
  assert.match(html, /id="row-register-manager-account"/);
  assert.match(html, /id="row-plus-checkout-account"/);
  assert.match(html, /id="select-plus-checkout-account"/);
  assert.match(html, /id="btn-refresh-plus-checkout-accounts"/);

  assert.match(sidepanel, /REGISTER_EXT_TASK_MODE_REGISTER_ONLY/);
  assert.match(sidepanel, /REGISTER_EXT_TASK_MODE_REGISTER_THEN_PAY/);
  assert.match(sidepanel, /REGISTER_EXT_TASK_MODE_PAY_SEEDED/);
  assert.match(sidepanel, /function getSelectedRegisterExtTaskMode/);
  assert.match(sidepanel, /function getEffectivePlusModeEnabled/);
  assert.match(sidepanel, /function syncSegmentedRadioVisualState/);
  assert.match(sidepanel, /function syncPlusCheckoutModeVisualState/);
  assert.match(sidepanel, /function syncRegisterExtTaskModeVisualState/);
  assert.doesNotMatch(sidepanel, /plusModeEnabled:\s*getFixedPlusModeEnabled\(\)/);
});

test('RegisterExt task and checkout mode switches refresh their active visual state', () => {
  const css = read('sidepanel/sidepanel.css');
  const sidepanel = read('sidepanel/sidepanel.js');

  assert.match(css, /\.plus-checkout-mode-option\.is-active span/);
  assert.match(sidepanel, /const plusCheckoutModeInputs = \[inputPlusCheckoutModeUs, inputPlusCheckoutModeJp\]\.filter\(Boolean\);/);
  assert.match(sidepanel, /plusCheckoutModeInputs\.forEach\(\(input\) => \{[\s\S]*?syncPlusCheckoutModeVisualState\(\);[\s\S]*?handlePlusCheckoutModeSelectionChange\(input\.value\);/);
  assert.match(sidepanel, /registerExtTaskModeInputs\.forEach\(\(input\) => \{[\s\S]*?updateRegisterExtTaskModeUI\(\);[\s\S]*?updatePlusModeUI\(\);[\s\S]*?syncRegisterExtTaskModeVisualState\(\);/);
  assert.match(sidepanel, /function updateRegisterExtTaskModeUI\(\) \{[\s\S]*?syncRegisterExtTaskModeVisualState\(\);/);
  assert.match(sidepanel, /function applyPlusCheckoutProfileToInputs[\s\S]*?syncPlusCheckoutModeVisualState\(\);/);
});

test('RegisterExt task modes choose distinct workflow nodes', () => {
  const definitions = loadStepDefinitions();

  const registerOnly = definitions.getNodes({
    registerExtTaskMode: 'register_only',
    plusModeEnabled: true,
  }).map((node) => node.nodeId);
  assert.deepEqual(registerOnly.slice(0, 6), [
    'open-chatgpt',
    'submit-signup-email',
    'fill-password',
    'fetch-signup-code',
    'fill-profile',
    'wait-registration-success',
  ]);
  assert.equal(registerOnly.includes('plus-checkout-create'), false);
  assert.equal(registerOnly.includes('paypal-approve'), false);

  const registerThenPay = definitions.getNodes({
    registerExtTaskMode: 'register_then_pay',
    plusModeEnabled: false,
    plusPaymentMethod: 'paypal',
  }).map((node) => node.nodeId);
  assert.ok(registerThenPay.includes('wait-registration-success'));
  assert.ok(registerThenPay.includes('plus-checkout-create'));
  assert.ok(registerThenPay.indexOf('wait-registration-success') < registerThenPay.indexOf('plus-checkout-create'));

  const paySeeded = definitions.getNodes({
    registerExtTaskMode: 'pay_seeded',
    plusModeEnabled: true,
    plusPaymentMethod: 'paypal',
  }).map((node) => node.nodeId);
  assert.deepEqual(paySeeded.slice(0, 4), [
    'plus-checkout-create',
    'plus-checkout-billing',
    'paypal-approve',
    'plus-checkout-return',
  ]);
  for (const registrationNode of ['open-chatgpt', 'submit-signup-email', 'fill-password', 'fetch-signup-code', 'fill-profile', 'wait-registration-success']) {
    assert.equal(paySeeded.includes(registrationNode), false);
  }
});

test('RegisterExt pay-seeded startup claims Plus checkout account and avoids registration completion', () => {
  const background = read('background.js');
  const autoRunController = read('background/auto-run-controller.js');
  const createCheckout = read('background/steps/create-plus-checkout.js');

  assert.match(background, /function isRegisterExtPaySeededMode/);
  assert.match(background, /async function claimRegisterManagerPlusCheckoutAccount/);
  assert.match(background, /client\.claimPlusCheckoutAccount\(/);
  assert.match(background, /plusCheckoutRunId/);
  assert.match(background, /plusCheckoutAccountId/);
  assert.match(background, /registerExtRunId:\s*''/);
  assert.match(background, /registerExtAccountId:\s*null/);
  assert.match(background, /if \(!isRegisterManagerProvider\(state\) \|\| !state\?\.registerExtRunId \|\| isRegisterExtPaySeededMode\(state\)\)/);
  assert.match(autoRunController, /registerExtTaskMode:\s*prevState\.registerExtTaskMode/);
  assert.match(createCheckout, /registerExtCompletionStatus[\s\S]*success/);
  const ensureMatches = background.match(/async function ensureAutoEmailReady/g) || [];
  assert.equal(ensureMatches.length, 1);
});
