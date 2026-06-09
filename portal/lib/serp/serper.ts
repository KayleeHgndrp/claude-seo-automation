/**
 * Serper.dev local-SERP provider (default). Uses the Maps/Places endpoint to
 * fetch the local pack for "[service] [city]" and finds the target business's
 * rank. One call per LITE scan, as the task specifies.
 */

import { requireEnv } from "../env";
import type { LocalSerpProvider, MapPackQuery } from "./types";
import type { MapPackResult } from "../scan/types";

const SERPER_MAPS = "https://google.serper.dev/maps";

interface SerperPlace {
  title?: string;
  position?: number;
  rating?: number;
  ratingCount?: number;
}

/** Normalize a business name for fuzzy matching. */
function norm(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

export class SerperProvider implements LocalSerpProvider {
  readonly name = "serper";

  async getMapPack(q: MapPackQuery): Promise<MapPackResult> {
    const apiKey = requireEnv("SERPER_API_KEY");
    const query = `${q.service} ${q.city}`.trim();

    const resp = await fetch(SERPER_MAPS, {
      method: "POST",
      headers: { "X-API-KEY": apiKey, "Content-Type": "application/json" },
      body: JSON.stringify({ q: query, gl: "nl", hl: "nl" }),
    });

    if (!resp.ok) {
      const detail = await resp.text().catch(() => "");
      throw new Error(`Serper maps request failed (HTTP ${resp.status}). ${detail.slice(0, 200)}`);
    }

    const data = (await resp.json()) as { places?: SerperPlace[] };
    const places = data.places ?? [];

    const target = norm(q.businessName);
    let position: number | null = null;
    places.forEach((p, idx) => {
      if (position !== null) return;
      const title = norm(p.title ?? "");
      if (title && (title.includes(target) || target.includes(title))) {
        position = p.position ?? idx + 1;
      }
    });

    return {
      provider: this.name,
      query,
      position,
      totalResults: places.length,
      topCompetitors: places.slice(0, 5).map((p) => ({
        name: p.title ?? "(unknown)",
        rating: p.rating,
        reviews: p.ratingCount,
      })),
    };
  }
}
