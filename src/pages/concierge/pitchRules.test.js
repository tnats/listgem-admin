import { describe, expect, it } from 'vitest';
import {
  BOARD_COLUMNS,
  PITCH_STATUSES,
  allowedTransitions,
  canConfirmIdentity,
  canEditItems,
  canIssueTokens,
  canRepitch,
  canTakedown,
  confirmIdentityErrors,
  hasErrors,
  intakeErrors,
  inviteUrl,
  isExpired,
  isTerminal,
  offeredTransitions,
  previewUrl,
  tokenIssueBlockedReason,
} from './pitchRules';

const pitch = (over = {}) => ({ status: 'draft', can_repitch: false, ...over });

describe('status machine', () => {
  it('covers every status with a column', () => {
    expect(BOARD_COLUMNS.map(c => c.status).sort()).toEqual([...PITCH_STATUSES].sort());
  });

  it('walks the happy path draft → pitched → accepted → provisioned', () => {
    expect(allowedTransitions('draft')).toContain('pitched');
    expect(allowedTransitions('pitched')).toContain('accepted');
    expect(allowedTransitions('accepted')).toContain('provisioned');
  });

  it('treats archived as a sink and declined as terminal-but-archivable', () => {
    expect(allowedTransitions('archived')).toEqual([]);
    expect(isTerminal('archived')).toBe(true);
    expect(allowedTransitions('declined')).toEqual(['archived']);
  });

  it('lets every status reach archived', () => {
    for (const status of PITCH_STATUSES.filter(s => s !== 'archived')) {
      expect(allowedTransitions(status)).toContain('archived');
    }
  });

  it('never allows declined → pitched, the 409 the API guards', () => {
    expect(allowedTransitions('declined')).not.toContain('pitched');
  });

  it('returns a fresh array so callers cannot mutate the machine', () => {
    allowedTransitions('draft').push('provisioned');
    expect(allowedTransitions('draft')).not.toContain('provisioned');
  });
});

describe('re-pitch gating (invariant 1)', () => {
  it('never offers re-pitch on an explicit decline, whatever the flag says', () => {
    expect(canRepitch(pitch({ status: 'declined', can_repitch: false }))).toBe(false);
    // A malformed row claiming a declined target is re-pitchable is still refused.
    expect(canRepitch(pitch({ status: 'declined', can_repitch: true }))).toBe(false);
    expect(offeredTransitions(pitch({ status: 'declined', can_repitch: true }))).toEqual(['archived']);
  });

  it('uses the server flag rather than deriving from status', () => {
    // `no_response` is re-pitchable only when the server says so.
    expect(canRepitch(pitch({ status: 'no_response', can_repitch: true }))).toBe(true);
    expect(canRepitch(pitch({ status: 'no_response', can_repitch: false }))).toBe(false);
    expect(offeredTransitions(pitch({ status: 'no_response', can_repitch: false }))).toEqual(['archived']);
    expect(offeredTransitions(pitch({ status: 'no_response', can_repitch: true }))).toEqual(['pitched', 'archived']);
  });

  it('does not treat the first pitch of a draft as a re-pitch', () => {
    expect(offeredTransitions(pitch({ status: 'draft', can_repitch: false }))).toContain('pitched');
  });

  it('is false for a missing pitch', () => {
    expect(canRepitch(null)).toBe(false);
    expect(offeredTransitions(undefined)).toEqual([]);
  });
});

describe('item editing (409 guard)', () => {
  it('blocks edits once provisioned or archived', () => {
    expect(canEditItems(pitch({ status: 'provisioned' }))).toBe(false);
    expect(canEditItems(pitch({ status: 'archived' }))).toBe(false);
  });

  it('allows edits everywhere else', () => {
    for (const status of ['draft', 'pitched', 'accepted', 'no_response', 'declined']) {
      expect(canEditItems(pitch({ status }))).toBe(true);
    }
  });
});

