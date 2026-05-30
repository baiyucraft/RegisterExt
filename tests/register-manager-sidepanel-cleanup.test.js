const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

test('sidepanel exposes register-manager API settings instead of Hotmail helper controls', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'sidepanel', 'sidepanel.html'), 'utf8');

  assert.match(html, /register-manager|RegisterExt API|API 服务/i);
  const mailProviderSelect = html.match(/<select id="select-mail-provider"[\s\S]*?<\/select>/i)?.[0] || '';
  assert.match(mailProviderSelect, /register-manager-api/i);
  assert.doesNotMatch(html, /input-register-manager-api-base-url/);
  assert.doesNotMatch(html, /row-register-manager-api-base-url/);
  assert.match(html, /input-register-manager-group-name/);
  assert.match(html, /select-register-manager-account/);
  assert.match(html, /btn-refresh-register-manager-accounts/);
  assert.match(html, /<script\s+src="\.\.\/register-manager-api\.js"><\/script>/);
  assert.ok(
    html.indexOf('../register-manager-api.js') < html.indexOf('sidepanel.js'),
    'register-manager API client must load before sidepanel.js'
  );
  assert.doesNotMatch(mailProviderSelect, /hotmail-api|cloudflare-temp-email|cloudmail|luckmail|2925|custom-pool/i);
  assert.doesNotMatch(html, /本地助手地址|批量导入 Hotmail|测试收信/i);
});

test('sidepanel removes session JSON upload and export UI while keeping settings backup', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'sidepanel', 'sidepanel.html'), 'utf8');

  assert.match(html, /btn-export-settings/);
  assert.match(html, /btn-import-settings/);
  assert.match(html, /导出配置/);
  assert.match(html, /导入配置/);

  assert.doesNotMatch(html, /select-panel-mode/);
  assert.doesNotMatch(html, /select-flow/);
  assert.doesNotMatch(html, /row-account-access-strategy/);
  assert.doesNotMatch(html, /select-account-access-strategy/);
  assert.doesNotMatch(html, /SESSION JSON导入/);
  assert.doesNotMatch(html, /导出当前SESSION JSON/);
  assert.doesNotMatch(html, /btn-export-current-session-(?:cpa|sub2)-json/);
  assert.doesNotMatch(html, /本地CPA JSON|SUB2API|Codex2API/);
  assert.doesNotMatch(html, /input-sub2api-|input-codex2api-|input-local-cpa-json-/);
});

test('sidepanel removes guide, password, and Plus mode toggle while keeping checkout region switch', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'sidepanel', 'sidepanel.html'), 'utf8');
  const sidepanel = fs.readFileSync(path.join(__dirname, '..', 'sidepanel', 'sidepanel.js'), 'utf8');

  assert.doesNotMatch(html, /btn-contribution-mode/);
  assert.doesNotMatch(html, />使用说明</);
  assert.doesNotMatch(html, /账户密码/);
  assert.doesNotMatch(html, /Plus 模式/);
  assert.doesNotMatch(html, /已固定开启/);
  assert.doesNotMatch(html, /id="input-password"/);
  assert.doesNotMatch(html, /id="btn-toggle-password"/);
  assert.doesNotMatch(html, /id="input-plus-mode-enabled"/);

  assert.match(html, /<span class="data-label">Plus Checkout<\/span>/);
  assert.match(html, /id="input-plus-checkout-mode-us"\s+value="us_pp"/);
  assert.match(html, /id="input-plus-checkout-mode-jp"\s+value="jp_pp"/);
  assert.match(html, /美区PP Plus Checkout/);
  assert.match(html, /日区PP Plus Checkout/);

  assert.match(sidepanel, /function getFixedPlusModeEnabled\(\)[\s\S]*?return typeof FIXED_PLUS_MODE_ENABLED === 'boolean' \? FIXED_PLUS_MODE_ENABLED : true;/);
  assert.match(sidepanel, /const selectedPlusCheckoutMode = getSelectedPlusCheckoutMode\(latestState\);/);
  assert.match(sidepanel, /syncLatestState\(\{ plusCheckoutMode: selectedPlusCheckoutMode \}\);/);
  assert.match(sidepanel, /plusModeEnabled:\s*getFixedPlusModeEnabled\(\)/);
  assert.doesNotMatch(sidepanel, /customPassword:\s*inputPassword\.value/);
  assert.doesNotMatch(sidepanel, /inputPassword\.addEventListener/);
  assert.doesNotMatch(sidepanel, /btnTogglePassword\.addEventListener/);
  assert.doesNotMatch(sidepanel, /Boolean\(latestState\?\.plusModeEnabled\)/);
});

