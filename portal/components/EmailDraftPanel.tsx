"use client";

import { useState } from "react";

export interface EmailDraftState {
  subject: string;
  body: string;
}

export function EmailDraftPanel({
  recipient,
  draft,
  onChange,
  onSend,
  sending,
  sendResult,
}: {
  recipient: string;
  draft: EmailDraftState;
  onChange: (d: EmailDraftState) => void;
  onSend: () => void;
  sending: boolean;
  sendResult: string | null;
}) {
  // Human-in-the-loop is the default: the operator reviews + edits, then sends.
  const [confirmSend, setConfirmSend] = useState(false);

  return (
    <div className="card space-y-4">
      <h2 className="text-lg font-semibold text-navy">3 · Concept-mail (review)</h2>
      <p className="text-sm text-navy/60">Naar: {recipient}</p>

      <div>
        <label className="label" htmlFor="subject">Onderwerp</label>
        <input
          id="subject"
          className="field"
          value={draft.subject}
          onChange={(e) => onChange({ ...draft, subject: e.target.value })}
        />
      </div>
      <div>
        <label className="label" htmlFor="body">Body</label>
        <textarea
          id="body"
          rows={12}
          className="field font-serif leading-relaxed"
          value={draft.body}
          onChange={(e) => onChange({ ...draft, body: e.target.value })}
        />
      </div>

      <label className="flex items-center gap-2 text-sm text-navy/80">
        <input
          type="checkbox"
          checked={confirmSend}
          onChange={(e) => setConfirmSend(e.target.checked)}
        />
        Ik heb de mail nagelezen en wil hem versturen.
      </label>

      <div className="flex items-center gap-3">
        <button
          type="button"
          className="btn-primary"
          disabled={!confirmSend || sending || !draft.subject || !draft.body}
          onClick={onSend}
        >
          {sending ? "Versturen…" : "Versturen"}
        </button>
        {sendResult && <span className="text-sm text-forest">{sendResult}</span>}
      </div>
    </div>
  );
}
