// The concierge job as a sequence, derived from server state alone.
//
// The pitch page is organised by object — Build, Outreach, Identity, Audit —
// while the work is a pipeline with gates. Nothing said which gate you were at,
// so each one was found by hitting it: tokens were issued on a draft, the
// invite was sent, and the *target's* screen reported the refusal.
//
// Every precondition that failed that way already existed in `pitchRules`. What
// was missing is direction. Those predicates only ever answered "may I?", which
// disables a control; read forward they answer "what now?", which is the same
// knowledge pointed at the operator instead of at a button.
//
// Pure and dependency-free, like pitchRules, so the sequence is pinned by tests
// rather than by clicking through prod.

import {
  canConfirmIdentity,
  canEditItems,
  inviteClaimBlockedReason,
  isExpired,
  type MaybePitch,
  type Pitch,
} from './pitchRules';

export type StepState =
  /** Finished — the server shows the evidence, not a local flag. */
  | 'done'
  /** The operator's move, right now. */
  | 'current'
  /** Reachable, but something must be fixed first — `detail` says what. */
  | 'blocked'
  /** Nothing to do; the ball is with the target. */
  | 'waiting'
  /** Later. */
  | 'todo'
  /** Overtaken — this pitch ended, or the step no longer applies. */
  | 'skipped';

/**
 * What the rail's button does. Declarative so the resolver stays pure and the
 * component owns navigation, mutation and the clipboard.
 */
export type FlowAction =
  | { kind: 'tab'; tab: string; label: string }
  | { kind: 'status'; to: string; label: string }
  | { kind: 'link'; href: string; label: string }
  | { kind: 'copy'; text: string; label: string }
  | { kind: 'modal'; modal: string; label: string };

export interface FlowStep {
  id: string;
  label: string;
  state: StepState;
  /** Why it's blocked, what's being waited on, or what remains. */
  detail?: string | null;
  /** The step's own action. Present on `current` and `blocked` steps. */
  action?: FlowAction | null;
  /** Secondary action, e.g. opening a preview that's already generated. */
  extra?: FlowAction | null;
}

export interface FlowInput {
  pitch: MaybePitch;
  /**
   * The item rows from GET /pitches/:id, when the caller has them.
   *
   * Preferred over the pitch's own counts, which that endpoint does not
   * aggregate — reading them there reported "nothing saved yet" for a pitch
   * holding forty saved items. A board row has the counts and no array; this
   * page has the array. Both are server truth.
   */
  items?: unknown;
  /** The identity record from the verification surface, if one exists. */
  confirmed?: { user_id?: string | null } | null;
  /** Built by the caller from the token — the resolver stays URL-free. */
  previewHref?: string | null;
  inviteHref?: string | null;
  now?: number;
}

/** Statuses from which no further outreach happens. */
const ENDED: Record<string, string> = {
  archived: 'This pitch was taken down — its contact details were purged and both tokens revoked.',
  declined: 'The target declined. Declined is terminal; archive it rather than re-pitching.',
};

function step(
  id: string,
  label: string,
  state: StepState,
  detail?: string | null,
  action?: FlowAction | null,
  extra?: FlowAction | null,
): FlowStep {
  return { id, label, state, detail: detail ?? null, action: action ?? null, extra: extra ?? null };
}

/**
 * How many items a pitch holds, and how many resolved.
 *
 * The array wins when there is one: GET /pitches/:id returns the rows but not
 * the aggregates, so trusting the aggregates there said "nothing saved yet"
 * about a finished forty-item list.
 */
export function itemCounts(pitch: MaybePitch, itemRows?: unknown): { items: number; resolved: number } {
  if (Array.isArray(itemRows)) {
    const rows = itemRows.filter((r): r is Record<string, unknown> => typeof r === 'object' && r !== null);
    return {
      items: rows.length,
      // An item is resolved when it points at a thing. Some surfaces also say
      // so outright; either is enough.
      resolved: rows.filter(r => !!r.thing_id || r.resolved === true).length,
    };
  }
  return { items: pitch?.item_count ?? 0, resolved: pitch?.resolved_count ?? 0 };
}

