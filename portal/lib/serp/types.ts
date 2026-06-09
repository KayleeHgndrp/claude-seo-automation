/**
 * Pluggable local-SERP provider abstraction.
 *
 * The task requires a `LocalSerpProvider` interface with Serper.dev as the
 * default (one local-pack call per LITE scan) and DataForSEO as an option for
 * geo-grid PROOF. Both implement getMapPack(); only DataForSEO implements the
 * optional geo-grid scan.
 */

import type { MapPackResult, GeoGridResult } from "../scan/types";

export interface MapPackQuery {
  /** e.g. "fysiotherapie" */
  service: string;
  /** e.g. "Utrecht" */
  city: string;
  /** Business name to match against pack results. */
  businessName: string;
}

export interface GeoGridQuery extends MapPackQuery {
  centerLat: number;
  centerLng: number;
  gridSize?: number; // points per side (default 7)
  radiusKm?: number; // default 5
}

export interface LocalSerpProvider {
  readonly name: string;
  /** One local/map-pack lookup for "[service] [city]". */
  getMapPack(q: MapPackQuery): Promise<MapPackResult>;
  /** Optional geo-grid scan (PROOF). Only implemented by DataForSEO. */
  getGeoGrid?(q: GeoGridQuery): Promise<GeoGridResult>;
}
