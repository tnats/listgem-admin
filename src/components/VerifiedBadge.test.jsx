import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import VerifiedBadge from './VerifiedBadge';

const markup = verified => renderToStaticMarkup(<VerifiedBadge verified={verified} />);

describe('VerifiedBadge (invariant 6: one badge, no tiers, no colours)', () => {
  it('renders identical markup for every type', () => {
    const individual = markup({ type: 'individual', since: '2026-01-01', proof: null });
    const organization = markup({ type: 'organization', since: '2026-01-01', proof: null });
    expect(organization).toBe(individual);
  });

  it('renders identical markup for every proof', () => {
    const noProof = markup({ type: 'organization', since: '2026-01-01', proof: null });
    const domain = markup({ type: 'organization', since: '2026-01-01', proof: 'nytimes.com' });
    const handle = markup({ type: 'organization', since: '2026-01-01', proof: '@nytimes' });
    expect(domain).toBe(noProof);
    expect(handle).toBe(noProof);
  });

  it('renders identical markup whatever `since` says', () => {
    expect(markup({ type: 'individual', since: '2020-01-01' })).toBe(markup({ type: 'individual', since: '2026-08-11' }));
  });

  it('carries no tier vocabulary — the removed gold/premium hierarchy cannot creep back', () => {
    const html = markup({ type: 'organization', since: '2026-01-01', proof: 'nytimes.com' });
    expect(html.toLowerCase()).not.toMatch(/gold|premium|tier|silver|bronze/);
  });
});

describe('VerifiedBadge (invariant 5: method never renders)', () => {
  it('does not leak the method even when one is handed to it', () => {
    const html = markup({ type: 'individual', since: '2026-01-01', proof: null, method: 'concierge' });
    expect(html).not.toMatch(/concierge/i);
    expect(html).toBe(markup({ type: 'individual', since: '2026-01-01', proof: null }));
  });

  it('does not leak evidence either', () => {
    const html = markup({ type: 'individual', since: '2026-01-01', evidence: 'called them on 2026-08-11' });
    expect(html).not.toMatch(/called them/i);
  });
});

describe('VerifiedBadge (absent means nothing, not a tombstone)', () => {
  it('renders nothing when unverified or revoked', () => {
    expect(markup(null)).toBe('');
    expect(markup(undefined)).toBe('');
    expect(markup({})).toBe('');
    expect(markup({ type: null, since: null, proof: null })).toBe('');
  });

  it('renders something when verified', () => {
    expect(markup({ type: 'individual' })).toContain('Verified');
  });
});
