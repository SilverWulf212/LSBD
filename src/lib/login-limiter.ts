import { z } from "zod";

/** Sign-in attempt limits: counted per client IP and per email over a sliding window. */
export const LOGIN_LIMITS = { windowMs: 15 * 60_000, perIp: 10, perEmail: 5 } as const;

export interface AttemptStore {
  countSince(key: string, since: Date): Promise<number>;
  record(key: string): Promise<void>;
  clear(key: string): Promise<void>;
}

export interface LoginUser {
  id: number;
  email: string;
  name: string;
  role: string;
  passwordHash: string;
}

export interface LoginDeps {
  store: AttemptStore;
  findUser(email: string): Promise<LoginUser | undefined>;
  compare(password: string, hash: string): Promise<boolean>;
  now?: () => Date;
}

/**
 * A valid cost-10 bcrypt hash of a random string nobody knows. Unknown emails are
 * compared against it so a miss costs the same as a wrong password.
 */
export const DUMMY_BCRYPT_HASH = "$2b$10$wo1LacV70a8lulEUdhKSOOU8QAl0EB6NF2UOB1RvjmAY4kJbrx08K";

const inputSchema = z.object({
  email: z.string().trim().min(1).max(255),
  password: z.string().min(1).max(200),
});

export function loginKeys(ip: string, email: string): { ip: string; email: string } {
  return { ip: `ip:${ip}`, email: `email:${email.trim().toLowerCase()}` };
}

export async function verifyCredentials(
  input: { email: unknown; password: unknown; ip: string },
  deps: LoginDeps
): Promise<{ id: string; email: string; name: string; role: string } | null> {
  const parsed = inputSchema.safeParse({ email: input.email, password: input.password });
  if (!parsed.success) return null;
  const email = parsed.data.email.toLowerCase();
  const { password } = parsed.data;
  const keys = loginKeys(input.ip, email);
  const { store } = deps;

  // Record first, then count: the attempt is visible to every request that counts
  // after it, so parallel requests cannot all read "under the limit" before any of
  // them has written. Attempts over the limit are rejected before the bcrypt compare.
  try {
    await Promise.all([store.record(keys.ip), store.record(keys.email)]);
    const since = new Date((deps.now?.() ?? new Date()).getTime() - LOGIN_LIMITS.windowMs);
    const [ipCount, emailCount] = await Promise.all([
      store.countSince(keys.ip, since),
      store.countSince(keys.email, since),
    ]);
    if (ipCount > LOGIN_LIMITS.perIp || emailCount > LOGIN_LIMITS.perEmail) return null;
  } catch (err) {
    console.error("login limiter unavailable:", err); // fail closed
    return null;
  }

  const user = await deps.findUser(email);
  const ok = await deps.compare(password, user?.passwordHash ?? DUMMY_BCRYPT_HASH);
  if (!ok || !user) return null;

  try {
    await store.clear(keys.email);
  } catch (err) {
    console.error("login limiter clear failed:", err);
  }
  return { id: String(user.id), email: user.email, name: user.name, role: user.role };
}
