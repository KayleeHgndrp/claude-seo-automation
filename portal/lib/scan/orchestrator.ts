/**
 * Scan orchestrator. Collects data from the configured sources (Firecrawl,
 * LocalSerpProvider, Places, optional DataForSEO geo-grid), then sends
 * everything to Claude with the seo-local methodology as the system prompt and
 * parses STRICT JSON back.
 *
 * Modes:
 *   LITE  — map-pack position + GBP completeness + NAP consistency + schema
 *           gaps; 1 local-pack call. Default for cold mail.
 *   FULL  — adds the extended seo-local audit + a light SXO lens.
 *   PROOF — adds the DataForSEO geo-grid (only after the cost gate passed).
 *
 * Error handling mirrors the error tables in the seo-local / seo-sxo / seo-maps
 * skills (fetch-fail, no keyword, no GBP, JS-rendered, empty SERP).
 */

import { scrapeAndParse, detectKeyword, FirecrawlError } from "../firecrawl";
import { lookupGbp } from "../places";
import { getLocalSerpProvider } from "../serp";
import { DataForSeoProvider } from "../serp/dataforseo";
import { estimateGeoGrid } from "../cost";
import { DATAFORSEO_MAX_COST_USD } from "../env";
import { complete } from "../anthropic";
import { parseModelJson } from "../json";
import { buildLocalSystemPrompt } from "../prompts/seo-local-system";
import type {
  ScanRequest,
  ScanResult,
  Findings,
  PageSignals,
  MapPackResult,
  GbpSignals,
  GeoGridResult,
} from "./types";

export class ScanError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.name = "ScanError";
    this.status = status;
  }
}

/** Build the user message handed to Claude alongside the system prompt. */
function buildAnalysisInput(args: {
  req: ScanRequest;
  keyword: string;
  page: PageSignals;
  mapPack: MapPackResult | null;
  gbp: GbpSignals | null;
  geoGrid: GeoGridResult | null;
}): string {
  const { req, keyword, page, mapPack, gbp, geoGrid } = args;
  return JSON.stringify(
    {
      business: {
        name: req.businessName,
        city: req.city,
        primary_service_keyword: keyword,
        business_type_detected: page.businessType,
      },
      website_signals: {
        final_url: page.finalUrl,
        title: page.title,
        h1: page.h1,
        meta_description: page.metaDescription,
        headings: page.headings,
        nap_from_page: page.nap,
        local_business_schema_types: page.localBusinessTypes,
        json_ld_blocks: page.jsonLd,
        content_excerpt: page.contentExcerpt,
      },
      map_pack: mapPack,
      gbp_from_places: gbp,
      geo_grid_proof: geoGrid,
    },
    null,
    2,
  );
}

function fallbackFindings(message: string): Findings {
  return {
    map_pack_position: null,
    gbp_issues: [],
    nap_consistency: { consistent: false, issues: [] },
    schema_gaps: [],
    email_hooks: [],
    limitations: [message],
  };
}

