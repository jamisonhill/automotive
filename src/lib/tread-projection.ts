/*
 * Tread depth replacement projection.
 *
 * Given a series of (mileage, depth) readings on a single tire set,
 * estimate the mileage at which the tires will hit 2/32" — the legal
 * minimum in most US states and the universally-accepted replacement
 * threshold.
 *
 * Approach: ordinary least-squares linear regression of min-corner
 * depth versus mileage. We use the *minimum* corner (not average) so
 * that the worst tire drives the projection — that's the one that'll
 * trigger replacement first in a four-corner-rotation regimen.
 *
 * We need at least 2 readings to fit a line. With 2 we extrapolate
 * naively; with 3+ the regression smooths out measurement noise.
 *
 * The projection is intentionally *conservative-leaning*: we prefer
 * "you have ~12k miles left" to be a slight underestimate (so the user
 * isn't surprised) rather than an overestimate (so they're not riding
 * on cords). Right now we don't bias the regression — we just trust
 * the user's measurements. Worth revisiting if real-world readings
 * end up noisy.
 */

export const REPLACE_THRESHOLD = 2; // 32nds of an inch

export type TreadReading = {
  mileage: number;
  /** Min of fl/fr/rl/rr in 32nds. The "worst corner" drives wear. */
  minDepth: number;
};

export type TreadProjection =
  /**
   * Successful projection — we have enough data and the tires are
   * wearing in a plausible direction (slope <= 0).
   */
  | {
      kind: "ok";
      /** Slope in 32nds per mile. Always <= 0 for wearing tires. */
      slope: number;
      /** Intercept in 32nds (depth at mileage 0 of the regression). */
      intercept: number;
      /** Estimated odometer at which depth reaches REPLACE_THRESHOLD. */
      projectedMileage: number;
      /**
       * Estimated miles remaining vs. the supplied current mileage.
       * Negative when the tires are already past the threshold; the UI
       * should treat that as "due now".
       */
      milesRemaining: number;
      /** Number of data points used. ≥3 = decent confidence. */
      sampleSize: number;
    }
  /** Not enough readings yet (need ≥ 2). */
  | { kind: "insufficient-data"; sampleSize: number }
  /**
   * Slope is zero or positive — readings show no wear or an unexpected
   * gain (measurement error, or comparing readings before vs. after a
   * rotation). We don't extrapolate in this case.
   */
  | { kind: "no-wear"; sampleSize: number };

/**
 * Fit a line and project the replacement mileage.
 *
 * @param readings All tread readings for one tire set.
 * @param currentMileage The vehicle's most recent odometer reading.
 *   Used to compute milesRemaining; the regression itself doesn't
 *   depend on it.
 */
export function projectReplacement(
  readings: TreadReading[],
  currentMileage: number | null
): TreadProjection {
  if (readings.length < 2) {
    return { kind: "insufficient-data", sampleSize: readings.length };
  }

  // OLS: slope = Σ((x - x̄)(y - ȳ)) / Σ((x - x̄)²)
  //      intercept = ȳ - slope * x̄
  // Operating in plain JS numbers — datasets are tiny (≤ 50 readings
  // per set, realistically), so no need for Welford / accumulators.
  const n = readings.length;
  const meanX = readings.reduce((s, r) => s + r.mileage, 0) / n;
  const meanY = readings.reduce((s, r) => s + r.minDepth, 0) / n;

  let num = 0;
  let den = 0;
  for (const r of readings) {
    const dx = r.mileage - meanX;
    num += dx * (r.minDepth - meanY);
    den += dx * dx;
  }

  if (den === 0) {
    // All readings at the same mileage — degenerate input. Treat as
    // not-enough-info rather than crashing on division by zero.
    return { kind: "insufficient-data", sampleSize: n };
  }

  const slope = num / den;
  const intercept = meanY - slope * meanX;

  // Slope >= 0 means tires are gaining tread (impossible) or perfectly
  // flat. Either way we can't project a replacement mileage.
  if (slope >= 0) {
    return { kind: "no-wear", sampleSize: n };
  }

  // Solve for x at y = REPLACE_THRESHOLD: x = (THRESHOLD - intercept) / slope
  const projectedMileage = (REPLACE_THRESHOLD - intercept) / slope;
  const milesRemaining =
    currentMileage != null ? projectedMileage - currentMileage : NaN;

  return {
    kind: "ok",
    slope,
    intercept,
    projectedMileage,
    milesRemaining,
    sampleSize: n,
  };
}

/**
 * Convenience helper — pull the min corner from a tread log row. Kept
 * here so callers don't have to remember to take the min of all four
 * corners (and accidentally pass an avg or a single corner instead).
 */
export function minCorner(log: {
  fl: number;
  fr: number;
  rl: number;
  rr: number;
}): number {
  return Math.min(log.fl, log.fr, log.rl, log.rr);
}

/**
 * Tread status band for one corner. Used to color-code corner readouts
 * in the form and timeline. Thresholds are conservative US convention:
 *   ≥6/32 — "good" (lots of life left)
 *   3–5/32 — "wearing" (start watching)
 *   ≤2/32 — "replace" (legal minimum / unsafe)
 */
export type TreadBand = "good" | "wearing" | "replace";

export function treadBand(depth: number): TreadBand {
  if (depth <= 2) return "replace";
  if (depth <= 5) return "wearing";
  return "good";
}
