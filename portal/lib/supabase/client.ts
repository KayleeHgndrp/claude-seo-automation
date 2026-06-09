/**
 * Supabase browser client (used by the login page). Reads only the public
 * anon key + URL — never the service-role key.
 */

"use client";

import { createBrowserClient } from "@supabase/ssr";

export function createBrowserSupabase() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
