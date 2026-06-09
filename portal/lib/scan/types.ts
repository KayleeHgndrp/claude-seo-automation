/**
 * Shared types for the outreach scan pipeline. The Findings shape mirrors the
 * STRICT JSON contract the task specifies that Claude must return.
 */

export type ScanMode = "lite" | "full" | "proof";

export interface ScanRequest {
  url: string;
  recipientEmail: string;
  businessName: string;
  contactName?: string;
  city: string;
  /** Primary service / keyword. Optional — auto-detected if omitted. */
  primaryKeyword?: string;
  mode: ScanMode;
  /** PROOF only: explicit acknowledgement that DataForSEO credits may be spent. */
  confirmCost?: boolean;
}

/** Parsed signals extracted from the rendered target page (Firecrawl). */
export interface PageSignals {
  finalUrl: string;
  title: string | null;
  h1: string | null;
  metaDescription: string | null;
  headings: string[];
  /** NAP extracted from visible HTML. */
  nap: { name?: string; address?: string; phone?: string };
  /** Raw JSON-LD blocks found on the page. */
  jsonLd: unknown[];
  /** Detected LocalBusiness @type values (incl. subtypes), if any. */
  localBusinessTypes: string[];
  /** First ~6000 chars of rendered text content for the model. */
  contentExcerpt: string;
  businessType: "brick-and-mortar" | "sab" | "hybrid" | "unknown";
}

/** Local-pack position result from a LocalSerpProvider. */
export interface MapPackResult {
  provider: string;
  query: string;
  /** 1-based rank in the local/map pack, or null if not found in top results. */
  position: number | null;
  totalResults: number;
  topCompetitors: { name: string; rating?: number; reviews?: number }[];
}

/** Google Business Profile signals from Places Details (optional source). */
export interface GbpSignals {
  found: boolean;
  placeId?: string;
  name?: string;
  primaryCategory?: string;
  categories?: string[];
  rating?: number;
  reviewCount?: number;
  photoCount?: number;
  website?: string;
  phone?: string;
  address?: string;
  hasHours?: boolean;
}

/** Geo-grid PROOF result (DataForSEO). */
export interface GeoGridResult {
  keyword: string;
  gridSize: number;
  radiusKm: number;
  solvPercent: number; // Share of Local Voice
  averageRank: number | null;
  points: { lat: number; lng: number; rank: number | null }[];
  estimatedCostUsd: number;
}

/** STRICT JSON shape returned by the analysis model. */
export interface Findings {
  map_pack_position: number | null;
  gbp_issues: string[];
  nap_consistency: {
    consistent: boolean;
    issues: string[];
  };
  schema_gaps: string[];
  email_hooks: string[];
  /** FULL mode only: extended seo-local audit narrative + scores. */
  full_audit?: {
    local_seo_score: number | null;
    dimension_scores?: Record<string, string>;
    top_actions: string[];
    sxo?: {
      page_type_verdict: string;
      mismatch_severity: string;
      notes: string;
    };
  };
  /** Honest note on what could NOT be assessed (ported from skill outputs). */
  limitations: string[];
}

export interface ScanResult {
  mode: ScanMode;
  request: ScanRequest;
  detectedKeyword: string;
  page: PageSignals;
  mapPack: MapPackResult | null;
  gbp: GbpSignals | null;
  geoGrid: GeoGridResult | null;
  findings: Findings;
  /** Non-fatal warnings surfaced from individual data sources. */
  warnings: string[];
}

export interface EmailDraft {
  subject: string;
  body: string;
}
