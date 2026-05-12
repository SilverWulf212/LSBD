// Minimal in-memory sliding-window rate limiter.
//
// Acceptable for this small site's traffic profile. State is per-process,
// so on Vercel each serverless instance has its own window. For stricter
// guarantees we can swap to Vercel KV / Upstash without touching the
// call-site signature.

type Window = { timestamps: number[] };

const windows = new Map<string, Window>();

export interface RateLimitResult {
  ok: boolean;
  remaining: number;
  resetAt: number; // ms epoch
}

export function rateLimit(
  key: string,
  limit: number,
  windowMs: number,
  now: number = Date.now()
): RateLimitResult {
  const cutoff = now - windowMs;
  let w = windows.get(key);
  if (!w) {
    w = { timestamps: [] };
    windows.set(key, w);
  }
  // Drop timestamps outside the window.
  while (w.timestamps.length > 0 && w.timestamps[0] < cutoff) {
    w.timestamps.shift();
  }

  if (w.timestamps.length >= limit) {
    return {
      ok: false,
      remaining: 0,
      resetAt: w.timestamps[0] + windowMs,
    };
  }

  w.timestamps.push(now);
  return {
    ok: true,
    remaining: Math.max(0, limit - w.timestamps.length),
    resetAt: now + windowMs,
  };
}
