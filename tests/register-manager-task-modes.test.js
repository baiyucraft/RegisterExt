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
  assert.ok(
    html.indexOf('id="row-register-ext-task-mode"') < html.indexOf('id="row-plus-mode"'),
    'task mode tabs should be the first workflow control'
  );
  assert.ok(
    html.indexOf('id="row-register-ext-task-mode"') < html.indexOf('id="row-mail-provider"'),
    'task mode tabs should appear before mail settings'
  );
  assert.match(html, /class="task-mode-tabs"[\s\S]*role="radiogroup"[\s\S]*aria-label="RegisterExt 任务模式"/);
  assert.match(html, /value="register_only"[\s\S]*<span>注册<\/span>/);
  assert.match(html, /value="pay_seeded"[\s\S]*<span>支付<\/span>/);
  assert.match(html, /value="register_then_pay"[\s\S]*<span>注册后支付<\/span>/);
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

test('RegisterExt task tabs drive final settings panel visibility matrix', () => {
  const css = read('sidepanel/sidepanel.css');
  const sidepanel = read('sidepanel/sidepanel.js');

  assert.match(css, /\.task-mode-tabs/);
  assert.match(css, /\.task-mode-tab\.is-active span/);
  assert.match(sidepanel, /const rowMailProvider = document\.getElementById\('row-mail-provider'\);/);
  assert.match(sidepanel, /const rowRegisterManagerGroupName = document\.getElementById\('row-register-manager-group-name'\);/);
  assert.match(
    sidepanel,
    /function updateRegisterExtTaskModeUI\(modeValue\) \{[\s\S]*?const mode = normalizeRegisterExtTaskMode\(modeValue \|\| getSelectedRegisterExtTaskMode\(latestState\)\);[\s\S]*?setRegisterExtTaskModeInputs\(mode\);[\s\S]*?rowMailProvider\.style\.display = usesRegistration \? '' : 'none';[\s\S]*?rowRegisterManagerGroupName\.style\.display = '';[\s\S]*?rowRegisterManagerAccountPicker\.style\.display = usesRegistration \? '' : 'none';[\s\S]*?rowPlusCheckoutAccount\.style\.display = usesSeededPaymentAccount \? '' : 'none';/
  );
  assert.match(
    sidepanel,
    /function updatePlusModeUI\(options = \{\}\) \{[\s\S]*?const taskMode = normalizeRegisterExtTaskMode\(options\.registerExtTaskMode \|\| getSelectedRegisterExtTaskMode\(latestState\)\);[\s\S]*?registerExtTaskMode: taskMode,[\s\S]*?rowPlusMode\.style\.display = enabled \? '' : 'none';[\s\S]*?plusCheckoutModeSwitchGroup\.style\.display = checkoutModeSwitchVisible \? '' : 'none';/
  );
  assert.match(
    sidepanel,
    /rowHostedCheckoutSmsPool[\s\S]*?rowHostedCheckoutResendSettings[\s\S]*?row\.style\.display = enabled && selectedMethod === paypalValue \? '' : 'none';/
  );
});

test('RegisterExt task and checkout mode switches refresh their active visual state', () => {
  const css = read('sidepanel/sidepanel.css');
  const sidepanel = read('sidepanel/sidepanel.js');

  assert.match(css, /\.plus-checkout-mode-option\.is-active span/);
  assert.match(sidepanel, /const plusCheckoutModeInputs = \[inputPlusCheckoutModeUs, inputPlusCheckoutModeJp\]\.filter\(Boolean\);/);
  assert.match(sidepanel, /plusCheckoutModeInputs\.forEach\(\(input\) => \{[\s\S]*?syncPlusCheckoutModeVisualState\(\);[\s\S]*?handlePlusCheckoutModeSelectionChange\(input\.value\);/);
  assert.match(sidepanel, /async function handleRegisterExtTaskModeSelectionChange\(modeValue\) \{[\s\S]*?setRegisterExtTaskModeInputs\(mode\);[\s\S]*?updateRegisterExtTaskModeUI\(mode\);[\s\S]*?updatePlusModeUI\(\{ registerExtTaskMode: mode \}\);/);
  assert.match(sidepanel, /registerExtTaskModeInputs\.forEach\(\(input\) => \{[\s\S]*?input\.addEventListener\('change', async \(\) => \{[\s\S]*?if \(!input\.checked\) \{[\s\S]*?return;[\s\S]*?await handleRegisterExtTaskModeSelectionChange\(input\.value\);/);
  assert.match(sidepanel, /function setRegisterExtTaskModeInputs\(modeValue\) \{[\s\S]*?input\.checked = input\.value === mode;[\s\S]*?syncRegisterExtTaskModeVisualState\(\);/);
  assert.match(sidepanel, /function applyPlusCheckoutProfileToInputs[\s\S]*?syncPlusCheckoutModeVisualState\(\);/);
});

test('RegisterExt task tab label clicks have a single fallback handler', () => {
  const sidepanel = read('sidepanel/sidepanel.js');

  assert.match(sidepanel, /let registerExtTaskModeSelectionInFlight = false;/);
  assert.match(
    sidepanel,
    /document\.querySelectorAll\('#row-register-ext-task-mode label\[for\]'\)\.forEach\(\(label\) => \{[\s\S]*?label\.addEventListener\('click', async \(event\) => \{[\s\S]*?const wasChecked = Boolean\(input\.checked\);[\s\S]*?if \(!wasChecked\) \{[\s\S]*?event\.preventDefault\(\);[\s\S]*?await handleRegisterExtTaskModeSelectionChange\(input\.value\);/
  );
  assert.match(
    sidepanel,
    /async function handleRegisterExtTaskModeSelectionChange\(modeValue\) \{[\s\S]*?if \(registerExtTaskModeSelectionInFlight\) \{[\s\S]*?return;[\s\S]*?registerExtTaskModeSelectionInFlight = true;[\s\S]*?finally \{[\s\S]*?registerExtTaskModeSelectionInFlight = false;/
  );
  assert.match(sidepanel, /registerExtTaskMode: mode/);
});

test('RegisterExt explicit mode beats stale checked radio state', () => {
  const sidepanel = read('sidepanel/sidepanel.js');

  assert.match(
    sidepanel,
    /function getSelectedRegisterExtTaskMode\(state = latestState\) \{[\s\S]*?hasOwnProperty\.call\(state, 'registerExtTaskMode'\)[\s\S]*?return normalizeRegisterExtTaskMode\(state\.registerExtTaskMode\);[\s\S]*?const selected = registerExtTaskModeInputs\.find/
  );
  assert.match(
    sidepanel,
    /const restoredTaskMode = normalizeRegisterExtTaskMode\(state\?\.registerExtTaskMode\);[\s\S]*?setRegisterExtTaskModeInputs\(restoredTaskMode\);[\s\S]*?updateRegisterExtTaskModeUI\(restoredTaskMode\);/
  );
  assert.match(sidepanel, /updatePlusModeUI\(\{ registerExtTaskMode: getSelectedRegisterExtTaskMode\(latestState\) \}\);/);
});

test('RegisterExt task mode changes force workflow rerender beyond Plus mode changes', () => {
  const sidepanel = read('sidepanel/sidepanel.js');

  assert.match(sidepanel, /let currentRegisterExtTaskMode = DEFAULT_REGISTER_EXT_TASK_MODE;/);
  assert.match(sidepanel, /currentRegisterExtTaskMode = normalizeRegisterExtTaskMode\(options\?\.registerExtTaskMode \|\| getSelectedRegisterExtTaskMode\(latestState\)\);/);
  assert.match(
    sidepanel,
    /const shouldRender = Boolean\(options\.render\)[\s\S]*?\|\| nextRegisterExtTaskMode !== currentRegisterExtTaskMode[\s\S]*?\|\| nextPhoneSignupReloginAfterBindEmailEnabled !== currentPhoneSignupReloginAfterBindEmailEnabled/
  );
});

test('RegisterExt payment candidate refresh keeps group filtering', () => {
  const sidepanel = read('sidepanel/sidepanel.js');

  assert.match(
    sidepanel,
    /async function refreshRegisterManagerAccountCandidates[\s\S]*?client\.listCandidates\(\{[\s\S]*?groupName: getRegisterManagerGroupNameFromSettings\(\) \|\| undefined,/
  );
  assert.match(
    sidepanel,
    /async function refreshPlusCheckoutAccountCandidates[\s\S]*?client\.listPlusCheckoutCandidates\(\{[\s\S]*?groupName: getRegisterManagerGroupNameFromSettings\(\) \|\| undefined,/
  );
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
