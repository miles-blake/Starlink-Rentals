import {
  fetchDrivingDistanceMiles,
  fetchPlaceDetails,
  type LatLng,
  type PlaceDetails,
} from "@/lib/google-maps";
import { TtlCache } from "@/lib/ttl-cache";

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

export interface PlaceAndDistance extends PlaceDetails {
  distanceMiles: number;
  googlePlaceId: string;
}

// Cached by placeId for a day — the base point never changes, so placeId
// alone is a safe cache key. Shared by /api/eligibility and
// /api/reservations so both hit the same warm cache instead of doubling
// Google API calls when a customer books right after quoting.
const cache = new TtlCache<PlaceAndDistance>(ONE_DAY_MS);

export async function resolvePlaceAndDistance(
  placeId: string,
  apiKey: string,
  base: LatLng
): Promise<PlaceAndDistance> {
  return cache.getOrSet(placeId, async () => {
    const place = await fetchPlaceDetails(placeId, apiKey);
    const distanceMiles = await fetchDrivingDistanceMiles(
      base,
      { lat: place.lat, lng: place.lng },
      apiKey
    );
    return { ...place, distanceMiles, googlePlaceId: placeId };
  });
}
