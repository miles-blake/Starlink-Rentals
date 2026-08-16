import { describe, expect, it } from "vitest";
import { evaluateEligibility } from "./eligibility";

describe("evaluateEligibility", () => {
  it("is within radius when distance is under the limit", () => {
    const result = evaluateEligibility({
      distanceMiles: 12.3,
      serviceRadiusMiles: 40,
    });
    expect(result).toEqual({ withinRadius: true, distanceMiles: 12.3 });
  });

  it("is within radius exactly at the limit", () => {
    expect(
      evaluateEligibility({ distanceMiles: 40, serviceRadiusMiles: 40 })
        .withinRadius
    ).toBe(true);
  });

  it("is out of radius just past the limit", () => {
    expect(
      evaluateEligibility({ distanceMiles: 40.1, serviceRadiusMiles: 40 })
        .withinRadius
    ).toBe(false);
  });
});
