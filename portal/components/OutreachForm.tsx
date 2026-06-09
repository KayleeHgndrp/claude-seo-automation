"use client";

import { useState } from "react";
import type { ScanMode } from "@/lib/scan/types";

export interface OutreachFormValues {
  url: string;
  recipientEmail: string;
  businessName: string;
  contactName: string;
  city: string;
  primaryKeyword: string;
  mode: ScanMode;
  confirmCost: boolean;
}

const EMPTY: OutreachFormValues = {
  url: "",
  recipientEmail: "",
  businessName: "",
  contactName: "",
  city: "",
  primaryKeyword: "",
  mode: "lite",
  confirmCost: false,
};

export function OutreachForm({
  onScan,
  scanning,
}: {
  onScan: (values: OutreachFormValues) => void;
  scanning: boolean;
}) {
  const [values, setValues] = useState<OutreachFormValues>(EMPTY);

  function set<K extends keyof OutreachFormValues>(key: K, v: OutreachFormValues[K]) {
    setValues((prev) => ({ ...prev, [key]: v }));
  }

  return (
    <form
      className="card space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        onScan(values);
      }}
    >
      <h2 className="text-lg font-semibold text-navy">1 · Scan</h2>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className="label" htmlFor="url">Doel-URL</label>
          <input id="url" type="url" required className="field" placeholder="https://praktijk.nl"
            value={values.url} onChange={(e) => set("url", e.target.value)} />
        </div>
        <div>
          <label className="label" htmlFor="businessName">Bedrijfsnaam</label>
          <input id="businessName" required className="field"
            value={values.businessName} onChange={(e) => set("businessName", e.target.value)} />
        </div>
        <div>
          <label className="label" htmlFor="city">Stad</label>
          <input id="city" required className="field" placeholder="Utrecht"
            value={values.city} onChange={(e) => set("city", e.target.value)} />
        </div>
        <div>
          <label className="label" htmlFor="recipientEmail">Ontvanger-email</label>
          <input id="recipientEmail" type="email" required className="field"
            value={values.recipientEmail} onChange={(e) => set("recipientEmail", e.target.value)} />
        </div>
        <div>
          <label className="label" htmlFor="contactName">Contactpersoon (optioneel)</label>
          <input id="contactName" className="field"
            value={values.contactName} onChange={(e) => set("contactName", e.target.value)} />
        </div>
        <div>
          <label className="label" htmlFor="primaryKeyword">Primaire dienst / keyword (optioneel)</label>
          <input id="primaryKeyword" className="field" placeholder="auto-detect uit title + H1"
            value={values.primaryKeyword} onChange={(e) => set("primaryKeyword", e.target.value)} />
        </div>
        <div>
          <label className="label" htmlFor="mode">Modus</label>
          <select id="mode" className="field"
            value={values.mode} onChange={(e) => set("mode", e.target.value as ScanMode)}>
            <option value="lite">LITE — koude mail (default)</option>
            <option value="full">FULL — volledige audit + SXO</option>
            <option value="proof">PROOF — geo-grid (DataForSEO)</option>
          </select>
        </div>
      </div>

      {values.mode === "proof" && (
        <label className="flex items-start gap-2 rounded-md border border-amber/40 bg-amber/5 p-3 text-sm text-navy">
          <input type="checkbox" className="mt-0.5"
            checked={values.confirmCost} onChange={(e) => set("confirmCost", e.target.checked)} />
          <span>
            PROOF gebruikt DataForSEO-credits (7×7 geo-grid ≈ $0,10). Ik bevestig dat
            credits verbruikt mogen worden.
          </span>
        </label>
      )}

      <button type="submit" className="btn-primary" disabled={scanning}>
        {scanning ? "Scannen…" : "Scan starten"}
      </button>
    </form>
  );
}
