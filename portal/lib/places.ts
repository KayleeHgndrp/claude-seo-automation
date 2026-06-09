/**
 * Google Places (Places API v1) — GBP signal source.
 *
 * Cheap, strong signal for GBP completeness: primary category, categories,
 * rating, review count, photo count, website, hours, address, phone.
 * Optional: if GOOGLE_PLACES_API_KEY is unset, the scan proceeds without it
 * and the orchestrator records a warning.
 */

import { optionalEnv } from "./env";
import type { GbpSignals } from "./scan/types";

const TEXT_SEARCH = "https://places.googleapis.com/v1/places:searchText";

interface PlaceV1 {
  id?: string;
  displayName?: { text?: string };
  primaryTypeDisplayName?: { text?: string };
  types?: string[];
  rating?: number;
  userRatingCount?: number;
  photos?: unknown[];
  websiteUri?: string;
  internationalPhoneNumber?: string;
  formattedAddress?: string;
  regularOpeningHours?: { periods?: unknown[] };
}

/**
 * Look up the business GBP via Places Text Search. Returns { found: false }
 * if no key configured or no match — never throws to the caller.
 */
export async function lookupGbp(
  businessName: string,
  city: string,
): Promise<GbpSignals> {
  const key = optionalEnv("GOOGLE_PLACES_API_KEY");
  if (!key) return { found: false };

  const fieldMask = [
    "places.id",
    "places.displayName",
    "places.primaryTypeDisplayName",
    "places.types",
    "places.rating",
    "places.userRatingCount",
    "places.photos",
    "places.websiteUri",
    "places.internationalPhoneNumber",
    "places.formattedAddress",
    "places.regularOpeningHours",
  ].join(",");

  let resp: Response;
  try {
    resp = await fetch(TEXT_SEARCH, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": key,
        "X-Goog-FieldMask": fieldMask,
      },
      body: JSON.stringify({
        textQuery: `${businessName} ${city}`,
        maxResultCount: 1,
        languageCode: "nl",
      }),
    });
  } catch {
    return { found: false };
  }

  if (!resp.ok) return { found: false };
  const data = (await resp.json()) as { places?: PlaceV1[] };
  const place = data.places?.[0];
  if (!place) return { found: false };

  return {
    found: true,
    placeId: place.id,
    name: place.displayName?.text,
    primaryCategory: place.primaryTypeDisplayName?.text,
    categories: place.types,
    rating: place.rating,
    reviewCount: place.userRatingCount,
    photoCount: place.photos?.length ?? 0,
    website: place.websiteUri,
    phone: place.internationalPhoneNumber,
    address: place.formattedAddress,
    hasHours: Boolean(place.regularOpeningHours?.periods?.length),
  };
}
