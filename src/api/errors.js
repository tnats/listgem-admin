/**
 * Turn an axios error into something an operator can act on.
 *
 * The concierge endpoints answer 409 on an illegal status transition with an
 * `allowed: [...]` list — surface it verbatim rather than "something failed",
 * so staff can see the machine disagreed and what it would accept instead.
 *
 * Some also answer with a machine code in `error` and the human sentence in
 * `message` (TYPE_MISMATCH, for one). Leading with the code buries the part
 * worth reading, so a code-shaped `error` steps aside for its message.
 *
 * And where the body names the offending items, their positions are turned
 * into the row numbers shown on screen — 0-based on the wire, 1-based in the
 * table, which is exactly the sort of mismatch an operator shouldn't have to
 * do in their head.
 */
const CODE = /^[A-Z][A-Z0-9_]+$/;

export function apiErrorMessage(err) {
  const data = err?.response?.data;
  const status = err?.response?.status;
  const code = typeof data?.error === 'string' && CODE.test(data.error) ? data.error : null;
  const headline = code ? data.message || data.error : data?.error || data?.message || err?.message || 'Request failed';
  // Keep both when they say different things and neither is a bare code.
  const detail =
    !code && data?.error && data?.message && data.message !== data.error ? ` ${data.message}` : '';
  const allowed = Array.isArray(data?.allowed) && data.allowed.length
    ? ` Allowed from here: ${data.allowed.join(', ')}.`
    : '';
  const rows = itemRows(err);
  const where = rows.length ? ` Row ${rows.join(', ')}.` : '';
  return `${status ? `${status} · ` : ''}${headline}${detail}${allowed}${where}`;
}

/** Row numbers (1-based) for items an error body called out by position. */
export function itemRows(err) {
  const items = err?.response?.data?.items;
  if (!Array.isArray(items)) return [];
  return items
    .map(i => (typeof i?.position === 'number' ? i.position + 1 : null))
    .filter(n => n !== null);
}

export function allowedFrom(err) {
  const allowed = err?.response?.data?.allowed;
  return Array.isArray(allowed) ? allowed : [];
}
