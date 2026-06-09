/**
 * DataForSEO local-SERP provider. Used for the map-pack lookup when
 * LOCAL_SERP_PROVIDER=dataforseo, and for the PROOF geo-grid scan.
 *
 * Geo-grid algorithm ported from seo-maps/SKILL.md:
 *   - generate gridSize x gridSize points (default 7x7, 5km radius) via a
 *     Haversine offset around the business center,
 *   - one Maps SERP call per point with location_coordinate,
 *   - find target rank at each point,
 *   - SoLV = (top_3_count / total_points) * 100.
 *
 * COST GATE: the caller (PROOF route) must run estimateGeoGrid() and obtain
 * explicit confirmation before invoking getGeoGrid(). This file does not spend
 * credits on its own — it is only reached after that gate.
 */

import { requireEnv } from "../env";
import { estimateGeoGrid } from "../cost";
import type { LocalSerpProvider, MapPackQuery, GeoGridQuery } from "./types";
import type { MapPackResult, GeoGridResult } from "../scan/types";

const BASE = "https://api.dataforseo.com/v3";

function authHeader(): string {
  const login = requireEnv("DATAFORSEO_LOGIN");
  const password = requireEnv("DATAFORSEO_PASSWORD");
  return "Basic " + Buffer.from(`${login}:${password}`).toString("base64");
}

interface DfsMapItem {
  type?: string;
  rank_absolute?: number;
  title?: string;
  rating?: { value?: number; votes_count?: number };
}

async function mapsLive(body: unknown): Promise<DfsMapItem[]> {
  const resp = await fetch(`${BASE}/serp/google/maps/live/advanced`, {
    method: "POST",
    headers: { Authorization: authHeader(), "Content-Type": "application/json" },
    body: JSON.stringify([body]),
  });
  if (!resp.ok) {
    const detail = await resp.text().catch(() => "");
    throw new Error(`DataForSEO maps request failed (HTTP ${resp.status}). ${detail.slice(0, 200)}`);
  }
  const json = (await resp.json()) as {
    tasks?: { result?: { items?: DfsMapItem[] }[] }[];
  };
  return json.tasks?.[0]?.result?.[0]?.items ?? [];
}

function norm(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function findRank(items: DfsMapItem[], businessName: string): number | null {
  const target = norm(businessName);
  for (const item of items) {
    const title = norm(item.title ?? "");
    if (title && (title.includes(target) || target.includes(title))) {
      return item.rank_absolute ?? null;
    }
  }
  return null;
}

/** Haversine offset: lat/lng for a point dxKm east / dyKm north of center. */
function offset(lat: number, lng: number, dxKm: number, dyKm: number) {
  const dLat = dyKm / 110.574;
  const dLng = dxKm / (111.32 * Math.cos((lat * Math.PI) / 180));
  return { lat: lat + dLat, lng: lng + dLng };
}

export class DataForSeoProvider implements LocalSerpProvider {
  readonly name = "dataforseo";

  async getMapPack(q: MapPackQuery): Promise<MapPackResult> {
    const query = `${q.service} ${q.city}`.trim();
    const items = await mapsLive({
      keyword: query,
      language_code: "nl",
      location_name: `${q.city},Netherlands`,
    });
    return {
      provider: this.name,
      query,
      position: findRank(items, q.businessName),
      totalResults: items.length,
      topCompetitors: items
        .filter((i) => i.title)
        .slice(0, 5)
        .map((i) => ({
          name: i.title as string,
          rating: i.rating?.value,
          reviews: i.rating?.votes_count,
        })),
    };
  }

  async getGeoGrid(q: GeoGridQuery): Promise<GeoGridResult> {
    const gridSize = q.gridSize ?? 7;
    const radiusKm = q.radiusKm ?? 5;
    const estimate = estimateGeoGrid(gridSize);
    const keyword = `${q.service} ${q.city}`.trim();

    const step = (radiusKm * 2) / (gridSize - 1);
    const start = -radiusKm;
    const points: GeoGridResult["points"] = [];

    for (let row = 0; row < gridSize; row++) {
      for (let col = 0; col < gridSize; col++) {
        const dx = start + col * step;
        const dy = start + row * step;
        const { lat, lng } = offset(q.centerLat, q.centerLng, dx, dy);
        const items = await mapsLive({
          keyword,
          language_code: "nl",
          location_coordinate: `${lat.toFixed(6)},${lng.toFixed(6)},14z`,
        });
        points.push({ lat, lng, rank: findRank(items, q.businessName) });
      }
    }

    const ranked = points.filter((p) => p.rank !== null) as { rank: number }[];
    const top3 = points.filter((p) => p.rank !== null && (p.rank as number) <= 3).length;
    const averageRank =
      ranked.length > 0
        ? Math.round((ranked.reduce((s, p) => s + p.rank, 0) / ranked.length) * 10) / 10
        : null;

    return {
      keyword,
      gridSize,
      radiusKm,
      solvPercent: Math.round((top3 / points.length) * 1000) / 10,
      averageRank,
      points,
      estimatedCostUsd: estimate.estimatedCostUsd,
    };
  }
}
