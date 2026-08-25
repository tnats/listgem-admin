/**
 * A ring buffer of recent API calls, for the builder's diagnostics dump.
 *
 * Lives at the axios layer so it records every request without each hook
 * remembering to instrument itself — which is how the interesting ones get
 * missed. Timings, statuses and rate-limit headers are exactly the evidence
 * that has been unavailable when a build behaved oddly and the only account of
 * it was a description after the fact.
 *
 * Deliberately records no request bodies and no headers we send: a PATCH on a
 * pitch carries a real person's contact details, and the Authorization header
 * carries a token. Method, URL, status, duration and the server's own
 * rate-limit headers are enough to reconstruct a session.
 */

const MAX_ENTRIES = 200;
const entries = [];

/** Response headers worth keeping — all of them from the server, none from us. */
const KEEP_HEADERS = [
  'x-ratelimit-limit',
  'x-ratelimit-remaining',
  'x-ratelimit-reset',
  'retry-after',
];

function pickHeaders(headers) {
  if (!headers) return undefined;
  const out = {};
  for (const key of KEEP_HEADERS) {
    const value = typeof headers.get === 'function' ? headers.get(key) : headers[key];
    if (value != null) out[key] = String(value);
  }
  return Object.keys(out).length ? out : undefined;
}

export function record(entry) {
  entries.push(entry);
  if (entries.length > MAX_ENTRIES) entries.splice(0, entries.length - MAX_ENTRIES);
}

export function recordResponse(response, startedAt) {
  record({
    at: new Date().toISOString(),
    method: (response.config?.method || 'get').toUpperCase(),
    url: response.config?.url,
    status: response.status,
    ms: startedAt ? Date.now() - startedAt : null,
    rate_limit: pickHeaders(response.headers),
  });
}

export function recordError(error, startedAt) {
  const data = error.response?.data;
  record({
    at: new Date().toISOString(),
    method: (error.config?.method || 'get').toUpperCase(),
    url: error.config?.url,
    status: error.response?.status ?? null,
    ms: startedAt ? Date.now() - startedAt : null,
    rate_limit: pickHeaders(error.response?.headers),
    // The server's own account of the failure — not the whole body, which can
    // carry rows of list content.
    error: typeof data?.error === 'string' ? data.error : error.message,
    message: typeof data?.message === 'string' ? data.message : undefined,
  });
}

/** Newest last. A copy, so a caller can't mutate the buffer. */
export function recentRequests(limit = MAX_ENTRIES) {
  return entries.slice(-limit).map(e => ({ ...e }));
}

export function clearRequestLog() {
  entries.length = 0;
}
