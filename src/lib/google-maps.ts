const METERS_PER_MILE = 1609.344;

export function metersToMiles(meters: number): number {
  return Math.round((meters / METERS_PER_MILE) * 10) / 10;
}

export interface LatLng {
  lat: number;
  lng: number;
}

export interface PlaceDetails extends LatLng {
  formattedAddress: string;
}

export interface AddressSuggestion {
  placeId: string;
  text: string;
}

/** Parses a Places API (New) Place Details response. Pure — no network. */
export function parsePlaceDetailsResponse(json: unknown): PlaceDetails {
  const data = json as {
    location?: { latitude?: number; longitude?: number };
    formattedAddress?: string;
  };
  if (
    typeof data.location?.latitude !== "number" ||
    typeof data.location?.longitude !== "number" ||
    typeof data.formattedAddress !== "string"
  ) {
    throw new Error("Unexpected Place Details response shape");
  }
  return {
    lat: data.location.latitude,
    lng: data.location.longitude,
    formattedAddress: data.formattedAddress,
  };
}

/** Parses a Routes API computeRouteMatrix response, returns driving distance in meters. Pure — no network. */
export function parseRouteMatrixResponse(json: unknown): number {
  const rows = json as Array<{
    status?: Record<string, unknown>;
    distanceMeters?: number;
    condition?: string;
  }>;
  const entry = Array.isArray(rows) ? rows[0] : undefined;
  if (!entry || typeof entry.distanceMeters !== "number") {
    throw new Error("Unexpected Routes API response shape");
  }
  return entry.distanceMeters;
}

/** Parses a Places API (New) Autocomplete response. Pure — no network. */
export function parseAutocompleteResponse(json: unknown): AddressSuggestion[] {
  const data = json as {
    suggestions?: Array<{
      placePrediction?: { placeId?: string; text?: { text?: string } };
    }>;
  };
  return (data.suggestions ?? [])
    .map((s) => s.placePrediction)
    .filter(
      (p): p is { placeId: string; text: { text: string } } =>
        typeof p?.placeId === "string" && typeof p?.text?.text === "string"
    )
    .map((p) => ({ placeId: p.placeId, text: p.text.text }));
}

export async function fetchAddressSuggestions(
  input: string,
  apiKey: string
): Promise<AddressSuggestion[]> {
  const res = await fetch(
    "https://places.googleapis.com/v1/places:autocomplete",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey,
      },
      body: JSON.stringify({
        input,
        includedRegionCodes: ["us"],
      }),
    }
  );
  if (!res.ok) {
    throw new Error(`Places Autocomplete request failed: ${res.status}`);
  }
  return parseAutocompleteResponse(await res.json());
}

export async function fetchPlaceDetails(
  placeId: string,
  apiKey: string
): Promise<PlaceDetails> {
  const res = await fetch(
    `https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}?fields=location,formattedAddress`,
    { headers: { "X-Goog-Api-Key": apiKey } }
  );
  if (!res.ok) {
    throw new Error(`Place Details request failed: ${res.status}`);
  }
  return parsePlaceDetailsResponse(await res.json());
}

export async function geocodeAddress(
  address: string,
  apiKey: string
): Promise<PlaceDetails> {
  const res = await fetch(
    "https://places.googleapis.com/v1/places:searchText",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask": "places.location,places.formattedAddress",
      },
      body: JSON.stringify({ textQuery: address }),
    }
  );
  if (!res.ok) {
    throw new Error(`Text Search request failed: ${res.status}`);
  }
  const data = (await res.json()) as { places?: unknown[] };
  const place = data.places?.[0];
  if (!place) {
    throw new Error(`No results geocoding address: ${address}`);
  }
  return parsePlaceDetailsResponse(place);
}

export async function fetchDrivingDistanceMiles(
  origin: LatLng,
  destination: LatLng,
  apiKey: string
): Promise<number> {
  const res = await fetch(
    "https://routes.googleapis.com/distanceMatrix/v2:computeRouteMatrix",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask":
          "originIndex,destinationIndex,distanceMeters,duration,condition,status",
      },
      body: JSON.stringify({
        origins: [
          {
            waypoint: {
              location: {
                latLng: { latitude: origin.lat, longitude: origin.lng },
              },
            },
          },
        ],
        destinations: [
          {
            waypoint: {
              location: {
                latLng: {
                  latitude: destination.lat,
                  longitude: destination.lng,
                },
              },
            },
          },
        ],
        travelMode: "DRIVE",
      }),
    }
  );
  if (!res.ok) {
    throw new Error(`Routes API request failed: ${res.status}`);
  }
  const meters = parseRouteMatrixResponse(await res.json());
  return metersToMiles(meters);
}
