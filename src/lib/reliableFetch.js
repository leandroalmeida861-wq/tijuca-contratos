const RETRYABLE_METHODS = new Set(['GET', 'HEAD']);
const RETRYABLE_STATUS_CODES = new Set([408, 502, 503, 504, 520, 522]);

export function createReliableFetch(baseFetch = globalThis.fetch, options = {}) {
  const retries = Math.max(0, Number(options.retries ?? 1));
  const timeoutMs = Math.max(1000, Number(options.timeoutMs ?? 18000));
  const retryDelayMs = Math.max(0, Number(options.retryDelayMs ?? 900));

  return async function reliableFetch(input, init = {}) {
    const method = requestMethod(input, init);
    if (!RETRYABLE_METHODS.has(method)) return baseFetch(input, init);

    for (let attempt = 0; attempt <= retries; attempt += 1) {
      const attemptSignal = createAttemptSignal(init.signal, timeoutMs);
      try {
        const response = await baseFetch(input, { ...init, signal: attemptSignal.signal });
        if (!RETRYABLE_STATUS_CODES.has(response.status) || attempt === retries) return response;
      } catch (error) {
        if (init.signal?.aborted) throw error;
        if (!isTransientRequestError(error) || attempt === retries) {
          if (attemptSignal.didTimeout()) throw requestTimeoutError();
          throw error;
        }
      } finally {
        attemptSignal.cleanup();
      }

      await wait(retryDelayMs * (attempt + 1));
    }

    throw new Error('Falha inesperada ao consultar o banco de dados.');
  };
}

export function classifyRequestError(error) {
  const status = Number(error?.status || error?.statusCode || error?.code);
  const message = String(error?.message || error || '').toLowerCase();

  if (
    status === 401
    || message.includes('jwt expired')
    || message.includes('invalid jwt')
    || message.includes('auth session missing')
    || message.includes('refresh token')
  ) {
    return 'session';
  }

  if (
    status === 403
    || message.includes('row-level security')
    || message.includes('permission denied')
    || message.includes('not authorized')
  ) {
    return 'permission';
  }

  if (
    status === 408
    || status === 520
    || status === 522
    || error?.code === 'DATA_REQUEST_TIMEOUT'
    || message.includes('failed to fetch')
    || message.includes('networkerror')
    || message.includes('network request failed')
    || message.includes('load failed')
    || message.includes('timeout')
  ) {
    return 'connection';
  }

  if (status >= 500 || message.includes('bad gateway') || message.includes('service unavailable')) {
    return 'server';
  }

  return 'unknown';
}

function requestMethod(input, init) {
  return String(init?.method || input?.method || 'GET').toUpperCase();
}

function isTransientRequestError(error) {
  const message = String(error?.message || error || '').toLowerCase();
  return (
    error?.name === 'AbortError'
    || error?.name === 'TimeoutError'
    || error instanceof TypeError
    || message.includes('failed to fetch')
    || message.includes('network')
    || message.includes('timeout')
  );
}

function createAttemptSignal(externalSignal, timeoutMs) {
  const controller = new AbortController();
  let timedOut = false;
  const abortFromExternal = () => controller.abort(externalSignal?.reason);
  const timeoutId = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);

  if (externalSignal) {
    if (externalSignal.aborted) abortFromExternal();
    else externalSignal.addEventListener('abort', abortFromExternal, { once: true });
  }

  return {
    signal: controller.signal,
    didTimeout: () => timedOut,
    cleanup() {
      clearTimeout(timeoutId);
      externalSignal?.removeEventListener('abort', abortFromExternal);
    },
  };
}

function requestTimeoutError() {
  const error = new Error('Tempo limite excedido ao consultar o banco de dados.');
  error.code = 'DATA_REQUEST_TIMEOUT';
  return error;
}

function wait(delayMs) {
  return new Promise((resolve) => setTimeout(resolve, delayMs));
}
