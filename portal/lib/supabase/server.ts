/**
 * Supabase server clients.
 *
 * - createServerSupabase(): SSR client bound to the request cookies, used for
 *   auth (reading the logged-in user) in Server Components / route handlers.
 * - createServiceSupabase(): service-role client for server-only writes
 *   (persisting scans/emails) that bypass RLS. NEVER expose the service key
 *   to the browser.
 */

import { cookies } from "next/headers";
import { createServerClient, type CookieOptions } from "@supabase/ssr";

type CookieToSet = { name: string; value: string; options?: CookieOptions };
import { createClient } from "@supabase/supabase-js";
import { requireEnv, optionalEnv } from "../env";

export async function createServerSupabase() {
  const cookieStore = await cookies();
  return createServerClient(
    requireEnv("NEXT_PUBLIC_SUPABASE_URL"),
    requireEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: CookieToSet[]) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // setAll called from a Server Component — safe to ignore; the
            // middleware refreshes the session cookie.
          }
        },
      },
    },
  );
}

/** Returns a service-role client, or null if the key isn't configured. */
export function createServiceSupabase() {
  const url = optionalEnv("NEXT_PUBLIC_SUPABASE_URL");
  const key = optionalEnv("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
