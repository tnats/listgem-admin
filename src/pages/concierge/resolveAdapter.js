// Adapter between the builder table and the shared resolve/import endpoints
// (#433). The builder deliberately does not share the web app's resolution UI —
// same endpoints, different job: a curator resolves one ambiguity mid-import,
// staff bulk-adjudicate fifty rows at once.
//
// Response shapes are read defensively: /resolve is the web app's add-flow
// endpoint, and this surface should degrade to "unresolved, search it by hand"
// rather than crash if a field is named differently than expected.

export const BATCH_LIMIT = 200; // one rate-limit unit per call

export const ROW_STATUS = {
  resolved: { label: 'Resolved', cls: 'bg-green-100 text-green-700' },
  ambiguous: { label: 'Ambiguous', cls: 'bg-yellow-100 text-yellow-700' },
  unresolved: { label: 'Unresolved', cls: 'bg-gray-100 text-gray-600' },
  pending: { label: 'Pending', cls: 'bg-blue-100 text-blue-700' },
};

function firstString(...vals) {
  for (const v of vals) if (typeof v === 'string' && v) return v;
  return null;
}

/** Normalise one candidate entity from any of the shapes /resolve may nest it in. */
export function normalizeCandidate(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const thingId = firstString(raw.thing_id, raw.id, raw.thing?.thing_id);
  const src = raw.thing && typeof raw.thing === 'object' ? { ...raw.thing, ...raw } : raw;
  return {
    thing_id: thingId,
    title: firstString(src.title, src.name) || '(untitled)',
    type: firstString(src.thing_type, src.type) || null,
    creator: firstString(src.creator, src.author, src.artist) || null,
    year: src.year ?? src.release_year ?? null,
    image_url: firstString(src.image_url, src.image) || null,
    score: typeof src.score === 'number' ? src.score : null,
  };
}

/**
 * Normalise one /resolve response (or one /resolve/batch element) into a row
 * patch. Status is taken from the server when it sends one, otherwise derived:
 * a thing_id means resolved, several candidates mean ambiguous, nothing means
 * unresolved.
 */
export function normalizeResolution(raw) {
  if (!raw || typeof raw !== 'object') {
    return { status: 'unresolved', thing_id: null, candidates: [], match: null };
  }
  const candidates = (Array.isArray(raw.candidates) ? raw.candidates
    : Array.isArray(raw.matches) ? raw.matches
    : Array.isArray(raw.results) ? raw.results
    : []).map(normalizeCandidate).filter(Boolean);

  const match = normalizeCandidate(raw.thing || raw.match || raw.resolved || null);
  const thingId = firstString(raw.thing_id, match?.thing_id) ||
    (candidates.length === 1 ? candidates[0].thing_id : null);

  const reported = firstString(raw.status, raw.resolution_status);
  let status = reported;
  if (status === 'matched' || status === 'exact') status = 'resolved';
  if (!status || !ROW_STATUS[status]) {
    if (thingId) status = 'resolved';
    else if (candidates.length > 1) status = 'ambiguous';
    else status = 'unresolved';
  }
  // A row with no thing_id is never "resolved", whatever the server called it.
  if (status === 'resolved' && !thingId) status = candidates.length > 1 ? 'ambiguous' : 'unresolved';

  return {
    status,
    thing_id: thingId,
    match: match?.thing_id ? match : candidates.find(c => c.thing_id === thingId) || null,
    candidates,
  };
}

/** Ordered candidates out of POST /imports/parse — `{ position, raw_text }`. */
export function normalizeParsed(data) {
  const list = Array.isArray(data?.items) ? data.items
    : Array.isArray(data?.candidates) ? data.candidates
    : Array.isArray(data) ? data
    : [];
  return list
    .map((c, i) => ({
      position: typeof c?.position === 'number' ? c.position : i + 1,
      raw_text: firstString(c?.raw_text, c?.text, typeof c === 'string' ? c : null) || '',
    }))
    .filter(c => c.raw_text.trim())
    .sort((a, b) => a.position - b.position);
}

