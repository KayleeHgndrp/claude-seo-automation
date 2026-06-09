/**
 * POST /api/outreach/send
 *
 * Sends the reviewed outreach email via SMTP (Nodemailer) and persists the
 * scan + email to Supabase when the service-role client is configured.
 * Human-in-the-loop is the default: the client only calls this after the
 * operator clicked "Versturen" (or enabled the explicit auto-send toggle).
 */

import { NextResponse } from "next/server";
import { requireUser, AuthError } from "@/lib/auth";
import { sendOutreachEmail } from "@/lib/mailer";
import { createServiceSupabase } from "@/lib/supabase/server";
import type { ScanResult } from "@/lib/scan/types";

export const runtime = "nodejs";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface SendBody {
  to?: string;
  subject?: string;
  body?: string;
  /** Optional: the full scan result to persist alongside the sent email. */
  scan?: ScanResult;
}

export async function POST(request: Request) {
  let userId: string;
  try {
    const user = await requireUser();
    userId = user.id;
  } catch (e) {
    if (e instanceof AuthError) {
      return NextResponse.json({ error: e.message }, { status: 401 });
    }
    throw e;
  }

  const payload = (await request.json().catch(() => ({}))) as SendBody;
  const to = (payload.to ?? "").trim();
  const subject = (payload.subject ?? "").trim();
  const body = (payload.body ?? "").trim();

  if (!to || !EMAIL_RE.test(to)) {
    return NextResponse.json({ error: "Ongeldig ontvanger-emailadres." }, { status: 422 });
  }
  if (!subject || !body) {
    return NextResponse.json(
      { error: "Onderwerp en body zijn verplicht." },
      { status: 422 },
    );
  }

  // 1. Send.
  let messageId: string;
  try {
    ({ messageId } = await sendOutreachEmail({ to, subject, body }));
  } catch (e) {
    return NextResponse.json(
      { error: `Versturen mislukt: ${(e as Error).message}` },
      { status: 502 },
    );
  }

  // 2. Persist (best-effort — a storage failure must not lose a sent email).
  let stored = false;
  const supabase = createServiceSupabase();
  if (supabase) {
    try {
      let scanId: string | null = null;
      if (payload.scan) {
        const { data: scanRow } = await supabase
          .from("outreach_scans")
          .insert({
            created_by: userId,
            target_url: payload.scan.request.url,
            business_name: payload.scan.request.businessName,
            city: payload.scan.request.city,
            mode: payload.scan.mode,
            detected_keyword: payload.scan.detectedKeyword,
            map_pack_position: payload.scan.findings.map_pack_position,
            findings: payload.scan.findings,
            warnings: payload.scan.warnings,
          })
          .select("id")
          .single();
        scanId = scanRow?.id ?? null;
      }
      await supabase.from("outreach_emails").insert({
        created_by: userId,
        scan_id: scanId,
        recipient: to,
        subject,
        body,
        message_id: messageId,
        status: "sent",
      });
      stored = true;
    } catch {
      stored = false; // surfaced to the client below; email already sent
    }
  }

  return NextResponse.json({ sent: true, messageId, stored });
}
