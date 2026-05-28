const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

test('sidepanel exposes register-manager API settings instead of Hotmail helper controls', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'sidepanel', 'sidepanel.html'), 'utf8');

  assert.match(html, /register-manager|RegisterExt API|API 服务/i);
  const mailProviderSelect = html.match(/<select id="select-mail-provider"[\s\S]*?<\/select>/i)?.[0] || '';
  assert.match(mailProviderSelect, /register-manager-api/i);
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

test('background and sidepanel keep register-manager API as the formal mail provider', () => {
  const background = fs.readFileSync(path.join(__dirname, '..', 'background.js'), 'utf8');
  const sidepanel = fs.readFileSync(path.join(__dirname, '..', 'sidepanel', 'sidepanel.js'), 'utf8');

  assert.match(background, /mailProvider:\s*REGISTER_MANAGER_MAIL_PROVIDER/);
  assert.match(background, /case REGISTER_MANAGER_MAIL_PROVIDER:[\s\S]*?return normalized;/);
  assert.match(background, /function normalizeStateProviderForRegisterManager[\s\S]*?mailProvider:\s*normalizeMailProvider\(state\.mailProvider\)/);
  assert.match(background, /if \(isRegisterManagerProvider\(currentState\)\)[\s\S]*?自动领取邮箱/);
  assert.doesNotMatch(background, /case 'mailProvider':[\s\S]*?return HOTMAIL_PROVIDER;/);
  assert.match(background, /LEGACY_REGISTER_MANAGER_API_BASE_URLS[\s\S]*?127\.0\.0\.1:1455\/api\/extension\/RegisterExt/);
  assert.match(background, /function normalizeRegisterManagerApiBaseUrl[\s\S]*?return DEFAULT_REGISTER_MANAGER_API_BASE_URL;/);
  assert.match(background, /case 'registerManagerApiBaseUrl':[\s\S]*?return normalizeRegisterManagerApiBaseUrl\(value\);/);
  assert.match(sidepanel, /if \(normalized === REGISTER_MANAGER_MAIL_PROVIDER\)[\s\S]*?return REGISTER_MANAGER_MAIL_PROVIDER;/);
  assert.match(sidepanel, /return REGISTER_MANAGER_MAIL_PROVIDER;/);
  assert.match(sidepanel, /function normalizeRegisterManagerApiBaseUrl[\s\S]*?return DEFAULT_REGISTER_MANAGER_API_BASE_URL;/);
  assert.match(sidepanel, /registerManagerGroupName:\s*String\(inputRegisterManagerGroupName\?\.value/);
  assert.match(sidepanel, /client\.listCandidates\(\{[\s\S]*?groupName:\s*getRegisterManagerGroupNameFromSettings\(\)/);
  assert.match(sidepanel, /function handleRegisterManagerGroupNameChange\(\)[\s\S]*?registerExtSelectedAccountId:\s*null/);
  assert.match(sidepanel, /function handleRegisterManagerGroupNameChange\(\)[\s\S]*?registerExtSelectedEmail:\s*''/);
});
