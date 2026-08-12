// Seeded sample for the verification tool (#435 / #533). Invented accounts only.
// Note `method` lives under `internal` — it is admin-visible on the history
// endpoint and must never reach anything shareable.

export const MOCK_VERIFIED = [
  {
    user_id: 'usr_2f19bc',
    username: 'tomasbeltran',
    display_name: 'Tomás Beltrán',
    verified: { type: 'individual', since: '2026-08-10T09:02:00Z', proof: null },
  },
  {
    user_id: 'usr_88ad01',
    username: 'setouchi_review',
    display_name: 'Setouchi Design Review',
    verified: { type: 'organization', since: '2026-07-02T14:00:00Z', proof: 'example.jp' },
  },
  {
    user_id: 'usr_41c7de',
    username: 'ashfield_lit',
    display_name: 'Ashfield College — Literature',
    verified: { type: 'organization', since: '2026-06-18T11:30:00Z', proof: 'example.edu' },
  },
];

export function mockVerificationHistory(userId) {
  const row = MOCK_VERIFIED.find(u => u.user_id === userId);
  if (!row) return null;
  const concierge = row.verified.proof === null;
  return {
    verified: row.verified,
    internal: {
      method: concierge ? 'concierge' : 'domain',
      evidence: concierge
        ? 'Replied from the address on their personal site; confirmed the claim by email 2026-08-10.'
        : 'DNS TXT record checked 2026-07-02.',
      revoked_reason: null,
    },
    history: [
      {
        action: 'verified',
        type: row.verified.type,
        method: concierge ? 'concierge' : 'domain',
        actor: 'gtm@listgem.com',
        at: row.verified.since,
      },
    ],
  };
}
