import { createClient } from "@supabase/supabase-js";

// Server-side anonymous Supabase client for the public /verify route.
// Uses the anon JWT, so all reads pass through the RLS policies + grants
// set up in drizzle/0002_rls.sql — only public.public_licensee is visible.
//
// Realtime is unused; persistSession off because each request gets its own
// instance on Vercel's serverless runtime.

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !key) {
  throw new Error(
    "NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY must be set."
  );
}

export const supabaseAnon = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});
