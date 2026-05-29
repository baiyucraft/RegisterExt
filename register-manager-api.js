(function registerManagerApiModule(root, factory) {
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = factory();
    return;
  }

  root.RegisterManagerApi = factory();
})(typeof self !== 'undefined' ? self : globalThis, function createRegisterManagerApiModule() {
  const DEFAULT_REGISTER_MANAGER_API_BASE_URL = 'http://192.168.31.199:1456/api/extension/RegisterExt';

  function normalizeBaseUrl() {
    return DEFAULT_REGISTER_MANAGER_API_BASE_URL;
  }

  function buildUrl(baseUrl, path, query = {}) {
    const url = new URL(`${normalizeBaseUrl(baseUrl)}${path}`);
    for (const [key, value] of Object.entries(query || {})) {
      if (value === undefined || value === null || value === '') continue;
      url.searchParams.set(key, String(value));
    }
    return url.toString();
  }

  async function parseJsonResponse(response) {
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || payload?.ok === false) {
      const message = payload?.error || payload?.message || `RegisterExt API request failed (${response.status})`;
      const error = new Error(message);
      error.status = response.status;
      error.code = payload?.code || 'REGISTER_EXT_API_ERROR';
      error.payload = payload;
      throw error;
    }
    return payload;
  }

  function createRegisterManagerApiClient(options = {}) {
    const baseUrl = normalizeBaseUrl(options.baseUrl);
    const fetchImpl = options.fetchImpl || (typeof fetch === 'function' ? fetch.bind(globalThis) : null);
    if (typeof fetchImpl !== 'function') {
      throw new Error('RegisterExt API client requires fetch');
    }

    async function request(path, options = {}) {
      const method = String(options.method || 'GET').toUpperCase();
      const headers = { ...(options.headers || {}) };
      const init = { method, headers };
      if (options.body !== undefined) {
        headers['content-type'] = headers['content-type'] || 'application/json';
        init.body = JSON.stringify(options.body || {});
      }
      return parseJsonResponse(await fetchImpl(buildUrl(baseUrl, path, options.query), init));
    }

    return {
      health: () => request('/health'),
      listCandidates: (query = {}) => request('/accounts/candidates', { query }),
      claimAccount: (body = {}) => request('/accounts/claim', { method: 'POST', body }),
      getRunCode: (runId, body = {}) => request(`/runs/${encodeURIComponent(String(runId || ''))}/code`, { method: 'POST', body }),
      completeRun: (runId, body = {}) => request(`/runs/${encodeURIComponent(String(runId || ''))}/complete`, { method: 'POST', body }),
    };
  }

  return {
    DEFAULT_REGISTER_MANAGER_API_BASE_URL,
    createRegisterManagerApiClient,
    normalizeBaseUrl,
  };
});
