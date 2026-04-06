import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

if (!url || !anonKey) {
  console.error(
    "[supabase] Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY. Copy both from Supabase Dashboard → Project Settings → API (same project)."
  );
}

/**
 * Single browser-wide Supabase client. Import this everywhere instead of calling createClient()
 * so you avoid "Multiple GoTrueClient instances" and broken auth/session behavior.
 */
export const supabase = createClient(url ?? "", anonKey ?? "");
