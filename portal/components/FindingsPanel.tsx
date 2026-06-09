"use client";

import type { ScanResult } from "@/lib/scan/types";

function List({ items, empty }: { items: string[]; empty: string }) {
  if (!items.length) return <p className="text-sm text-navy/50">{empty}</p>;
  return (
    <ul className="list-disc space-y-1 pl-5 text-sm text-navy/80">
      {items.map((it, i) => (
        <li key={i}>{it}</li>
      ))}
    </ul>
  );
}

export function FindingsPanel({ scan }: { scan: ScanResult }) {
  const f = scan.findings;
  return (
    <div className="card space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-navy">2 · Bevindingen</h2>
        <span className="rounded-full bg-navy px-3 py-1 text-xs font-semibold uppercase text-white">
          {scan.mode}
        </span>
      </div>

      <p className="text-sm text-navy/60">
        Keyword: <strong className="text-navy">{scan.detectedKeyword}</strong>
        {" · "}Type: {scan.page.businessType}
      </p>

      <div>
        <h3 className="label">Map-pack-positie</h3>
        <p className="text-sm text-navy/80">
          {f.map_pack_position === null
            ? `Niet in de top resultaten voor "${scan.mapPack?.query ?? scan.detectedKeyword}".`
            : `#${f.map_pack_position} voor "${scan.mapPack?.query ?? scan.detectedKeyword}".`}
        </p>
      </div>

      <div>
        <h3 className="label">GBP-issues</h3>
        <List items={f.gbp_issues} empty="Geen GBP-issues gerapporteerd." />
      </div>

      <div>
        <h3 className="label">
          NAP-consistentie {f.nap_consistency.consistent ? "✓ consistent" : "✗ afwijkingen"}
        </h3>
        <List items={f.nap_consistency.issues} empty="Geen NAP-afwijkingen gevonden." />
      </div>

      <div>
        <h3 className="label">Schema-gaps</h3>
        <List items={f.schema_gaps} empty="Geen schema-gaps gerapporteerd." />
      </div>

      <div>
        <h3 className="label">Email-haakjes (zelf-verifieerbaar)</h3>
        <List items={f.email_hooks} empty="Geen haakjes gegenereerd." />
      </div>

      {f.full_audit && (
        <div className="rounded-md border border-navy/10 bg-cream p-4">
          <h3 className="label">FULL-audit</h3>
          <p className="text-sm text-navy/80">
            Local SEO score: <strong>{f.full_audit.local_seo_score ?? "n.v.t."}</strong>
          </p>
          {f.full_audit.sxo && (
            <p className="mt-1 text-sm text-navy/70">
              SXO: {f.full_audit.sxo.page_type_verdict} ({f.full_audit.sxo.mismatch_severity}) —{" "}
              {f.full_audit.sxo.notes}
            </p>
          )}
          <div className="mt-2">
            <h4 className="label">Top-acties</h4>
            <List items={f.full_audit.top_actions} empty="—" />
          </div>
        </div>
      )}

      {scan.geoGrid && (
        <div className="rounded-md border border-navy/10 bg-cream p-4 text-sm text-navy/80">
          <h3 className="label">PROOF · geo-grid</h3>
          <p>
            SoLV: <strong>{scan.geoGrid.solvPercent}%</strong> · gem. rank:{" "}
            {scan.geoGrid.averageRank ?? "n.v.t."} · {scan.geoGrid.gridSize}×
            {scan.geoGrid.gridSize} @ {scan.geoGrid.radiusKm}km · est. $
            {scan.geoGrid.estimatedCostUsd}
          </p>
        </div>
      )}

      {f.limitations.length > 0 && (
        <div>
          <h3 className="label">Beperkingen</h3>
          <List items={f.limitations} empty="—" />
        </div>
      )}

      {scan.warnings.length > 0 && (
        <div className="rounded-md border border-amber/40 bg-amber/5 p-3">
          <h3 className="label text-amber">Waarschuwingen</h3>
          <List items={scan.warnings} empty="—" />
        </div>
      )}
    </div>
  );
}
