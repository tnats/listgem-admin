import { describe, expect, it } from 'vitest';
import {
  VERIFICATION_METHODS,
  isVerified,
  publicBadge,
  requiresEvidence,
  requiresProof,
  unverifyErrors,
  verifyErrors,
  verifyPayload,
} from './verificationRules';

const base = { type: 'individual', method: 'manual', proof: '', evidence: '' };

describe('verify validation', () => {
  it('requires proof for domain and social_link', () => {
    expect(verifyErrors({ ...base, method: 'domain' }).proof).toBeTruthy();
    expect(verifyErrors({ ...base, method: 'social_link' }).proof).toBeTruthy();
    expect(verifyErrors({ ...base, method: 'domain', proof: 'nytimes.com' }).proof).toBeUndefined();
  });

  it('requires evidence for concierge and manual — the note is the only proof there is', () => {
    expect(verifyErrors({ ...base, method: 'concierge' }).evidence).toBeTruthy();
    expect(verifyErrors({ ...base, method: 'manual' }).evidence).toBeTruthy();
    expect(verifyErrors({ ...base, method: 'manual', evidence: 'checked staff page' }).evidence).toBeUndefined();
  });

  it('rejects whitespace-only input', () => {
    expect(verifyErrors({ ...base, method: 'manual', evidence: '   ' }).evidence).toBeTruthy();
    expect(verifyErrors({ ...base, method: 'domain', proof: '  ' }).proof).toBeTruthy();
  });

  it('rejects unknown types and methods — no tiers sneak in as a type', () => {
    expect(verifyErrors({ ...base, type: 'premium' }).type).toBeTruthy();
    expect(verifyErrors({ ...base, method: 'gold' }).method).toBeTruthy();
  });

  it('declares exactly one required field per method', () => {
    for (const m of VERIFICATION_METHODS) {
      expect(requiresProof(m.value) !== requiresEvidence(m.value)).toBe(true);
    }
  });
});

describe('unverify validation', () => {
  it('always requires a reason', () => {
    expect(unverifyErrors({ reason: '' }).reason).toBeTruthy();
    expect(unverifyErrors({ reason: '  ' }).reason).toBeTruthy();
    expect(unverifyErrors({ reason: 'Domain lapsed' })).toEqual({});
  });
});

describe('verifyPayload', () => {
  it('sends null proof for evidence-backed methods', () => {
    const body = verifyPayload({ type: 'individual', method: 'concierge', proof: 'ignored.com', evidence: 'note' });
    expect(body.proof).toBeNull();
    expect(body.evidence).toBe('note');
  });

  it('trims the proven domain', () => {
    const body = verifyPayload({ type: 'organization', method: 'domain', proof: ' nytimes.com ', evidence: '' });
    expect(body.proof).toBe('nytimes.com');
  });
});

describe('publicBadge', () => {
  it('exposes only type, since and proof — never method or evidence', () => {
    const badge = publicBadge({
      type: 'individual',
      since: '2026-08-10',
      proof: null,
      method: 'concierge',
      evidence: 'internal note',
    });
    expect(Object.keys(badge).sort()).toEqual(['proof', 'since', 'type']);
    expect(JSON.stringify(badge)).not.toMatch(/concierge|internal note/);
  });

  it('treats revoked and never-verified alike', () => {
    expect(publicBadge(null)).toBeNull();
    expect(publicBadge({ type: null })).toBeNull();
    expect(isVerified(null)).toBe(false);
    expect(isVerified({ type: 'organization' })).toBe(true);
  });
});
