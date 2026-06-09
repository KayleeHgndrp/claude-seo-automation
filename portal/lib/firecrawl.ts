/**
 * Firecrawl integration: render the target site (JS-aware) and parse the
 * local-SEO signals the seo-local methodology needs — NAP, LocalBusiness
 * schema + subtype, title/H1/headings, business-type detection.
 *
 * SSRF: the target URL is validated with assertUrlSafe() BEFORE we hand it to
 * Firecrawl, per the task's "SSRF-guard on all URL input, also for Firecrawl".
 */

import { assertUrlSafe } from "./ssrf";
import { requireEnv, FIRECRAWL_BASE_URL } from "./env";
import type { PageSignals } from "./scan/types";

export class FirecrawlError extends Error {}

interface FirecrawlScrapeResponse {
  success?: boolean;
  data?: {
    markdown?: string;
    html?: string;
    rawHtml?: string;
    metadata?: {
      title?: string;
      description?: string;
      sourceURL?: string;
      url?: string;
      statusCode?: number;
    };
  };
  error?: string;
}

/** Pull all JSON-LD blocks out of raw HTML. */
function extractJsonLd(html: string): unknown[] {
  const blocks: unknown[] = [];
  const re = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    try {
      blocks.push(JSON.parse(m[1].trim()));
    } catch {
      // ignore malformed JSON-LD — surfaced later as a schema gap
    }
  }
  return blocks;
}

/** Flatten @graph / arrays and collect all LocalBusiness-ish @type values. */
function collectLocalBusinessTypes(jsonLd: unknown[]): string[] {
  const types = new Set<string>();
  const LOCAL_HINTS = [
    "LocalBusiness", "Restaurant", "CafeOrCoffeeShop", "BarOrPub", "Bakery",
    "MedicalClinic", "Hospital", "Dentist", "Physician", "LegalService",
    "Plumber", "Electrician", "HVACBusiness", "RoofingContractor",
    "GeneralContractor", "HousePainter", "Locksmith", "MovingCompany",
    "RealEstateAgent", "AutoDealer", "AutoRepair", "BeautySalon", "DaySpa",
    "Store", "ProfessionalService", "HealthAndBeautyBusiness", "Optician",
  ];
  const visit = (node: unknown) => {
    if (Array.isArray(node)) return node.forEach(visit);
    if (node && typeof node === "object") {
      const obj = node as Record<string, unknown>;
      const t = obj["@type"];
      const typeList = Array.isArray(t) ? t : t ? [t] : [];
      for (const ty of typeList) {
        if (typeof ty === "string" && LOCAL_HINTS.some((h) => ty.includes(h))) {
          types.add(ty);
        }
      }
      if (obj["@graph"]) visit(obj["@graph"]);
      Object.values(obj).forEach(visit);
    }
  };
  jsonLd.forEach(visit);
  return [...types];
}

/** Best-effort NAP extraction from rendered HTML + schema. */
function extractNap(html: string, jsonLd: unknown[]): PageSignals["nap"] {
  const nap: PageSignals["nap"] = {};

  // Phone: tel: links are the strongest signal (click-to-call).
  const tel = html.match(/href=["']tel:([^"']+)["']/i);
  if (tel) nap.phone = tel[1].trim();

  // Address / name from the first LocalBusiness-ish schema block.
  const visit = (node: unknown): boolean => {
    if (Array.isArray(node)) return node.some(visit);
    if (node && typeof node === "object") {
      const obj = node as Record<string, unknown>;
      const addr = obj["address"];
      if (typeof obj["name"] === "string" && !nap.name) nap.name = obj["name"];
      if (typeof obj["telephone"] === "string" && !nap.phone) {
        nap.phone = obj["telephone"] as string;
      }
      if (addr && typeof addr === "object") {
        const a = addr as Record<string, unknown>;
        const parts = [
          a["streetAddress"], a["postalCode"], a["addressLocality"], a["addressRegion"],
        ].filter((p) => typeof p === "string");
        if (parts.length && !nap.address) nap.address = parts.join(", ");
      } else if (typeof addr === "string" && !nap.address) {
        nap.address = addr;
      }
      if (obj["@graph"]) visit(obj["@graph"]);
      return Object.values(obj).some(visit);
    }
    return false;
  };
  jsonLd.forEach(visit);
  return nap;
}

