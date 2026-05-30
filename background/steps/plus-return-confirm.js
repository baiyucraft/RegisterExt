(function attachBackgroundPlusReturnConfirm(root, factory) {
  root.MultiPageBackgroundPlusReturnConfirm = factory();
})(typeof self !== 'undefined' ? self : globalThis, function createBackgroundPlusReturnConfirmModule() {
  const PAYPAL_SOURCE = 'paypal-flow';
  const GOPAY_SOURCE = 'gopay-flow';
  const PLUS_CHECKOUT_SOURCE = 'plus-checkout';
  const PLUS_RETURN_SETTLE_WAIT_MS = 20000;

  function createPlusReturnConfirmExecutor(deps = {}) {
    const {
      addLog,
      completeNodeFromBackground,
      getTabId,
      isTabAlive,
      registerManagerApiClient = null,
      setState,
      sleepWithStop,
      waitForTabUrlMatchUntilStopped,
    } = deps;

    async function resolveReturnTabId(state = {}) {
      const paypalTabId = await getTabId(PAYPAL_SOURCE);
      if (paypalTabId && await isTabAlive(PAYPAL_SOURCE)) {
        return paypalTabId;
      }
      const gopayTabId = await getTabId(GOPAY_SOURCE);
      if (gopayTabId && await isTabAlive(GOPAY_SOURCE)) {
        return gopayTabId;
      }
      const checkoutTabId = await getTabId(PLUS_CHECKOUT_SOURCE);
      if (checkoutTabId) {
        return checkoutTabId;
      }
      const storedTabId = Number(state.plusCheckoutTabId) || 0;
      if (storedTabId) {
        return storedTabId;
      }
      throw new Error('步骤 9：未找到 Plus / PayPal / GoPay 标签页，无法确认订阅回跳。');
    }

    function isReturnUrl(url = '') {
      return /https:\/\/(?:chatgpt\.com|chat\.openai\.com|openai\.com)\//i.test(String(url || ''))
        && !/paypal\.|gopay|gojek|midtrans|xendit|stripe/i.test(String(url || ''));
    }

    function resolveRegisterExtCheckoutReturnStatus(url = '') {
      const normalizedUrl = String(url || '').trim();
      if (/\/(?:backend-api\/)?payments\/success(?:[/?#]|$)/i.test(normalizedUrl)) {
        return {
          status: 'payment_succeeded',
          paymentStatus: 'paid',
          plusActivationStatus: 'active',
        };
      }
      if (/[?&#](?:redirect_status|payment_status)=succeeded(?:[&#]|$)/i.test(normalizedUrl)) {
        return {
          status: 'payment_succeeded',
          paymentStatus: 'paid',
          plusActivationStatus: 'active',
        };
      }
      if (/[?&#](?:redirect_status|payment_status)=(?:failed|canceled|cancelled)(?:[&#]|$)/i.test(normalizedUrl)) {
        return {
          status: 'cancelled',
          paymentStatus: 'cancelled',
          plusActivationStatus: 'unknown',
        };
      }
      return {
        status: 'unknown',
        paymentStatus: 'unknown',
        plusActivationStatus: 'unknown',
      };
    }

    async function writebackRegisterExtCheckoutStatus(state = {}, tab = null) {
      const runId = String(state?.plusCheckoutRunId || state?.registerExtRunId || '').trim();
      const checkoutUuid = String(state?.plusCheckoutUuid || '').trim();
      if (!registerManagerApiClient || !runId || !checkoutUuid) {
        return null;
      }
      const isPaymentOnlyRun = Boolean(String(state?.plusCheckoutRunId || '').trim());
      const writeback = isPaymentOnlyRun
        ? registerManagerApiClient.writebackPlusCheckoutStatus
        : registerManagerApiClient.writebackRunCheckoutStatus;
      if (typeof writeback !== 'function') {
        return null;
      }

      const resolved = resolveRegisterExtCheckoutReturnStatus(tab?.url || '');
      const payload = {
        status: resolved.status,
        paymentStatus: resolved.paymentStatus,
        plusActivationStatus: resolved.plusActivationStatus,
        finalUrl: tab?.url || '',
        idempotencyKey: `${runId}:${checkoutUuid}:${resolved.status}`,
      };
      const checkoutSessionId = String(state?.plusCheckoutSessionId || '').trim();
      if (checkoutSessionId) {
        payload.checkoutSessionId = checkoutSessionId;
      }

      await addLog('步骤 9：正在回写 RegisterExt Plus Checkout 回跳状态...', 'info');
      const response = await writeback(runId, checkoutUuid, payload);
      const checkout = response?.checkout || response || {};
      await setState({
        plusCheckoutStatus: checkout.status || payload.status,
        plusCheckoutPaymentStatus: checkout.paymentStatus || payload.paymentStatus,
        plusCheckoutWritebackAt: Date.now(),
        plusCheckoutWritebackError: '',
        plusCodexOauthRunUuid: checkout.codexOauthRunUuid || response?.codexOauthRunUuid || '',
      });
      if (resolved.status === 'payment_succeeded') {
        await addLog('步骤 9：RegisterExt Plus Checkout 支付成功状态已回写，后端将按 seed 触发 Codex OAuth refresh。', 'ok');
      } else {
        await addLog('步骤 9：RegisterExt Plus Checkout 已按保守状态回写，未把普通回跳判定为支付成功。', 'warn');
      }
      return response;
    }

    async function executePlusReturnConfirm(state = {}) {
      const tabId = await resolveReturnTabId(state);
      await addLog('步骤 9：正在等待支付授权后回跳到 ChatGPT / OpenAI 页面...', 'info');
      const tab = await waitForTabUrlMatchUntilStopped(tabId, isReturnUrl);
      await addLog('步骤 9：已检测到订阅回跳页面，固定等待 20 秒让页面完成加载。', 'info');
      await sleepWithStop(PLUS_RETURN_SETTLE_WAIT_MS);

      let writebackResponse = null;
      try {
        writebackResponse = await writebackRegisterExtCheckoutStatus(state, tab);
      } catch (error) {
        const message = error?.message || String(error || '未知错误');
        await setState({
          plusCheckoutWritebackAt: Date.now(),
          plusCheckoutWritebackError: message,
        });
        throw new Error(`步骤 9：RegisterExt Plus Checkout 支付状态回写失败：${message}`);
      }

      await setState({
        plusCheckoutTabId: tabId,
        plusReturnUrl: tab?.url || '',
      });
      await completeNodeFromBackground('plus-checkout-return', {
        plusReturnUrl: tab?.url || '',
        plusCodexOauthRunUuid: writebackResponse?.checkout?.codexOauthRunUuid || writebackResponse?.codexOauthRunUuid || '',
      });
    }

    return {
      executePlusReturnConfirm,
    };
  }

  return {
    createPlusReturnConfirmExecutor,
  };
});
