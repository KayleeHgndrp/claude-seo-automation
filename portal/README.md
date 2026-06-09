# Studio Radixs · Lokale-SEO Outreach Portal

A self-contained Next.js 15 (App Router, TypeScript, Tailwind) admin tool that
cold-scans a local service business with the **Claude SEO `seo-local`
methodology** and drafts a Studio Radixs outreach email built on concrete,
self-verifiable hooks.

> **Architecture note.** Claude Code *skills* and *agents* never run inside this
> app. The methodology from `skills/seo-local/`, `skills/seo-sxo/`, and
> `skills/seo-maps/` (in the parent repo) is **ported into system prompts**
> (`lib/prompts/*`). The app is a scan *service*: API routes call data sources
> (Firecrawl, a `LocalSerpProvider`, Google Places, optionally DataForSEO) and
> use the Anthropic API for analysis.

## Three modes

| Mode | Use | What it does | Cost |
|------|-----|--------------|------|
| **LITE** (default) | cold mail | map-pack position + GBP completeness + NAP consistency + schema gaps → 3 self-verifiable hooks. One local-pack call. | cheap |
| **FULL** | replies / clients | full `seo-local` audit + a light SXO lens (page-type vs SERP). | medium |
| **PROOF** | optional | DataForSEO geo-grid (SoLV per location). **Cost-gated** — requires `confirmCost` + estimate ≤ `DATAFORSEO_MAX_COST_USD`. | DataForSEO credits |

## Data sources

- **Firecrawl** — renders the target site (JS-aware); we parse NAP,
  LocalBusiness schema + subtype, title/H1/headings, business type.
- **`LocalSerpProvider`** — pluggable. Default **Serper.dev** (`SERPER_API_KEY`)
  via the maps endpoint for the `[service] [city]` map-pack position.
  **DataForSEO** is the option for geo-grid (and the map-pack lookup if
  `LOCAL_SERP_PROVIDER=dataforseo`).
- **Google Places** (`GOOGLE_PLACES_API_KEY`, optional) — Place Details for GBP
  signals: categories, rating, review count, photos, hours, website.

## Security

- **SSRF guard** (`lib/ssrf.ts`, ported from the repo's `scripts/url_safety.py`)
  runs on every URL input, **including before Firecrawl** — blocks
  private/loopback/reserved IPs, cloud-metadata hosts, and obfuscated IPv4, and
  DNS-resolves the host to defeat rebinding.
- All keys come from `.env.local` (see `.env.local.example`). Nothing hardcoded.
  The Supabase **service-role key is server-only**.
- Defensive JSON parsing (`lib/json.ts`) for all model output.

## Setup

```bash
cd portal
cp .env.local.example .env.local   # fill in keys
npm install
# create the Supabase tables:
#   open supabase/schema.sql in the Supabase SQL editor and run it
npm run dev                        # http://localhost:3000
```

Create a user in **Supabase → Authentication → Users**, then log in at
`/login`. The tool lives at `/admin/outreach` (auth-gated by `middleware.ts`).

## Flow

1. `/admin/outreach` — protected by Supabase Auth.
2. Form: target URL, recipient email, business name, contact, city, primary
   service/keyword (optional — auto-detected from title+H1+schema), mode.
3. `POST /api/outreach/scan` — Firecrawl render → `LocalSerpProvider` →
   Places → (PROOF) DataForSEO geo-grid → Anthropic analysis → STRICT JSON
   (`map_pack_position`, `gbp_issues[]`, `nap_consistency`, `schema_gaps[]`,
   `email_hooks[]`, `limitations[]`).
4. `POST /api/outreach/generate` — hooks → Claude → `{ subject, body }` (NL,
   Studio Radixs tone: direct, transparent, price-transparent, not salesy).
5. **Review (default).** Findings + editable draft are shown side by side. The
   operator confirms and clicks **Versturen**. An optional **auto-send** toggle
   skips the manual click (off by default).
6. `POST /api/outreach/send` — sends via SMTP (Nodemailer) and persists scan +
   email to Supabase (best-effort; a storage failure never loses a sent mail).

## Error handling

Ported from the skill error tables: unreachable/JS-rendered target, no
detectable keyword, no GBP found, empty SERP, malformed model JSON, and the
DataForSEO cost gate are all handled with clear messages and graceful
degradation (warnings vs hard errors).

## Files

```
portal/
  app/
    layout.tsx, page.tsx, globals.css
    login/page.tsx
    admin/layout.tsx                 # server-side auth re-check
    admin/outreach/page.tsx          # form + review UI
    api/outreach/{scan,generate,send}/route.ts
  components/{OutreachForm,FindingsPanel,EmailDraftPanel}.tsx
  lib/
    ssrf.ts            # SSRF guard (port of scripts/url_safety.py)
    json.ts            # defensive JSON parsing
    env.ts, auth.ts, anthropic.ts, mailer.ts, cost.ts
    firecrawl.ts       # render + NAP/schema/heading parse + keyword detect
    places.ts          # Google Places GBP signals
    serp/{types,serper,dataforseo,index}.ts   # LocalSerpProvider
    prompts/{seo-local-system,email-system}.ts # ported methodology + tone
    scan/{types,orchestrator}.ts
    supabase/{server,client}.ts
  supabase/schema.sql
  middleware.ts        # Supabase auth gate for /admin/*
```