test('sidepanel removes registration SMS settings while keeping PayPal checkout SMS pool', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'sidepanel', 'sidepanel.html'), 'utf8');
  const sidepanel = fs.readFileSync(path.join(__dirname, '..', 'sidepanel', 'sidepanel.js'), 'utf8');

  assert.doesNotMatch(html, /id="phone-verification-section"/);
  assert.doesNotMatch(html, /id="input-phone-verification-enabled"/);
  assert.doesNotMatch(html, /id="btn-toggle-phone-verification-section"/);
  assert.doesNotMatch(html, /id="row-phone-verification-fold"/);
  assert.doesNotMatch(html, /<span class="section-label">接码设置<\/span>/);
  assert.doesNotMatch(html, /ChatGPT API 接码池/);
  assert.doesNotMatch(html, /id="input-signup-phone"/);

  assert.match(html, /PayPal 接码池/);
  assert.match(html, /<span class="data-label">PayPal 接码<\/span>/);
  assert.match(html, /id="hosted-sms-pool-shell"/);

  assert.match(sidepanel, /function getFixedPhoneVerificationEnabled\(\)[\s\S]*?return false;/);
  assert.match(sidepanel, /phoneVerificationEnabled:\s*getFixedPhoneVerificationEnabled\(\)/);
  assert.match(sidepanel, /function getRuntimeSignupPhoneValue\(state = latestState\)[\s\S]*?if \(!getFixedPhoneVerificationEnabled\(\)\) \{[\s\S]*?return '';/);
  assert.match(sidepanel, /function shouldExecuteStep3WithSignupPhoneIdentity\(state = latestState\)[\s\S]*?if \(!getFixedPhoneVerificationEnabled\(\)\) \{[\s\S]*?return false;/);
  assert.doesNotMatch(sidepanel, /Boolean\(latestState\?\.phoneVerificationEnabled\)/);
  assert.doesNotMatch(sidepanel, /state\?\.phoneVerificationEnabled \|\| latestState\?\.phoneVerificationEnabled/);
  assert.doesNotMatch(sidepanel, /phoneVerificationEnabled:\s*typeof inputPhoneVerificationEnabled/);
});

test('sidepanel keeps PayPal SMS pool expanded and removes single-code controls', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'sidepanel', 'sidepanel.html'), 'utf8');
  const sidepanel = fs.readFileSync(path.join(__dirname, '..', 'sidepanel', 'sidepanel.js'), 'utf8');
  const background = fs.readFileSync(path.join(__dirname, '..', 'background.js'), 'utf8');
  const checkoutStep = fs.readFileSync(path.join(__dirname, '..', 'background', 'steps', 'create-plus-checkout.js'), 'utf8');

  assert.doesNotMatch(html, /row-hosted-checkout-verification-url/);
  assert.doesNotMatch(html, /row-hosted-checkout-manual-fetch/);
  assert.doesNotMatch(html, /row-hosted-checkout-phone/);
  assert.doesNotMatch(html, /btn-hosted-checkout-manual-fetch/);
  assert.doesNotMatch(html, /手动取码|手动获取验证码|PayPal 电话\(不带\+1\)/);

  assert.match(html, /row-hosted-checkout-sms-pool/);
  assert.match(html, /row-hosted-checkout-resend-settings/);
  assert.match(html, /PayPal 接码池/);
  assert.match(html, /<span class="data-label">PayPal 接码<\/span>/);
  assert.match(html, /1234567890----https:\/\/mail\.test\.com\/api\/text-relay\/eca_tr_xxxxxxxxx/);
  assert.doesNotMatch(html, /1234567890&#10;&#10;https:\/\/mail\.test\.com\/api\/text-relay/);

  assert.match(html, /btn-toggle-hosted-sms-pool[\s\S]*?aria-expanded="true"[\s\S]*?>收起<\/button>/);
  assert.match(html, /<div id="hosted-sms-pool-shell" class="hosted-sms-pool-shell is-expanded">/);
  assert.doesNotMatch(html, /<div id="hosted-sms-pool-shell" class="hosted-sms-pool-shell is-collapsed" hidden>/);
  assert.match(sidepanel, /let hostedSmsPoolExpanded = true;/);
  assert.match(sidepanel, /updateHostedSmsPoolCollapseUI\(true\);/);

  assert.match(sidepanel, /hostedCheckoutVerificationUrl:\s*''/);
  assert.match(sidepanel, /hostedCheckoutPhoneNumber:\s*''/);
  assert.doesNotMatch(sidepanel, /FETCH_HOSTED_CHECKOUT_VERIFICATION_CODE/);
  assert.doesNotMatch(sidepanel, /function handleHostedCheckoutManualFetch/);
  assert.match(background, /case 'hostedCheckoutVerificationUrl':\s*case 'hostedCheckoutPhoneNumber':\s*return '';/);
  assert.doesNotMatch(checkoutStep, /stored\?\.hostedCheckoutVerificationUrl[\s\S]*?state\?\.hostedCheckoutVerificationUrl/);
  assert.doesNotMatch(checkoutStep, /stored\?\.hostedCheckoutPhoneNumber[\s\S]*?state\?\.hostedCheckoutPhoneNumber/);
});

