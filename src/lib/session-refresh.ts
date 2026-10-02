// Session lifetime and the periodic re-check of the signed-in user. Pure: the
// caller supplies the lookup, so this imports neither the database nor next-auth.

export const SESSION_MAX_AGE_SECONDS = 8 * 60 * 60;
export const SESSION_RECHECK_MS = 5 * 60_000;

export interface SessionToken {
  id?: string;
  role?: string;
  iat?: number;
  checkedAt?: number;
  signedInAt?: number;
  [k: string]: unknown;
}

export type UserLookup = (id: number) => Promise<{ role: string; updatedAt: Date } | undefined>;

/**
 * Returns the token to keep (role refreshed), or null to end the session:
 * the user is gone, or their row changed after sign-in (password reset, role
 * change): users.updatedAt is compared with signedInAt (ms epoch, set once at
 * sign-in), never iat, which Auth.js moves forward on every session read. A
 * token with no signedInAt predates this check and is ended when due. A failed lookup keeps the current token,
 * so a database blip does not sign everyone out; it is retried next request.
 */
export async function refreshSessionToken<T extends SessionToken>(
  token: T,
  lookup: UserLookup,
  now: number
): Promise<T | null> {
  if (typeof token.id !== "string" || !/^[1-9]\d*$/.test(token.id)) return null;
  if (typeof token.checkedAt === "number" && now - token.checkedAt < SESSION_RECHECK_MS) return token;

  let user: Awaited<ReturnType<UserLookup>>;
  try {
    user = await lookup(Number(token.id));
  } catch {
    return token;
  }
  if (!user) return null;
  if (typeof token.signedInAt !== "number" || !Number.isFinite(token.signedInAt)) return null;
  if (user.updatedAt.getTime() > token.signedInAt) return null;
  return { ...token, role: user.role, checkedAt: now };
}
