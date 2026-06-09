/**
 * POST /api/outreach/generate
 *
 * Turns the self-verifiable email_hooks (+ business/contact context) into a
 * short Dutch outreach email in the Studio Radixs tone-of-voice. Returns
 * { subject, body } as STRICT JSON.
 */

import { NextResponse } from "next/server";
import { requireUser, AuthError } from "@/lib/auth";
import { complete } from "@/lib/anthropic";
import { parseModelJson } from "@/lib/json";
import { EMAIL_SYSTEM_PROMPT } from "@/lib/prompts/email-system";
import type { EmailDraft } from "@/lib/scan/types";

export const runtime = "nodejs";

interface GenerateBody {
  businessName?: string;
  contactName?: string;
  city?: string;
  primaryKeyword?: string;
  emailHooks?: string[];
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

  const body = (await request.json().catch(() => ({}))) as GenerateBody;
  const hooks = Array.isArray(body.emailHooks)
    ? body.emailHooks.filter((h) => typeof h === "string" && h.trim()).slice(0, 3)
    : [];

  if (hooks.length === 0) {
    return NextResponse.json(
      { error: "Geen email_hooks om een mail van te maken. Draai eerst een scan." },
      { status: 422 },
    );
  }

  const userInput = JSON.stringify(
    {
      bedrijfsnaam: body.businessName ?? "",
      contactpersoon: body.contactName ?? "",
      stad: body.city ?? "",
      primaire_dienst: body.primaryKeyword ?? "",
      email_hooks: hooks,
    },
    null,
    2,
  );

  try {
    const raw = await complete({
      system: EMAIL_SYSTEM_PROMPT,
      user: userInput,
      maxTokens: 1200,
      temperature: 0.6,
    });
    const parsed = parseModelJson<EmailDraft>(raw);
    if (!parsed.ok || !parsed.data.subject || !parsed.data.body) {
      return NextResponse.json(
        { error: "Kon geen geldige concept-mail genereren. Probeer opnieuw." },
        { status: 502 },
      );
    }
    return NextResponse.json({
      subject: parsed.data.subject,
      body: parsed.data.body,
    } satisfies EmailDraft);
  } catch (e) {
    return NextResponse.json(
      { error: `Email-generatie mislukt: ${(e as Error).message}` },
      { status: 502 },
    );
  }
}
