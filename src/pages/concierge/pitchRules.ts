// Pure rules for the concierge outreach surface (#434 / #533).
//
// Everything here is the UI half of an invariant the API also enforces. The API
// answers 4xx; this module's job is to make sure the button was never offered.
// Kept dependency-free so `pitchRules.test.js` can pin each rule down.
//
// Typed because the contract is the point: seven statuses, two token types and a
// re-pitch flag that must not be confused with a status.

export type PitchStatus =
  | 'draft'
  | 'pitched'
  | 'accepted'
  | 'provisioned'
  | 'no_response'
  | 'declined'
  | 'archived';

export type SubjectType = 'individual' | 'organization';

export interface Pitch {
  pitch_id: string;
  target_name: string;
  target_org?: string | null;
  /** Purged by takedown — absent means purged, not unknown. */
  target_contact?: string | null;
  source_url?: string | null;
  source_attribution?: string | null;
  proposed_title: string;
  proposed_description?: string | null;
  thing_type: string;
  category?: string | null;
  status: PitchStatus;
  /** Set by takedown. Distinguishes "purged" from "never had a contact". */
  contact_purged_at?: string | null;
  /** Registry parent type of `thing_type`, e.g. CreativeWork. Read-only here. */
  parent_type?: string | null;
  /** The server's re-pitch verdict. Never derive this from `status`. */
  can_repitch: boolean;
  invite_token?: string | null;
  invite_expires_at?: string | null;
  invite_used_at?: string | null;
  preview_token?: string | null;
  created_by?: string | null;
  assigned_to?: string | null;
  notes?: string | null;
  provisioned_list_id?: string | null;
  provisioned_user_id?: string | null;
  pitched_at?: string | null;
  responded_at?: string | null;
  provisioned_at?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  item_count?: number;
  resolved_count?: number;
}

/** Pitches arrive from a query that may not have settled. */
export type MaybePitch = Pitch | null | undefined;

export type ErrorMap = Record<string, string>;

export interface BoardColumn {
  status: PitchStatus;
  label: string;
  hint: string;
}

