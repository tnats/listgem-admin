/**
 * The one verification badge. Deliberately invariant.
 *
 * Two rules are load-bearing (#533):
 *  - One badge, no tiers, no colours. The rendered markup is byte-identical for
 *    every `type` and every `proof`, so a hierarchy (gold/premium/…) can't creep
 *    back in via CSS. `VerifiedBadge.test.jsx` asserts that.
 *  - `method` never renders. `concierge` would announce that we recruited the
 *    person, so it stays on the internal history panel and nowhere else. This
 *    component reads only `type`/`since`/`proof` and shows none of them.
 *
 * Absent/null `verified` means unverified *or revoked* — render nothing, never a
 * tombstone.
 */
export default function VerifiedBadge({ verified }) {
  if (!verified || !verified.type) return null;
  return (
    <span className="inline-flex items-center rounded bg-gray-100 px-1.5 py-0.5 text-xs font-medium text-gray-700">
      Verified
    </span>
  );
}
