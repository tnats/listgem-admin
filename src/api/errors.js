/**
 * Turn an axios error into something an operator can act on.
 *
 * The concierge endpoints answer 409 on an illegal status transition with an
 * `allowed: [...]` list — surface it verbatim rather than "something failed",
 * so staff can see the machine disagreed and what it would accept instead.
 */
export function apiErrorMessage(err) {
  const data = err?.response?.data;
  const status = err?.response?.status;
  const base = data?.error || data?.message || err?.message || 'Request failed';
  // Several endpoints put the headline in `error` and the actionable part in
  // `message` — the last-admin 409 being the one that matters most.
  const detail = data?.error && data?.message && data.message !== data.error ? ` ${data.message}` : '';
  const allowed = Array.isArray(data?.allowed) && data.allowed.length
    ? ` Allowed from here: ${data.allowed.join(', ')}.`
    : '';
  return `${status ? `${status} · ` : ''}${base}${detail}${allowed}`;
}

export function allowedFrom(err) {
  const allowed = err?.response?.data?.allowed;
  return Array.isArray(allowed) ? allowed : [];
}
