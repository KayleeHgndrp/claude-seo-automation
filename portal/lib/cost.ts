/**
 * DataForSEO cost estimation — ported from scripts/dataforseo_costs.py.
 *
 * The seo-maps skill mandates a cost estimate + explicit confirmation BEFORE
 * any geo-grid scan. We enforce that here: estimateGeoGrid() returns the USD
 * estimate, and the PROOF route refuses to run unless the request carries
 * confirmCost=true AND the estimate is within DATAFORSEO_MAX_COST_USD.
 */

// USD per call, standard queue. Subset of COST_TABLE in dataforseo_costs.py.
export const COST_TABLE: Record<string, number> = {
  serp_google_maps_live_advanced: 0.002,
  serp_organic_live_advanced: 0.002,
};

export interface GeoGridCostEstimate {
  gridSize: number;
  points: number;
  perCallUsd: number;
  estimatedCostUsd: number;
}

/** Estimate the cost of a single-keyword geo-grid scan. */
export function estimateGeoGrid(gridSize = 7): GeoGridCostEstimate {
  const points = gridSize * gridSize;
  const perCallUsd = COST_TABLE.serp_google_maps_live_advanced;
  return {
    gridSize,
    points,
    perCallUsd,
    // round to 4 decimals
    estimatedCostUsd: Math.round(points * perCallUsd * 10000) / 10000,
  };
}