describe('token issuing (409 guards)', () => {
  it('refuses to re-issue after a claim — one draft, one claim', () => {
    const claimed = pitch({ status: 'accepted', invite_used_at: '2026-08-10T08:14:00Z' });
    expect(canIssueTokens(claimed)).toBe(false);
    expect(tokenIssueBlockedReason(claimed)).toMatch(/already claimed/i);
  });

  it('refuses after a decline', () => {
    expect(canIssueTokens(pitch({ status: 'declined' }))).toBe(false);
  });

  it('refuses on an archived pitch whose tokens takedown revoked', () => {
    expect(canIssueTokens(pitch({ status: 'archived' }))).toBe(false);
  });

  it('allows the normal case', () => {
    expect(canIssueTokens(pitch({ status: 'accepted' }))).toBe(true);
    expect(tokenIssueBlockedReason(pitch({ status: 'accepted' }))).toBeNull();
  });
});

describe('identity confirmation (invariant 3)', () => {
  it('is only available after the claim, never at provisioning time', () => {
    expect(canConfirmIdentity(pitch({ status: 'provisioned' }))).toBe(true);
    for (const status of ['draft', 'pitched', 'accepted', 'no_response', 'declined', 'archived']) {
      expect(canConfirmIdentity(pitch({ status }))).toBe(false);
    }
  });

  it('requires evidence (invariant 2)', () => {
    expect(confirmIdentityErrors({ evidence: '', type: 'individual' }).evidence).toBeTruthy();
    expect(confirmIdentityErrors({ evidence: '   ', type: 'individual' }).evidence).toBeTruthy();
    expect(hasErrors(confirmIdentityErrors({ evidence: 'Confirmed by email', type: 'individual' }))).toBe(false);
  });

  it('requires a known subject type', () => {
    expect(confirmIdentityErrors({ evidence: 'ok', type: 'gold' }).type).toBeTruthy();
    expect(confirmIdentityErrors({ evidence: 'ok', type: 'organization' }).type).toBeUndefined();
  });
});

describe('takedown (invariant 4)', () => {
  it('is offered once and not again after it archived the pitch', () => {
    expect(canTakedown(pitch({ status: 'pitched' }))).toBe(true);
    expect(canTakedown(pitch({ status: 'archived' }))).toBe(false);
  });
});

describe('intake validation', () => {
  it('requires name, title and type', () => {
    const errors = intakeErrors({ target_name: '', proposed_title: ' ', thing_type: '' });
    expect(Object.keys(errors).sort()).toEqual(['proposed_title', 'target_name', 'thing_type']);
  });

  it('passes a complete form', () => {
    expect(
      hasErrors(intakeErrors({ target_name: 'A', proposed_title: 'B', thing_type: 'Movie' })),
    ).toBe(false);
  });
});

describe('public links', () => {
  it('builds the two links staff actually send', () => {
    // Asserted by shape, not by host: the public surfaces live on a Netlify
    // domain today and move to listgem.com later, and a test pinned to either
    // one fails for the wrong reason when that changes.
    expect(previewUrl('pv_1')).toMatch(/^https:\/\/[^/]+\/pitch\/pv_1$/);
    expect(inviteUrl('inv_1')).toMatch(/^https:\/\/[^/]+\/signup\?invite=inv_1$/);
  });

  it('takes its base from VITE_PUBLIC_SITE_URL', () => {
    // Getting this wrong is silent: the link loads a real page that reports the
    // preview as withdrawn, because the API won't allowlist the wrong origin.
    const base = import.meta.env.VITE_PUBLIC_SITE_URL || 'https://listgem.com';
    expect(previewUrl('pv_1').startsWith(base)).toBe(true);
    expect(inviteUrl('inv_1').startsWith(base)).toBe(true);
  });

  it('renders nothing without a token', () => {
    expect(previewUrl(null)).toBeNull();
    expect(inviteUrl(undefined)).toBeNull();
  });

  it('spots an expired invite', () => {
    const now = Date.parse('2026-08-11T00:00:00Z');
    expect(isExpired('2026-08-01T00:00:00Z', now)).toBe(true);
    expect(isExpired('2026-09-01T00:00:00Z', now)).toBe(false);
    expect(isExpired(null, now)).toBe(false);
  });
});