test('background and sidepanel keep register-manager API as the formal mail provider', () => {
  const background = fs.readFileSync(path.join(__dirname, '..', 'background.js'), 'utf8');
  const sidepanel = fs.readFileSync(path.join(__dirname, '..', 'sidepanel', 'sidepanel.js'), 'utf8');

  assert.match(background, /mailProvider:\s*REGISTER_MANAGER_MAIL_PROVIDER/);
  assert.match(background, /case REGISTER_MANAGER_MAIL_PROVIDER:[\s\S]*?return normalized;/);
  assert.match(background, /function normalizeStateProviderForRegisterManager[\s\S]*?mailProvider:\s*normalizeMailProvider\(state\.mailProvider\)/);
  assert.match(background, /if \(isRegisterManagerProvider\(currentState\)\)[\s\S]*?自动领取邮箱/);
  assert.doesNotMatch(background, /case 'mailProvider':[\s\S]*?return HOTMAIL_PROVIDER;/);
  assert.match(background, /function normalizeRegisterManagerApiBaseUrl[\s\S]*?return DEFAULT_REGISTER_MANAGER_API_BASE_URL;/);
  assert.match(background, /case 'registerManagerApiBaseUrl':[\s\S]*?return normalizeRegisterManagerApiBaseUrl\(value\);/);
  assert.match(background, /createRegisterManagerApiClientForState[\s\S]*?baseUrl:\s*DEFAULT_REGISTER_MANAGER_API_BASE_URL/);
  assert.match(sidepanel, /if \(normalized === REGISTER_MANAGER_MAIL_PROVIDER\)[\s\S]*?return REGISTER_MANAGER_MAIL_PROVIDER;/);
  assert.match(sidepanel, /return REGISTER_MANAGER_MAIL_PROVIDER;/);
  assert.match(sidepanel, /function normalizeRegisterManagerApiBaseUrl[\s\S]*?return DEFAULT_REGISTER_MANAGER_API_BASE_URL;/);
  assert.match(sidepanel, /rebuildStepDefinitionState\(nextPlusModeEnabled,\s*{[\s\S]*?panelMode:\s*nextPanelMode/);
  assert.doesNotMatch(sidepanel, /useNoRtWorkflow/);
  assert.doesNotMatch(sidepanel, /noRtWorkflowModeChanged/);
  assert.doesNotMatch(sidepanel, /registerManagerApiBaseUrl:\s*normalizeRegisterManagerApiBaseUrl\(inputRegisterManagerApiBaseUrl/);
  assert.doesNotMatch(sidepanel, /inputRegisterManagerApiBaseUrl/);
  assert.match(sidepanel, /createRegisterManagerApiClientFromSettings[\s\S]*?baseUrl:\s*DEFAULT_REGISTER_MANAGER_API_BASE_URL/);
  assert.match(sidepanel, /registerManagerGroupName:\s*String\(inputRegisterManagerGroupName\?\.value/);
  assert.match(sidepanel, /client\.listCandidates\(\{[\s\S]*?groupName:\s*getRegisterManagerGroupNameFromSettings\(\)/);
  assert.match(sidepanel, /function handleRegisterManagerGroupNameChange\(\)[\s\S]*?registerExtSelectedAccountId:\s*null/);
  assert.match(sidepanel, /function handleRegisterManagerGroupNameChange\(\)[\s\S]*?registerExtSelectedEmail:\s*''/);
});

test('JSON upload and export workflow nodes are not exposed', () => {
  const definitions = fs.readFileSync(path.join(__dirname, '..', 'data', 'step-definitions.js'), 'utf8');
  const flowCapabilities = fs.readFileSync(path.join(__dirname, '..', 'shared', 'flow-capabilities.js'), 'utf8');
  const background = fs.readFileSync(path.join(__dirname, '..', 'background.js'), 'utf8');
  const messageRouter = fs.readFileSync(path.join(__dirname, '..', 'background', 'message-router.js'), 'utf8');

  for (const removedNode of ['local-cpa-json-export', 'sub2api-session-import', 'cpa-session-import']) {
    assert.doesNotMatch(definitions, new RegExp(removedNode));
    assert.doesNotMatch(background, new RegExp(`['"]${removedNode}['"]`));
  }
  assert.doesNotMatch(definitions, /导入当前 ChatGPT 会话|导出本地CPA JSON/);
  assert.doesNotMatch(flowCapabilities, /sub2api_codex_session|cpa_codex_session|local-cpa-json|codex2api|sub2api/);
  assert.doesNotMatch(background, /exportCurrentSessionJson|EXPORT_CURRENT_SESSION_JSON|session-to-json-converter/);
  assert.doesNotMatch(messageRouter, /EXPORT_CURRENT_SESSION_JSON|exportCurrentSessionJson/);
});

test('legacy panel and session strategies normalize to OAuth registration path', () => {
  const flowCapabilitiesPath = path.join(__dirname, '..', 'shared', 'flow-capabilities.js');
  delete require.cache[require.resolve(flowCapabilitiesPath)];
  require(flowCapabilitiesPath);

  const capabilities = globalThis.MultiPageFlowCapabilities;
  const registry = capabilities.createFlowCapabilityRegistry();
  for (const legacyMode of ['local-cpa-json', 'local-cpa-json-no-rt', 'cpa', 'sub2api', 'codex2api']) {
    assert.equal(capabilities.normalizePanelMode(legacyMode), 'register-manager-api');
    assert.equal(registry.normalizePanelMode(legacyMode), 'register-manager-api');
  }
  for (const legacyStrategy of ['sms_oauth', 'phone_bind_oauth', 'session_json', 'sub2api_codex_session', 'cpa_codex_session']) {
    assert.equal(capabilities.normalizePlusAccountAccessStrategy(legacyStrategy), 'oauth');
  }

  const resolved = registry.resolveSidepanelCapabilities({
    panelMode: 'sub2api',
    plusAccountAccessStrategy: 'sub2api_codex_session',
    state: { panelMode: 'sub2api', plusModeEnabled: true, plusAccountAccessStrategy: 'sub2api_codex_session' },
  });
  assert.equal(resolved.effectivePanelMode, 'register-manager-api');
  assert.equal(resolved.effectivePlusAccountAccessStrategy, 'oauth');
  assert.deepEqual(resolved.availablePlusAccountAccessStrategies, ['oauth']);

  for (const legacyStrategy of ['sms_oauth', 'phone_bind_oauth']) {
    const legacyResolved = registry.resolveSidepanelCapabilities({
      panelMode: 'register-manager-api',
      plusAccountAccessStrategy: legacyStrategy,
      state: { panelMode: 'register-manager-api', plusModeEnabled: true, plusAccountAccessStrategy: legacyStrategy },
    });
    assert.equal(legacyResolved.effectivePlusAccountAccessStrategy, 'oauth');
    assert.deepEqual(legacyResolved.availablePlusAccountAccessStrategies, ['oauth']);
  }
});
