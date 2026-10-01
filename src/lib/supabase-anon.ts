import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Server-side anonymous Supabase client for the public /verify route.
// Uses the anon JWT, so all reads pass through the RLS policies + grants
// set up in drizzle/0002_rls.sql — only public.public_licensee is visible.
//
// Realtime is unused; persistSession off because each request gets its own
// instance on Vercel's serverless runtime.
//
// Lazy: created on first use, never at import, so `next build` does not crash
// when the env vars are unset; the first request then fails with a clear error.

let instance: SupabaseClient | null = null;

function getClient(): SupabaseClient {
  if (instance) return instance;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY must be set."
    );
  }
  instance = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return instance;
}

export const supabaseAnon: SupabaseClient = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    const real = getClient();
    const value = Reflect.get(real, prop, real);
    return typeof value === "function" ? value.bind(real) : value;
  },
});
