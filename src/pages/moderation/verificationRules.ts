// Pure rules for the verification tool (#435 / #533).
// Display-only trust: never self-asserted, always revocable with a reason, and
// with zero ranking effect anywhere downstream.

export type VerificationType = 'individual' | 'organization';
export type VerificationMethod = 'concierge' | 'manual' | 'social_link' | 'domain';

/** What the API returns publicly wherever a curator appears. Note: no `method`. */
export interface PublicBadge {
  type: VerificationType;
  since: string | null;
  proof: string | null;
}

/** Whatever the verify form currently holds — narrowing is this module's job. */
export interface VerifyInput {
  type?: string | null;
  method?: string | null;
  proof?: string | null;
  evidence?: string | null;
}

/**
 * The shape verification data arrives in. The index signature is deliberate:
 * admin responses carry extra internal fields (`method`, `evidence`) that must
 * be accepted here and dropped by `publicBadge`.
 */
export interface VerifiedInput {
  type?: string | null;
  since?: string | null;
  proof?: string | null;
  [key: string]: unknown;
}

export interface MethodSpec {
  value: VerificationMethod;
  label: string;
  requires: 'proof' | 'evidence';
  hint: string;
}

export type ErrorMap = Record<string, string>;

export const VERIFICATION_TYPES: { value: VerificationType; label: string }[] = [
  { value: 'individual', label: 'Individual' },
  { value: 'organization', label: 'Organization' },
];

// `proof` is the proven domain/handle; `evidence` is the internal note a human
// wrote. Each method requires exactly one of them.
export const VERIFICATION_METHODS: MethodSpec[] = [
  { value: 'concierge', label: 'Concierge', requires: 'evidence', hint: 'Granted through a claimed pitch. Never published.' },
  { value: 'manual', label: 'Manual', requires: 'evidence', hint: 'Staff checked something off-platform — say what.' },
  { value: 'social_link', label: 'Social link', requires: 'proof', hint: 'The proven handle, e.g. @nytimes.' },
  { value: 'domain', label: 'Domain', requires: 'proof', hint: 'The proven domain, e.g. nytimes.com.' },
];

export function methodSpec(method?: string | null): MethodSpec | null {
  return VERIFICATION_METHODS.find(m => m.value === method) || null;
}

export function requiresProof(method?: string | null): boolean {
  return methodSpec(method)?.requires === 'proof';
}

export function requiresEvidence(method?: string | null): boolean {
  return methodSpec(method)?.requires === 'evidence';
}

/** POST /verification/:userId — 400s if the method's required field is missing. */
export function verifyErrors({ type, method, proof, evidence }: VerifyInput): ErrorMap {
  const errors: ErrorMap = {};
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
export function unverifyErrors({ reason }: { reason?: string | null }): ErrorMap {
  return reason?.trim() ? {} : { reason: 'Required — revocation is always on the record.' };
}

/** Only send the field the method actually proves; the other stays null. */
export function verifyPayload({ type, method, proof, evidence }: VerifyInput): {
  type: string | null | undefined;
  method: string | null | undefined;
  proof: string | null;
  evidence: string | null;
} {
  const trimmedProof = (proof ?? '').trim();
  const trimmedEvidence = (evidence ?? '').trim();
  return {
    type,
    method,
    proof: requiresProof(method) ? trimmedProof : null,
    evidence: requiresEvidence(method) ? trimmedEvidence : trimmedEvidence || null,
  };
}

/**
 * The public badge shape, wherever a curator appears: `{ type, since, proof }`.
 * Note the absence of `method` — see VerifiedBadge. Absent/null means
 * unverified *or* revoked, and renders as nothing.
 */
export function publicBadge(verified?: VerifiedInput | null): PublicBadge | null {
  if (!verified || !verified.type) return null;
  return {
    type: verified.type as VerificationType,
    since: verified.since ?? null,
    proof: verified.proof ?? null,
  };
}

export function isVerified(verified?: VerifiedInput | null): boolean {
  return publicBadge(verified) !== null;
}
