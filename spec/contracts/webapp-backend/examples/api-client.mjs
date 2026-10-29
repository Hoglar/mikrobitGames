/** Browser example for API 0.3.0. Same HTTPS origin, no tokens in JavaScript. */
export class ApiError extends Error {
  constructor(message, { status = 0, code = 'NETWORK_ERROR', requestId = null, retryAfter = null } = {}) {
    super(message);
    this.name = 'ApiError';
    Object.assign(this, { status, code, requestId, retryAfter });
  }
}

export async function api(path, { method = 'GET', body, timeoutMs = 70000 } = {}) {
  // Relative API paths only; never send credentials to an arbitrary URL.
  if (!path.startsWith('/') || path.startsWith('//') || path.includes('://')) {
    throw new TypeError('Bruk en API-sti som /games.');
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`/api/v1${path}`, {
      method,
      credentials: 'same-origin',
      headers: method === 'POST'
        ? { 'Content-Type': 'application/json', 'X-MBG-Request': '1' }
        : { 'Accept': 'application/json' },
      ...(method === 'POST' ? { body: JSON.stringify(body ?? {}) } : {}),
      signal: controller.signal
    });
    const text = await response.text();
    let data = null;
    try { data = text ? JSON.parse(text) : null; } catch { /* Proxy errors can be HTML. */ }
    const metadata = {
      status: response.status,
      requestId: response.headers.get('X-Request-ID') ?? data?.request_id ?? null,
      retryAfter: response.headers.get('Retry-After')
    };
    if (!response.ok) {
      throw new ApiError(data?.error?.message ?? `Tjenesten svarte HTTP ${response.status}.`, {
        ...metadata, code: data?.error?.code ?? 'HTTP_ERROR'
      });
    }
    if (response.status !== 204 && data === null) {
      throw new ApiError('Forventet JSON, men fikk et annet svar.', { ...metadata, code: 'INVALID_RESPONSE' });
    }
    return { ...metadata, data }; // 204 returns data: null; no JSON parsing error.
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(controller.signal.aborted ? 'Ventetiden er utløpt.' : 'Kunne ikke kontakte serveren.', {
      code: controller.signal.aborted ? 'CLIENT_TIMEOUT' : 'NETWORK_ERROR'
    });
  } finally {
    clearTimeout(timer);
  }
}
