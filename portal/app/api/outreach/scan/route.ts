/**
 * POST /api/outreach/scan
 *
 * Renders + parses the target site (Firecrawl, SSRF-guarded), fetches the
 * map-pack position (LocalSerpProvider) and GBP signals (Places), optionally
 * runs the DataForSEO geo-grid (PROOF, behind a cost gate), then analyzes
 * everything with Claude using the seo-local methodology and returns the
 * STRICT-JSON findings.
 */

import { NextResponse } from "next/server";
import { requireUser, AuthError } from "@/lib/auth";
import { validateUrl, URLSafetyError } from "@/lib/ssrf";
import { runScan, ScanError } from "@/lib/scan/orchestrator";
import type { ScanMode, ScanRequest } from "@/lib/scan/types";

export const runtime = "nodejs";
export const maxDuration = 120;

const MODES: ScanMode[] = ["lite", "full", "proof"];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function parseBody(raw: unknown): ScanRequest {
  const b = (raw ?? {}) as Record<string, unknown>;
  const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");

  const url = str(b.url);
  const recipientEmail = str(b.recipientEmail);
  const businessName = str(b.businessName);
  const city = str(b.city);
  const mode = (str(b.mode).toLowerCase() || "lite") as ScanMode;

  if (!url) throw new ScanError("Doel-URL is verplicht.", 422);
  if (!recipientEmail || !EMAIL_RE.test(recipientEmail)) {
    throw new ScanError("Geldig ontvanger-emailadres is verplicht.", 422);
  }
  if (!businessName) throw new ScanError("Bedrijfsnaam is verplicht.", 422);
  if (!city) throw new ScanError("Stad is verplicht.", 422);
  if (!MODES.includes(mode)) throw new ScanError(`Onbekende modus: ${mode}.`, 422);

  // SSRF pre-check (synchronous). assertUrlSafe() runs again before fetch.
  try {
    validateUrl(url);
  } catch (e) {
    if (e instanceof URLSafetyError) throw new ScanError(e.message, 400);
    throw e;
  }

  return {
    url,
    recipientEmail,
    businessName,
    contactName: str(b.contactName) || undefined,
    city,
    primaryKeyword: str(b.primaryKeyword) || undefined,
    mode,
    confirmCost: Boolean(b.confirmCost),
  };
}

export async function POST(request: Request) {
  try {
    await requireUser();
  } catch (e) {
    if (e instanceof AuthError) {
      return NextResponse.json({ error: e.message }, { status: 401 });
    }
    throw e;
  }

  let req: ScanRequest;
  try {
    req = parseBody(await request.json().catch(() => ({})));
  } catch (e) {
    if (e instanceof ScanError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    return NextResponse.json({ error: "Ongeldige aanvraag." }, { status: 400 });
  }

  try {
    const result = await runScan(req);
    return NextResponse.json(result);
  } catch (e) {
    if (e instanceof ScanError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    return NextResponse.json(
      { error: `Scan mislukt: ${(e as Error).message}` },
      { status: 500 },
    );
  }
}
