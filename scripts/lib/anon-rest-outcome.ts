// scripts/lib/anon-rest-outcome.ts
//
// The decision behind verify-rls.ts's anon-key REST check, kept pure so it is
// unit-tested without a network call.

const DENIED = "42501"; // insufficient_privilege
// "Relation not found": PostgREST's schema cache (PGRST205) or Postgres itself (42P01).
// PostgREST leaves a relation out of its cache when anon has no privilege on it at all.
const NOT_FOUND = ["PGRST205", "42P01"];

/**
 * PASS on a real permission-denied answer or on a successful answer with zero rows.
 * "Not found" is a PASS only for a relation the stage expects to be invisible to anon
 * (`expectHidden`); for a table that is still exposed with RLS on it would mean the
 * check hit the wrong project or a misspelt name. Every other error is a FAIL: it
 * proves nothing.
 */
export function anonRestOutcome(
  expectHidden: boolean,
  error: { code?: string } | null,
  count: number | null,
): "pass" | "fail" {
  if (error) {
    if (error.code === DENIED) return "pass";
    if (expectHidden && error.code != null && NOT_FOUND.includes(error.code)) return "pass";
    return "fail";
  }
  return count === 0 ? "pass" : "fail";
}
