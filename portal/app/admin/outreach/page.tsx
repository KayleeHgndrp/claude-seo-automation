"use client";

import { useState } from "react";
import { OutreachForm, type OutreachFormValues } from "@/components/OutreachForm";
import { FindingsPanel } from "@/components/FindingsPanel";
import { EmailDraftPanel, type EmailDraftState } from "@/components/EmailDraftPanel";
import type { ScanResult } from "@/lib/scan/types";

export default function OutreachPage() {
  const [scanning, setScanning] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [scan, setScan] = useState<ScanResult | null>(null);
  const [recipient, setRecipient] = useState("");
  const [draft, setDraft] = useState<EmailDraftState | null>(null);
  const [sendResult, setSendResult] = useState<string | null>(null);

  // Auto-send is OFF by default — human-in-the-loop review is the default flow.
  const [autoSend, setAutoSend] = useState(false);

  async function generateEmail(s: ScanResult): Promise<EmailDraftState | null> {
    setGenerating(true);
    try {
      const resp = await fetch("/api/outreach/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          businessName: s.request.businessName,
          contactName: s.request.contactName,
          city: s.request.city,
          primaryKeyword: s.detectedKeyword,
          emailHooks: s.findings.email_hooks,
        }),
      });
      const data = await resp.json();
      if (!resp.ok) {
        setError(data.error ?? "Email-generatie mislukt.");
        return null;
      }
      const d: EmailDraftState = { subject: data.subject, body: data.body };
      setDraft(d);
      return d;
    } catch (e) {
      setError((e as Error).message);
      return null;
    } finally {
      setGenerating(false);
    }
  }

  async function send(d: EmailDraftState, to: string, s: ScanResult) {
    setSending(true);
    setSendResult(null);
    try {
      const resp = await fetch("/api/outreach/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to, subject: d.subject, body: d.body, scan: s }),
      });
      const data = await resp.json();
      if (!resp.ok) {
        setError(data.error ?? "Versturen mislukt.");
        return;
      }
      setSendResult(
        data.stored ? "Verstuurd en opgeslagen ✓" : "Verstuurd ✓ (niet opgeslagen)",
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSending(false);
    }
  }

  async function onScan(values: OutreachFormValues) {
    setScanning(true);
    setError(null);
    setScan(null);
    setDraft(null);
    setSendResult(null);
    setRecipient(values.recipientEmail);

    try {
      const resp = await fetch("/api/outreach/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const data = await resp.json();
      if (!resp.ok) {
        setError(data.error ?? "Scan mislukt.");
        return;
      }
      const s = data as ScanResult;
      setScan(s);

      const d = await generateEmail(s);
      if (d && autoSend) {
        // Explicit opt-in only: auto-send fires without the manual review click.
        await send(d, values.recipientEmail, s);
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setScanning(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-navy">Lokale-SEO outreach</h1>
          <p className="text-sm text-navy/60">
            Scan een lokale dienstverlener en stel een outreach-mail op met
            zelf-verifieerbare haakjes.
          </p>
        </div>
        <label className="flex items-center gap-2 text-sm text-navy/70">
          <input
            type="checkbox"
            checked={autoSend}
            onChange={(e) => setAutoSend(e.target.checked)}
          />
          Auto-verzenden (zonder review)
        </label>
      </div>

      {error && (
        <div className="rounded-md border border-danger/40 bg-danger/5 p-3 text-sm text-danger">
          {error}
        </div>
      )}

      <OutreachForm onScan={onScan} scanning={scanning || generating} />

      {scan && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <FindingsPanel scan={scan} />
          {draft ? (
            <EmailDraftPanel
              recipient={recipient}
              draft={draft}
              onChange={setDraft}
              onSend={() => send(draft, recipient, scan)}
              sending={sending}
              sendResult={sendResult}
            />
          ) : (
            <div className="card text-sm text-navy/60">
              {generating ? "Concept-mail genereren…" : "Nog geen concept-mail."}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
