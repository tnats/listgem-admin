// Pure rules for the concierge outreach surface (#434 / #533).
//
// Everything here is the UI half of an invariant the API also enforces. The API
// answers 4xx; this module's job is to make sure the button was never offered.
// Kept dependency-free so `pitchRules.test.js` can pin each rule down.

export const PITCH_STATUSES = [
  'draft',
  'pitched',
  'accepted',
  'provisioned',
  'no_response',
  'declined',
  'archived',
];

// Board columns, left to right along the happy path; the two off-ramps and the
// archive sink trail it.
export const BOARD_COLUMNS = [
  { status: 'draft', label: 'Draft', hint: 'Built, not yet sent' },
  { status: 'pitched', label: 'Pitched', hint: 'Awaiting a reply' },
  { status: 'accepted', label: 'Accepted', hint: 'Said yes — send the invite' },
  { status: 'provisioned', label: 'Provisioned', hint: 'Claimed the draft' },
  { status: 'no_response', label: 'No response', hint: 'Re-pitchable' },
  { status: 'declined', label: 'Declined', hint: 'Terminal — never re-pitch' },
  { status: 'archived', label: 'Archived', hint: 'Sink' },
];

// The status machine from the API contract. `archived` is a sink with no
// outgoing transitions; `declined` only drains into it.
const TRANSITIONS = {
  draft: ['pitched', 'archived'],
  pitched: ['accepted', 'declined', 'no_response', 'archived'],
  accepted: ['provisioned', 'archived'],
  provisioned: ['archived'],
  no_response: ['pitched', 'archived'],
  declined: ['archived'],
  archived: [],
};

// `provisioned` normally arrives on its own when the target claims the invite —
// staff can still set it by hand to repair state, so it's offered last and
// labelled as a correction.
export const AUTOMATIC_STATUSES = ['provisioned'];

export const STATUS_LABEL = {
  draft: 'Draft',
  pitched: 'Pitched',
  accepted: 'Accepted',
  provisioned: 'Provisioned',
  no_response: 'No response',
  declined: 'Declined',
  archived: 'Archived',
};

export function allowedTransitions(status) {
  return TRANSITIONS[status] ? [...TRANSITIONS[status]] : [];
}

export function isTerminal(status) {
  return allowedTransitions(status).length === 0;
}

/**
 * Re-pitch gate. The server flag decides — never derive re-pitchability from
 * status, because `declined` and `no_response` look alike from the outside and
 * collapsing them re-pitches someone who already said no.
 *
 * `declined` is additionally hard-blocked here: the flag is the only *allow*
 * signal, and status is only ever used to *deny*.
 */
export function canRepitch(pitch) {
  if (!pitch) return false;
  if (pitch.status === 'declined') return false;
  return pitch.can_repitch === true;
}

/**
 * The transitions the UI actually offers: the machine's legal set, minus a
 * re-pitch the server hasn't sanctioned. Moving anything other than a `draft`
 * back to `pitched` *is* a re-pitch, so it needs `can_repitch`.
 */
export function offeredTransitions(pitch) {
  if (!pitch) return [];
  return allowedTransitions(pitch.status).filter(next => {
    if (next === 'pitched' && pitch.status !== 'draft') return canRepitch(pitch);
    return true;
  });
}

/** PUT /pitches/:id/items 409s once a pitch is provisioned or archived. */
export function canEditItems(pitch) {
  if (!pitch) return false;
  return pitch.status !== 'provisioned' && pitch.status !== 'archived';
}

/**
 * POST /pitches/:id/tokens 409s if the invite was already claimed (re-issuing
 * would let one draft be claimed twice) or if the target declined. Archived is
 * blocked locally too: takedown revoked those tokens on purpose.
 * Returns null when issuing is fine, otherwise the reason to show the operator.
 */
export function tokenIssueBlockedReason(pitch) {
  if (!pitch) return 'No pitch loaded.';
  if (pitch.invite_used_at) return 'Invite already claimed — re-issuing would let one draft be claimed twice.';
  if (pitch.status === 'declined') return 'Target declined. Declined is terminal; archive instead.';
  if (pitch.status === 'archived') return 'Pitch is archived — its tokens were revoked by takedown.';
  return null;
}

export function canIssueTokens(pitch) {
  return tokenIssueBlockedReason(pitch) === null;
}

/**
 * Identity is confirmed AFTER the claim, never at provisioning: the invite is a
 * capability, so a claim proves someone held the link, not that they are the
 * target. The API requires status = provisioned.
 */
export function canConfirmIdentity(pitch) {
  return pitch?.status === 'provisioned';
}

/** Takedown purges contact, revokes both tokens and archives — one action, once. */
export function canTakedown(pitch) {
  if (!pitch) return false;
  return pitch.status !== 'archived';
}

/** Evidence is the only thing standing behind a concierge badge. API 400s without it. */
export function confirmIdentityErrors({ evidence, type }) {
  const errors = {};
  if (!evidence || !evidence.trim()) {
    errors.evidence = 'Evidence is required — a concierge grant has no machine-checkable proof.';
  }
  if (type !== 'individual' && type !== 'organization') {
    errors.type = 'Pick individual or organization.';
  }
  return errors;
}

/** POST /pitches requires target_name, proposed_title and a valid thing_type. */
export function intakeErrors({ target_name, proposed_title, thing_type }) {
  const errors = {};
  if (!target_name || !target_name.trim()) errors.target_name = 'Required.';
  if (!proposed_title || !proposed_title.trim()) errors.proposed_title = 'Required.';
  if (!thing_type) errors.thing_type = 'Required — must be a valid registry type.';
  return errors;
}

export function hasErrors(errors) {
  return Object.keys(errors).length > 0;
}

const PUBLIC_SITE = (import.meta.env?.VITE_PUBLIC_SITE_URL || 'https://listgem.com').replace(/\/$/, '');

/** The two links staff actually send. Public, no auth, rate-limited 30/min. */
export function previewUrl(token) {
  return token ? `${PUBLIC_SITE}/pitch/${token}` : null;
}

export function inviteUrl(token) {
  return token ? `${PUBLIC_SITE}/signup?invite=${token}` : null;
}

export function isExpired(expiresAt, now = Date.now()) {
  if (!expiresAt) return false;
  const t = new Date(expiresAt).getTime();
  return Number.isFinite(t) && t < now;
}

/**
 * Fallback registry types for the intake select. The live list comes from
 * /admin/type-rules when it's reachable; this keeps intake usable offline.
 */
export const FALLBACK_THING_TYPES = [
  'Movie',
  'TVSeries',
  'Book',
  'Song',
  'MusicAlbum',
  'Podcast',
  'VideoGame',
  'Restaurant',
  'Hotel',
  'Museum',
  'Park',
  'TouristAttraction',
  'Person',
  'Brand',
  'Product',
];