/**
 * Split row indices into ≤200-per-call batches — one rate-limit unit each, so a
 * fifty-item build costs one unit and a re-check of the pending tail costs one
 * more.
 */
export function chunkForBatch(indices, size = BATCH_LIMIT) {
  const out = [];
  for (let i = 0; i < indices.length; i += size) out.push(indices.slice(i, i + size));
  return out;
}

/** Request body for POST /resolve/batch, in the parse output's shape. */
export function toBatchPayload(rows, indices) {
  return indices.map((rowIndex, i) => ({ position: i + 1, raw_text: rows[rowIndex].raw_text }));
}

/** Unwrap the batch response container — array, `{ results }` or `{ items }`. */
export function batchResults(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.results)) return data.results;
  if (Array.isArray(data?.items)) return data.items;
  if (Array.isArray(data?.resolutions)) return data.resolutions;
  return [];
}

/**
 * Map a batch response back onto rows. `index` is batch-local; `indexMap[i]` is
 * the global row it came from, so a scattered re-check of pending rows lands
 * back in the right places.
 */
export function applyBatchResults(rows, results, indexMap) {
  const patch = new Map();
  for (const r of Array.isArray(results) ? results : []) {
    const globalIndex = typeof r?.index === 'number' ? indexMap[r.index] : undefined;
    if (globalIndex !== undefined) patch.set(globalIndex, normalizeResolution(r));
  }
  return rows.map((row, i) => (patch.has(i) ? { ...row, ...patch.get(i) } : row));
}

/** Rows still on the 60s server deadline — re-request these, don't call them unresolved. */
export function pendingIndices(rows) {
  return rows.reduce((acc, row, i) => (row.status === 'pending' ? [...acc, i] : acc), []);
}

/**
 * Body for PUT /pitches/:id/items — the builder holds the ordering, so this
 * replaces the whole set. Dropped rows are simply absent.
 *
 * `resolution_status` is only ever `resolved` or `ambiguous`; a row without a
 * thing_id is stored as unresolved server-side regardless of what we send.
 */
export function toItemsPayload(rows) {
  return rows
    .filter(row => !row.dropped && (row.raw_text || '').trim())
    .map(row => ({
      raw_text: row.raw_text.trim(),
      thing_id: row.thing_id || null,
      resolution_status: row.thing_id ? 'resolved' : 'ambiguous',
      note: row.note?.trim() ? row.note.trim() : null,
    }));
}

/** Counts for the builder's summary strip. */
export function summarize(rows) {
  const live = rows.filter(r => !r.dropped);
  return {
    total: rows.length,
    kept: live.length,
    dropped: rows.length - live.length,
    resolved: live.filter(r => r.status === 'resolved').length,
    ambiguous: live.filter(r => r.status === 'ambiguous').length,
    unresolved: live.filter(r => r.status === 'unresolved').length,
    pending: live.filter(r => r.status === 'pending').length,
  };
}

/** Rows straight from pasted text, before any resolution has run. */
export function rowsFromParsed(parsed) {
  return parsed.map(p => ({
    raw_text: p.raw_text,
    thing_id: null,
    status: 'unresolved',
    candidates: [],
    match: null,
    note: '',
    dropped: false,
  }));
}

/** Existing items from GET /pitches/:id, back into builder rows. */
export function rowsFromItems(items) {
  return (Array.isArray(items) ? items : []).map(it => ({
    raw_text: firstString(it.raw_text, it.text) || '',
    thing_id: it.thing_id || null,
    status: ROW_STATUS[it.resolution_status] ? it.resolution_status : it.thing_id ? 'resolved' : 'unresolved',
    candidates: [],
    match: it.thing || it.title ? normalizeCandidate(it.thing || it) : null,
    note: it.note || '',
    dropped: false,
  }));
}