export const PITCH_STATUSES: PitchStatus[] = [
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
export const BOARD_COLUMNS: BoardColumn[] = [
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
const TRANSITIONS: Record<PitchStatus, PitchStatus[]> = {
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
export const AUTOMATIC_STATUSES: PitchStatus[] = ['provisioned'];

export const STATUS_LABEL: Record<PitchStatus, string> = {
  draft: 'Draft',
  pitched: 'Pitched',
  accepted: 'Accepted',
  provisioned: 'Provisioned',
  no_response: 'No response',
  declined: 'Declined',
  archived: 'Archived',
};

export function allowedTransitions(status: PitchStatus): PitchStatus[] {
  return TRANSITIONS[status] ? [...TRANSITIONS[status]] : [];
}

export function isTerminal(status: PitchStatus): boolean {
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
export function canRepitch(pitch: MaybePitch): boolean {
  if (!pitch) return false;
  if (pitch.status === 'declined') return false;
  return pitch.can_repitch === true;
}

/**
 * The transitions the UI actually offers: the machine's legal set, minus a
 * re-pitch the server hasn't sanctioned. Moving anything other than a `draft`
 * back to `pitched` *is* a re-pitch, so it needs `can_repitch`.
 */
export function offeredTransitions(pitch: MaybePitch): PitchStatus[] {
  if (!pitch) return [];
  return allowedTransitions(pitch.status).filter(next => {
    if (next === 'pitched' && pitch.status !== 'draft') return canRepitch(pitch);
    return true;
  });
}

/** PUT /pitches/:id/items 409s once a pitch is provisioned or archived. */
export function canEditItems(pitch: MaybePitch): boolean {
  if (!pitch) return false;
  return pitch.status !== 'provisioned' && pitch.status !== 'archived';
}

/**
 * POST /pitches/:id/tokens 409s if the invite was already claimed (re-issuing
 * would let one draft be claimed twice) or if the target declined. Archived is
 * blocked locally too: takedown revoked those tokens on purpose.
 * Returns null when issuing is fine, otherwise the reason to show the operator.
 */
export function tokenIssueBlockedReason(pitch: MaybePitch): string | null {
  if (!pitch) return 'No pitch loaded.';
  if (pitch.invite_used_at) return 'Invite already claimed — re-issuing would let one draft be claimed twice.';
  if (pitch.status === 'declined') return 'Target declined. Declined is terminal; archive instead.';
  if (pitch.status === 'archived') return 'Pitch is archived — its tokens were revoked by takedown.';
  return null;
}

export function canIssueTokens(pitch: MaybePitch): boolean {
  return tokenIssueBlockedReason(pitch) === null;
}

/**
 * Identity is confirmed AFTER the claim, never at provisioning: the invite is a
 * capability, so a claim proves someone held the link, not that they are the
 * target. The API requires status = provisioned.
 */
export function canConfirmIdentity(pitch: MaybePitch): boolean {
  return pitch?.status === 'provisioned';
}

/** Takedown purges contact, revokes both tokens and archives — one action, once. */
export function canTakedown(pitch: MaybePitch): boolean {
  if (!pitch) return false;
  return pitch.status !== 'archived';
}

/**
 * Evidence is the only thing standing behind a concierge badge. API 400s without
 * it. Input is whatever the form holds, so it is deliberately loose — narrowing
 * is this function's job.
 */
export function confirmIdentityErrors(input: { evidence?: string | null; type?: string | null }): ErrorMap {
  const errors: ErrorMap = {};
  if (!input.evidence || !input.evidence.trim()) {
    errors.evidence = 'Evidence is required — a concierge grant has no machine-checkable proof.';
  }
  if (input.type !== 'individual' && input.type !== 'organization') {
    errors.type = 'Pick individual or organization.';
  }
  return errors;
}

/** POST /pitches requires target_name, proposed_title and a valid thing_type. */
export function intakeErrors(input: {
  target_name?: string | null;
  proposed_title?: string | null;
  thing_type?: string | null;
}): ErrorMap {
  const errors: ErrorMap = {};
  if (!input.target_name || !input.target_name.trim()) errors.target_name = 'Required.';
  if (!input.proposed_title || !input.proposed_title.trim()) errors.proposed_title = 'Required.';
  if (!input.thing_type) errors.thing_type = 'Required — must be a valid registry type.';
  return errors;
}

export function hasErrors(errors: ErrorMap): boolean {
  return Object.keys(errors).length > 0;
}

// VITE_PUBLIC_SITE_URL is where the public surfaces are served *today*; the
// listgem.com default is where they are going. Getting this wrong doesn't fail
// loudly — the link loads a page that reports the preview as withdrawn, because
// its API call is blocked by CORS for an origin the API doesn't allowlist.
const PUBLIC_SITE = String(import.meta.env?.VITE_PUBLIC_SITE_URL || 'https://listgem.com').replace(/\/$/, '');

/** The two links staff actually send. Public, no auth, rate-limited 30/min. */
export function previewUrl(token?: string | null): string | null {
  return token ? `${PUBLIC_SITE}/pitch/${token}` : null;
}

export function inviteUrl(token?: string | null): string | null {
  return token ? `${PUBLIC_SITE}/signup?invite=${token}` : null;
}

export function isExpired(expiresAt?: string | null, now: number = Date.now()): boolean {
  if (!expiresAt) return false;
  const t = new Date(expiresAt).getTime();
  return Number.isFinite(t) && t < now;
}

/**
 * Does an item's type belong on a pitch of this type?
 *
 * Every item on a list must match the list's `thing_type`, enforced by the
 * `validate_thing_type_match` trigger with a RAISE EXCEPTION. That trigger sits
 * on `list_items`, NOT on `pitch_list_items` — so a mismatched item saves into a
 * pitch without complaint and detonates at provisioning, which is the moment the
 * target clicks the invite. The failure lands on them, not on us.
 *
 * TVShow/TVSeries are interchangeable, matching the trigger's own exception.
 */
export function typeMatchesPitch(itemType?: string | null, pitchType?: string | null): boolean {
  if (!itemType || !pitchType) return true; // nothing to contradict
  const a = itemType.trim();
  const b = pitchType.trim();
  if (a === b) return true;
  const tv = new Set(['TVSeries', 'TVShow']);
  return tv.has(a) && tv.has(b);
}

/**
 * Offline fallback for the intake select. The live vocabulary is `GET /types`
 * (96 entries, public, no auth) — see `useThingTypes`. This list only appears
 * when that endpoint is unreachable, which is also when POST /pitches is
 * unreachable, so it exists to keep the form demoable rather than usable.
 */
export const FALLBACK_THING_TYPES: string[] = [
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
