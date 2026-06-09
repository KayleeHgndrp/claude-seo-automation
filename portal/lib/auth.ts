/**
 * Server-side auth guard for route handlers. Returns the authenticated user
 * or throws a 401-style ScanError-compatible object. The /admin pages are
 * also gated by middleware.ts; this protects the API surface directly.
 */

import { createServerSupabase } from "./supabase/server";

export class AuthError extends Error {
  status = 401;
}

export async function requireUser() {
  const supabase = await createServerSupabase();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) {
    throw new AuthError("Niet ingelogd.");
  }
  return user;
}
