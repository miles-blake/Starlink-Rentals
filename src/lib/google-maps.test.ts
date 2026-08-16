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
  it("extracts lat/lng and formatted address", () => {
    const result = parsePlaceDetailsResponse({
      formattedAddress: "1231 S 1440 E, Provo, UT 84606, USA",
      location: { latitude: 40.2173462, longitude: -111.6336121 },
    });
    expect(result).toEqual({
      lat: 40.2173462,
      lng: -111.6336121,
      formattedAddress: "1231 S 1440 E, Provo, UT 84606, USA",
    });
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

  it("throws on an unexpected shape", () => {
    expect(() => parseRouteMatrixResponse([{}])).toThrow();
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
