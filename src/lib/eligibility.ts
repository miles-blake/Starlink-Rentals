export interface EligibilityResult {
  withinRadius: boolean;
  distanceMiles: number;
}

export function evaluateEligibility(params: {
  distanceMiles: number;
  serviceRadiusMiles: number;
}): EligibilityResult {
  const { distanceMiles, serviceRadiusMiles } = params;
  return {
    withinRadius: distanceMiles <= serviceRadiusMiles,
    distanceMiles,
  };
}