/**
 * The ordered steps, with exactly one of them live.
 *
 * "Live" is `current` when it's the operator's move, `blocked` when something
 * must be fixed first, and `waiting` when the target holds the ball — that last
 * one matters, because a waiting step with no button used to read as a missing
 * feature and send people hunting.
 */
export function pitchFlow(
  { pitch, items: itemRows, confirmed, previewHref, inviteHref, now = Date.now() }: FlowInput,
): FlowStep[] {
  if (!pitch) return [];
  const p = pitch as Pitch;
  const ended = ENDED[p.status];

  const { items, resolved } = itemCounts(p, itemRows);
  const listReady = items > 0 && resolved === items;
  const hasTokens = !!p.preview_token && !!p.invite_token;
  const claimed = !!p.invite_used_at;
  const identityDone = !!confirmed;
  const inviteExpired = isExpired(p.invite_expires_at, now);

  // A terminal pitch has no next move, and pretending otherwise invites one.
  if (ended) {
    return [
      step('ended', p.status === 'archived' ? 'Taken down' : 'Declined', 'skipped', ended),
    ];
  }

  const steps: FlowStep[] = [];

  // 1. Details. Intake requires these, so this exists to show the sequence has
  //    a beginning, not because it can realistically fail.
  steps.push(
    step('details', 'Target details', p.proposed_title && p.thing_type ? 'done' : 'current',
      p.proposed_title && p.thing_type ? null : 'The list needs a proposed title and a type.',
      { kind: 'modal', modal: 'edit', label: 'Edit details…' }),
  );

  // 2. The list. `item_count`/`resolved_count` are the server's, so this tracks
  //    what is *saved*, never what happens to be on screen unsaved.
  // Once the target has claimed it, the item set is theirs and the API rejects
  // edits — so an unresolved row is no longer ours to finish. Left as `current`
  // this told an operator to "Finish the list" directly above a panel saying
  // they couldn't, and hid the step that actually was available.
  const buildOver = !canEditItems(p);
  const buildDetail = items === 0
    ? 'Nothing saved yet — paste the source list and resolve it.'
    : `${items - resolved} of ${items} row(s) still unresolved.`;
  steps.push(
    step('build', 'Build the list', listReady || buildOver ? 'done' : 'current',
      buildOver
        ? `${resolved} of ${items} item(s) resolved. The set is theirs now.`
        : listReady
          ? `${items} item(s) saved.`
          : buildDetail,
      buildOver
        ? { kind: 'tab', tab: 'build', label: 'View the list' }
        : { kind: 'tab', tab: 'build', label: items === 0 ? 'Open the builder' : 'Finish the list' }),
  );

  // 3. Links. Both are minted together; the preview is the reason this is
  //    allowed on a draft at all.
  steps.push(
    step('links', 'Generate the links', hasTokens ? 'done' : listReady && !buildOver ? 'current' : 'todo',
      hasTokens ? 'Preview and invite links exist.' : 'Mints the preview and invite pair.',
      { kind: 'tab', tab: 'outreach', label: hasTokens ? 'Re-issue…' : 'Generate links' },
      hasTokens && previewHref ? { kind: 'link', href: previewHref, label: 'Open preview' } : null),
  );

  // 4. Pitched. The gate that sent a dead invite to a target: an invite is
  //    refused from draft, and the public signup page has no wording for it.
  const isDraft = p.status === 'draft';
  steps.push(
    step('pitched', 'Mark as pitched', isDraft ? (hasTokens ? 'current' : 'todo') : 'done',
      isDraft
        ? 'A draft cannot be claimed — the invite is refused until this moves. Check the preview first.'
        : 'Ready to send.',
      { kind: 'status', to: 'pitched', label: 'Mark as pitched' }),
  );

  // 5. Sending. There is no server evidence of a send, so this ticks when the
  //    claim lands rather than pretending to know.
  const claimBlocked = inviteClaimBlockedReason(p);
  // `accepted` is the target saying yes, which is evidence they received the
  // invite. Nothing else records a send.
  const answered = p.status === 'accepted';
  const sendState: StepState = claimed || answered
    ? 'done'
    : !hasTokens || isDraft
      ? 'todo'
      : inviteExpired
        ? 'blocked'
        : 'current';
  steps.push(
    step('send', 'Send the invite', sendState,
      inviteExpired && !claimed
        // Deliberately not the Outreach panel's wording. The rail states, the
        // panel explains; the same sentence twice on one screen is noise.
        ? 'The invite lapsed after 30 days. Re-issuing replaces both links.'
        : claimBlocked && !claimed
          ? claimBlocked
          : claimed
            ? 'Claimed.'
            // Both links, in that order. The invite page names the list and
            // shows none of it, so an invite sent alone asks someone to create
            // an account for a list they have never seen.
            : 'Send the preview first, then the invite — the invite page names the list but shows none of it. '
              + 'Nothing records a send, so this ticks when they claim.',
      inviteExpired
        // Navigates rather than re-issuing here: re-issue kills any link
        // already sent, and the Outreach panel is where that is spelled out.
        ? { kind: 'tab', tab: 'outreach', label: 'Re-issue in Outreach' }
        : inviteHref
          ? { kind: 'copy', text: inviteHref, label: 'Copy invite link' }
          : { kind: 'tab', tab: 'outreach', label: 'Open outreach' },
      // Offered beside it, because it is the half that should go first.
      !inviteExpired && previewHref ? { kind: 'copy', text: previewHref, label: 'Copy preview link' } : null),
  );

  // 6. Theirs. `waiting` is claimed only where there is evidence the ball is
  //    with them — they accepted. Before that the operator still owes a send,
  //    and calling it "waiting" would excuse an outreach nobody made.
  steps.push(
    step('claim', 'They claim the draft', claimed ? 'done' : answered ? 'waiting' : 'todo',
      claimed
        ? 'Claimed — the list is theirs now.'
        : answered
          ? 'They accepted and have not claimed yet. Nothing to do here; the link is with them.'
          : 'Nothing to do here; the link is with them.',
      null,
      // Re-sending is the one useful move while waiting.
      answered && inviteHref ? { kind: 'copy', text: inviteHref, label: 'Copy invite link' } : null),
  );

  // 7. Identity, and only after the claim: a claim proves someone held the
  //    link, never that they are the target.
  steps.push(
    step('identity', 'Confirm identity', identityDone ? 'done' : canConfirmIdentity(p) ? 'current' : 'todo',
      identityDone
        ? 'Confirmed against evidence.'
        : canConfirmIdentity(p)
          ? 'Needs evidence a human checked — the claim alone is not proof of identity.'
          : 'Available once the target has claimed and the draft is provisioned.',
      // Navigates rather than opening the modal: the Identity tab carries the
      // claim timestamp and the provisioned account, and the judgement this
      // grants a badge on should be made after reading them. It also stops two
      // identically-named buttons sitting on one screen.
      { kind: 'tab', tab: 'identity', label: 'Open Identity' }),
  );

  return firstLiveOnly(steps);
}

/**
 * Leave one live step. Later steps whose preconditions happen to be met still
 * read as `todo`, so the rail always answers "what now" with one thing.
 */
function firstLiveOnly(steps: FlowStep[]): FlowStep[] {
  let seen = false;
  return steps.map(s => {
    if (s.state === 'done' || s.state === 'skipped') return s;
    if (seen) return { ...s, state: 'todo', action: null };
    if (s.state === 'current' || s.state === 'blocked' || s.state === 'waiting') {
      seen = true;
      return s;
    }
    return s;
  });
}

/** The one step the rail leads with, if any. */
export function currentStep(steps: FlowStep[]): FlowStep | null {
  return steps.find(s => s.state === 'current' || s.state === 'blocked' || s.state === 'waiting') || null;
}
