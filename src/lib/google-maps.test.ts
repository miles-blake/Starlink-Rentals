import { describe, expect, it } from "vitest";
import {
  metersToMiles,
  parseAutocompleteResponse,
  parsePlaceDetailsResponse,
  parseRouteMatrixResponse,
} from "./google-maps";

describe("metersToMiles", () => {
  it("converts meters to miles rounded to 1 decimal", () => {
    expect(metersToMiles(77256)).toBeCloseTo(48, 0);
  });

  it("rounds to the nearest tenth of a mile", () => {
    expect(metersToMiles(1609.344 * 10.04)).toBe(10);
  });
});

describe("parsePlaceDetailsResponse", () => {
  it("extracts lat/lng and formatted address, with null address parts when there are no components", () => {
    const result = parsePlaceDetailsResponse({
      formattedAddress: "1231 S 1440 E, Provo, UT 84606, USA",
      location: { latitude: 40.2173462, longitude: -111.6336121 },
    });
    expect(result).toEqual({
      lat: 40.2173462,
      lng: -111.6336121,
      formattedAddress: "1231 S 1440 E, Provo, UT 84606, USA",
      addressLine1: null,
      addressLine2: null,
      city: null,
      state: null,
      zip: null,
    });
  });

  it("extracts structured address parts from addressComponents", () => {
    const result = parsePlaceDetailsResponse({
      formattedAddress: "1231 S 1440 E, Provo, UT 84606, USA",
      location: { latitude: 40.2173462, longitude: -111.6336121 },
      addressComponents: [
        { longText: "1231", types: ["street_number"] },
        {
          longText: "South 1440 East",
          shortText: "S 1440 E",
          types: ["route"],
        },
        {
          longText: "Provo",
          shortText: "Provo",
          types: ["locality", "political"],
        },
        {
          longText: "Utah",
          shortText: "UT",
          types: ["administrative_area_level_1", "political"],
        },
        { longText: "84606", types: ["postal_code"] },
      ],
    });
    expect(result).toMatchObject({
      addressLine1: "1231 South 1440 East",
      addressLine2: null,
      city: "Provo",
      state: "UT",
      zip: "84606",
    });
  });

  it("falls back to just the route when there is no street number", () => {
    const result = parsePlaceDetailsResponse({
      formattedAddress: "Provo, UT 84602, USA",
      location: { latitude: 40.25, longitude: -111.65 },
      addressComponents: [
        { longText: "Provo", shortText: "Provo", types: ["locality"] },
      ],
    });
    expect(result.addressLine1).toBeNull();
    expect(result.city).toBe("Provo");
  });

  it("throws on an unexpected shape", () => {
    expect(() => parsePlaceDetailsResponse({})).toThrow();
  });
});

describe("parseRouteMatrixResponse", () => {
  it("extracts distanceMeters from the first matrix entry", () => {
    const meters = parseRouteMatrixResponse([
      { originIndex: 0, destinationIndex: 0, distanceMeters: 77256 },
    ]);
    expect(meters).toBe(77256);
  });

  it("treats a same-point route (distanceMeters omitted, empty status) as 0", () => {
    const meters = parseRouteMatrixResponse([
      {
        originIndex: 0,
        destinationIndex: 0,
        status: {},
        condition: "ROUTE_EXISTS",
      },
    ]);
    expect(meters).toBe(0);
  });

  it("throws when the entry carries a real error status", () => {
    expect(() =>
      parseRouteMatrixResponse([
        { status: { code: 7, message: "PERMISSION_DENIED" } },
      ])
    ).toThrow(/PERMISSION_DENIED/);
  });

  it("throws when the response isn't an array", () => {
    expect(() => parseRouteMatrixResponse({})).toThrow();
    expect(() => parseRouteMatrixResponse([])).toThrow();
  });
});

describe("parseAutocompleteResponse", () => {
  it("extracts placeId and text from suggestions", () => {
    const result = parseAutocompleteResponse({
      suggestions: [
        {
          placePrediction: {
            placeId: "abc123",
            text: { text: "1231 S 1440 E, Provo, UT, USA" },
          },
        },
      ],
    });
    expect(result).toEqual([
      { placeId: "abc123", text: "1231 S 1440 E, Provo, UT, USA" },
    ]);
  });

  it("returns an empty array when there are no suggestions", () => {
    expect(parseAutocompleteResponse({})).toEqual([]);
  });
});
