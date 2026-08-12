// Pure rules for the verification tool (#435 / #533).
// Display-only trust: never self-asserted, always revocable with a reason, and
// with zero ranking effect anywhere downstream.

export const VERIFICATION_TYPES = [
  { value: 'individual', label: 'Individual' },
  { value: 'organization', label: 'Organization' },
];

// `proof` is the proven domain/handle; `evidence` is the internal note a human
// wrote. Each method requires exactly one of them.
export const VERIFICATION_METHODS = [
  { value: 'concierge', label: 'Concierge', requires: 'evidence', hint: 'Granted through a claimed pitch. Never published.' },
  { value: 'manual', label: 'Manual', requires: 'evidence', hint: 'Staff checked something off-platform — say what.' },
  { value: 'social_link', label: 'Social link', requires: 'proof', hint: 'The proven handle, e.g. @nytimes.' },
  { value: 'domain', label: 'Domain', requires: 'proof', hint: 'The proven domain, e.g. nytimes.com.' },
];

export function methodSpec(method) {
  return VERIFICATION_METHODS.find(m => m.value === method) || null;
}

export function requiresProof(method) {
  return methodSpec(method)?.requires === 'proof';
}

export function requiresEvidence(method) {
  return methodSpec(method)?.requires === 'evidence';
}

/** POST /verification/:userId — 400s if the method's required field is missing. */
export function verifyErrors({ type, method, proof, evidence }) {
  const errors = {};
  if (!VERIFICATION_TYPES.some(t => t.value === type)) errors.type = 'Pick individual or organization.';
  if (!methodSpec(method)) errors.method = 'Pick a method.';
  if (requiresProof(method) && !proof?.trim()) {
    errors.proof = 'Required — the proven domain or handle.';
  }
  if (requiresEvidence(method) && !evidence?.trim()) {
    errors.evidence = 'Required — this note is the only thing standing behind the badge.';
  }
  return errors;
}

/** DELETE /verification/:userId — reason is required, it lands in the audit trail. */
export function unverifyErrors({ reason }) {
  return reason?.trim() ? {} : { reason: 'Required — revocation is always on the record.' };
}

/** Only send the field the method actually proves; the other stays null. */
export function verifyPayload({ type, method, proof, evidence }) {
  return {
    type,
    method,
    proof: requiresProof(method) ? proof.trim() : null,
    evidence: requiresEvidence(method) ? evidence.trim() : (evidence?.trim() || null),
  };
}

/**
 * The public badge shape, wherever a curator appears: `{ type, since, proof }`.
 * Note the absence of `method` — see VerifiedBadge. Absent/null means
 * unverified *or* revoked, and renders as nothing.
 */
export function publicBadge(verified) {
  if (!verified || !verified.type) return null;
  return { type: verified.type, since: verified.since ?? null, proof: verified.proof ?? null };
}

export function isVerified(verified) {
  return publicBadge(verified) !== null;
}
