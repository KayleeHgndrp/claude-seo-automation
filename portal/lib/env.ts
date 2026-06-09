/**
 * Centralized environment access. Server-only secrets are read lazily so the
 * app can boot (and render the login page) even if an optional provider key
 * is missing — routes fail with a clear message only when a missing key is
 * actually needed.
 */

export function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v || v.trim() === "") {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return v.trim();
}

export function optionalEnv(name: string): string | undefined {
  const v = process.env[name];
  return v && v.trim() !== "" ? v.trim() : undefined;
}

/** Default analysis/drafting model. Cost-effective; override via env. */
export const ANTHROPIC_MODEL = optionalEnv("ANTHROPIC_MODEL") ?? "claude-sonnet-4-6";

export const FIRECRAWL_BASE_URL =
  optionalEnv("FIRECRAWL_BASE_URL") ?? "https://api.firecrawl.dev";

export const LOCAL_SERP_PROVIDER =
  (optionalEnv("LOCAL_SERP_PROVIDER") ?? "serper").toLowerCase();

export const DATAFORSEO_MAX_COST_USD = Number(
  optionalEnv("DATAFORSEO_MAX_COST_USD") ?? "1.00",
);
