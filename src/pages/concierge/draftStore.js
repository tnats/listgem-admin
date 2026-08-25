/**
 * Local persistence for an in-progress build.
 *
 * Rows live in component state until Save, so a reload — or a crash, or a
 * mis-click on a link — discarded every adjudication made since the paste.
 * Forty rows of judgement, gone silently, with the pitch looking untouched.
 *
 * sessionStorage rather than localStorage: this is scratch work for one tab,
 * and it should not outlive the tab or leak between staff sharing a machine.
 * It holds list content — the titles being pitched — and never contact details,
 * which the builder doesn't have.
 */

const PREFIX = 'pitchDraft:';
const VERSION = 1;

function key(pitchId) {
  return `${PREFIX}${pitchId}`;
}

export function saveDraft(pitchId, rows) {
  if (!pitchId) return;
  try {
    sessionStorage.setItem(key(pitchId), JSON.stringify({ v: VERSION, savedAt: Date.now(), rows }));
  } catch {
    // Quota, or storage disabled. The build still works; it just isn't
    // recoverable, which is where we were before.
  }
}

export function readDraft(pitchId) {
  if (!pitchId) return null;
  try {
    const parsed = JSON.parse(sessionStorage.getItem(key(pitchId)) || 'null');
    if (!parsed || parsed.v !== VERSION || !Array.isArray(parsed.rows) || parsed.rows.length === 0) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function clearDraft(pitchId) {
  if (!pitchId) return;
  try {
    sessionStorage.removeItem(key(pitchId));
  } catch {
    /* nothing to do */
  }
}