export async function runScan(req: ScanRequest): Promise<ScanResult> {
  const warnings: string[] = [];

  // 1. Render + parse the target site (SSRF-guarded inside scrapeAndParse).
  let page: PageSignals;
  try {
    page = await scrapeAndParse(req.url);
  } catch (e) {
    if (e instanceof FirecrawlError) {
      throw new ScanError(
        `Kon de doelsite niet ophalen of renderen: ${e.message}. Controleer de URL en probeer opnieuw.`,
        502,
      );
    }
    throw new ScanError((e as Error).message, 400);
  }

  // JS-rendered / empty content guard (seo-sxo error table).
  if (page.contentExcerpt.length < 120) {
    warnings.push(
      "Weinig content na rendering — mogelijk een zwaar JS-gerenderde pagina. Analyse op basis van beschikbare HTML.",
    );
  }

  // 2. Keyword: explicit or auto-detected from title+H1 overlap.
  const keyword = (req.primaryKeyword?.trim() || detectKeyword(page) || "").trim();
  if (!keyword) {
    throw new ScanError(
      "Geen primaire dienst/keyword opgegeven en niet automatisch af te leiden uit title/H1. Geef een keyword op.",
      422,
    );
  }

  // 3. Map-pack position (one local-pack call).
  let mapPack: MapPackResult | null = null;
  try {
    mapPack = await getLocalSerpProvider().getMapPack({
      service: keyword,
      city: req.city,
      businessName: req.businessName,
    });
    if (mapPack.totalResults === 0) {
      warnings.push(
        "Lege local-pack respons voor deze zoekopdracht — geen map-pack-positie te bepalen.",
      );
    }
  } catch (e) {
    warnings.push(`Local-pack lookup mislukt: ${(e as Error).message}`);
  }

  // 4. GBP signals via Places (optional source).
  let gbp: GbpSignals | null = null;
  try {
    gbp = await lookupGbp(req.businessName, req.city);
    if (!gbp.found) {
      warnings.push(
        "Geen GBP-profiel gevonden via Places (of geen Places-key geconfigureerd). GBP-signalen beperkt beoordeeld.",
      );
    }
  } catch (e) {
    warnings.push(`Places lookup mislukt: ${(e as Error).message}`);
  }

  // 5. PROOF: geo-grid (only after the cost gate passed in the route).
  let geoGrid: GeoGridResult | null = null;
  if (req.mode === "proof") {
    const estimate = estimateGeoGrid(7);
    if (!req.confirmCost) {
      throw new ScanError(
        `PROOF-modus gebruikt DataForSEO-credits (geschat $${estimate.estimatedCostUsd} voor ${estimate.points} punten). Bevestig de kosten eerst.`,
        402,
      );
    }
    if (estimate.estimatedCostUsd > DATAFORSEO_MAX_COST_USD) {
      throw new ScanError(
        `Geschatte kosten $${estimate.estimatedCostUsd} overschrijden het maximum $${DATAFORSEO_MAX_COST_USD}. Verlaag de grid of verhoog DATAFORSEO_MAX_COST_USD.`,
        402,
      );
    }
    // Geocode center from the GBP address if available; otherwise we cannot
    // anchor the grid and degrade gracefully.
    const center = await geocodeCity(req.city);
    if (!center) {
      warnings.push("Kon het gridcentrum niet geocoderen — geo-grid overgeslagen.");
    } else {
      try {
        geoGrid = await new DataForSeoProvider().getGeoGrid({
          service: keyword,
          city: req.city,
          businessName: req.businessName,
          centerLat: center.lat,
          centerLng: center.lng,
        });
      } catch (e) {
        warnings.push(`Geo-grid scan mislukt: ${(e as Error).message}`);
      }
    }
  }

  // 6. Analysis via Claude with the seo-local methodology as system prompt.
  const system = buildLocalSystemPrompt(req.mode);
  const userInput = buildAnalysisInput({ req, keyword, page, mapPack, gbp, geoGrid });
  const maxTokens = req.mode === "lite" ? 3000 : 5000;

  let findings: Findings;
  try {
    const raw = await complete({ system, user: userInput, maxTokens });
    const parsed = parseModelJson<Findings>(raw);
    if (parsed.ok) {
      findings = normalizeFindings(parsed.data, mapPack);
    } else {
      warnings.push("Kon de analyse-JSON niet parsen; toon beperkte resultaten.");
      findings = fallbackFindings("Analyse-model gaf geen geldige JSON terug.");
    }
  } catch (e) {
    throw new ScanError(`Analyse via Anthropic mislukt: ${(e as Error).message}`, 502);
  }

  return {
    mode: req.mode,
    request: req,
    detectedKeyword: keyword,
    page,
    mapPack,
    gbp,
    geoGrid,
    findings,
    warnings,
  };
}

/** Fill in defensive defaults so the UI never reads undefined fields. */
function normalizeFindings(f: Partial<Findings>, mapPack: MapPackResult | null): Findings {
  return {
    map_pack_position:
      typeof f.map_pack_position === "number"
        ? f.map_pack_position
        : mapPack?.position ?? null,
    gbp_issues: Array.isArray(f.gbp_issues) ? f.gbp_issues : [],
    nap_consistency: {
      consistent: Boolean(f.nap_consistency?.consistent),
      issues: Array.isArray(f.nap_consistency?.issues) ? f.nap_consistency!.issues : [],
    },
    schema_gaps: Array.isArray(f.schema_gaps) ? f.schema_gaps : [],
    email_hooks: Array.isArray(f.email_hooks) ? f.email_hooks.slice(0, 3) : [],
    full_audit: f.full_audit,
    limitations: Array.isArray(f.limitations) ? f.limitations : [],
  };
}

/**
 * Minimal city geocode via Nominatim (free, used by seo-maps Tier 0). Returns
 * null on any failure. Only used to anchor the PROOF geo-grid.
 */
async function geocodeCity(city: string): Promise<{ lat: number; lng: number } | null> {
  try {
    const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(
      city + ", Netherlands",
    )}`;
    const resp = await fetch(url, {
      headers: { "User-Agent": "claude-seo-outreach-portal/0.1 (local SEO scan)" },
    });
    if (!resp.ok) return null;
    const data = (await resp.json()) as { lat: string; lon: string }[];
    if (!data.length) return null;
    return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
  } catch {
    return null;
  }
}