function detectBusinessType(text: string, nap: PageSignals["nap"]): PageSignals["businessType"] {
  const t = text.toLowerCase();
  const hasAddress = Boolean(nap.address) || /\b\d{4}\s?[a-z]{2}\b/i.test(text); // crude NL postcode
  const sab = /(serving|service area|wij komen|aan huis|we come to you|mobiele?|on-site)/i.test(t);
  if (hasAddress && sab) return "hybrid";
  if (hasAddress) return "brick-and-mortar";
  if (sab) return "sab";
  return "unknown";
}

function extractHeadings(html: string): string[] {
  const heads: string[] = [];
  const re = /<h([1-3])[^>]*>([\s\S]*?)<\/h\1>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null && heads.length < 40) {
    const text = m[2].replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
    if (text) heads.push(text);
  }
  return heads;
}

function firstH1(html: string): string | null {
  const m = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  return m ? m[1].replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim() : null;
}

/**
 * Render + parse the target page. Validates the URL (SSRF) first.
 * Throws FirecrawlError on fetch/render failure.
 */
export async function scrapeAndParse(rawUrl: string): Promise<PageSignals> {
  await assertUrlSafe(rawUrl); // SSRF guard before any network call to the target

  const apiKey = requireEnv("FIRECRAWL_API_KEY");
  let resp: Response;
  try {
    resp = await fetch(`${FIRECRAWL_BASE_URL}/v1/scrape`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        url: rawUrl,
        formats: ["markdown", "rawHtml"],
        onlyMainContent: false,
        waitFor: 2500, // allow JS-rendered content to settle
        timeout: 45000,
      }),
    });
  } catch (e) {
    throw new FirecrawlError(`Could not reach Firecrawl: ${(e as Error).message}`);
  }

  if (!resp.ok) {
    const detail = await resp.text().catch(() => "");
    throw new FirecrawlError(
      `Firecrawl render failed (HTTP ${resp.status}). ${detail.slice(0, 300)}`,
    );
  }

  const json = (await resp.json()) as FirecrawlScrapeResponse;
  if (json.success === false || !json.data) {
    throw new FirecrawlError(json.error ?? "Firecrawl returned no data for this URL.");
  }

  const html = json.data.rawHtml ?? json.data.html ?? "";
  const markdown = json.data.markdown ?? "";
  const meta = json.data.metadata ?? {};
  const jsonLd = extractJsonLd(html);
  const nap = extractNap(html, jsonLd);
  const text = markdown || html.replace(/<[^>]+>/g, " ");

  return {
    finalUrl: meta.sourceURL ?? meta.url ?? rawUrl,
    title: meta.title ?? null,
    h1: firstH1(html),
    metaDescription: meta.description ?? null,
    headings: extractHeadings(html),
    nap,
    jsonLd,
    localBusinessTypes: collectLocalBusinessTypes(jsonLd),
    contentExcerpt: text.replace(/\s+/g, " ").trim().slice(0, 6000),
    businessType: detectBusinessType(text, nap),
  };
}

/**
 * Auto-detect the primary service keyword from title + H1 overlap, with a
 * schema/heading fallback. Mirrors the seo-sxo "extract primary keyword from
 * title tag + H1 overlap" rule.
 */
export function detectKeyword(page: PageSignals): string | null {
  const norm = (s: string | null) =>
    (s ?? "").toLowerCase().replace(/[|·•\-–—:]/g, " ").replace(/\s+/g, " ").trim();
  const titleWords = new Set(norm(page.title).split(" ").filter((w) => w.length > 3));
  const h1Words = norm(page.h1).split(" ").filter((w) => w.length > 3);
  const overlap = h1Words.filter((w) => titleWords.has(w));
  if (overlap.length) return overlap.join(" ");
  if (page.h1) return norm(page.h1);
  if (page.title) return norm(page.title).split(" ").slice(0, 4).join(" ");
  if (page.headings.length) return page.headings[0].toLowerCase();
  return null;
}
