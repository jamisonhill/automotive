import { z } from "zod";

/*
 * Zod schemas for forms.
 *
 * FormData fields all arrive as strings (or undefined). These helpers
 * normalize them:
 *
 *   blankToUndef → empty strings and nulls become undefined, so .optional()
 *                  Just Works on every field where the user might leave it blank.
 *
 *   z.coerce.number / z.coerce.date → handle string-to-typed conversion for
 *                                     the actual value once it's not blank.
 *
 * Schemas are used both server-side (in server actions) so client and server
 * stay in lockstep.
 */

const blankToUndef = (v: unknown) =>
  typeof v === "string" && v.trim() === "" ? undefined : v ?? undefined;

const optStr = z.preprocess(blankToUndef, z.string().optional());
const optInt = z.preprocess(blankToUndef, z.coerce.number().int().optional());
const optNonNegInt = z.preprocess(
  blankToUndef,
  z.coerce.number().int().min(0).optional()
);
const optFloat = z.preprocess(blankToUndef, z.coerce.number().optional());
const optNonNegFloat = z.preprocess(
  blankToUndef,
  z.coerce.number().min(0).optional()
);
const optDate = z.preprocess(blankToUndef, z.coerce.date().optional());

// =============================================================================
// Vehicle
// =============================================================================
export const vehicleSchema = z.object({
  nickname: optStr,
  // Required. Coerce handles the string → number conversion from FormData.
  year: z.coerce.number().int().min(1900).max(2100),
  make: z.string().min(1, "Make is required"),
  model: z.string().min(1, "Model is required"),
  trim: optStr,
  vin: optStr,
  engine: optStr,
  transmission: optStr,
  drivetrain: z.preprocess(
    blankToUndef,
    z.enum(["FWD", "RWD", "AWD", "4WD"]).optional()
  ),
  color: optStr,
  licensePlate: optStr,
  purchaseDate: optDate,
  purchaseMileage: optNonNegInt,
  purchasePrice: optNonNegFloat,
  notes: optStr,
});

export type VehicleInput = z.infer<typeof vehicleSchema>;

// =============================================================================
// Baseline (used-car snapshot)
// =============================================================================

const conditionEnum = z.preprocess(
  blankToUndef,
  z.enum(["new", "good", "fair", "poor", "unknown"]).optional()
);

const rotorConditionEnum = z.preprocess(
  blankToUndef,
  z.enum(["good", "lipped", "scored", "warped", "replace"]).optional()
);

// Tread depth: 0–20 (32nds of an inch). Higher than 20 isn't physically real.
const optTread = z.preprocess(
  blankToUndef,
  z.coerce.number().int().min(0).max(20).optional()
);

// Brake pad: 0–20 mm.
const optPadMm = z.preprocess(
  blankToUndef,
  z.coerce.number().min(0).max(20).optional()
);

export const baselineSchema = z.object({
  // The only required field — everything else can be filled in later.
  mileageAtBaseline: z.coerce.number().int().min(0),

  // Tires
  treadFL: optTread,
  treadFR: optTread,
  treadRL: optTread,
  treadRR: optTread,
  tireBrand: optStr,
  tireModel: optStr,
  tireDotDate: optStr,

  // Brakes
  brakePadFront: optPadMm,
  brakePadRear: optPadMm,
  rotorConditionFront: rotorConditionEnum,
  rotorConditionRear: rotorConditionEnum,

  // Battery
  batteryAgeMonths: z.preprocess(
    blankToUndef,
    z.coerce.number().int().min(0).max(360).optional()
  ),
  batteryCca: z.preprocess(
    blankToUndef,
    z.coerce.number().int().min(0).max(2000).optional()
  ),
  batteryBrand: optStr,

  // Fluids
  oilCondition: conditionEnum,
  coolantCondition: conditionEnum,
  brakeFluidCondition: conditionEnum,
  transFluidCondition: conditionEnum,
  diffFluidCondition: conditionEnum,
  powerSteeringCondition: conditionEnum,

  // Belts/hoses
  beltsCondition: conditionEnum,
  hosesCondition: conditionEnum,

  // Free text
  knownIssues: optStr,
  recentService: optStr,
  notes: optStr,
});

export type BaselineInput = z.infer<typeof baselineSchema>;

// Suppress unused-export warnings for helpers — they exist so future schemas
// can grab them without redefining the same coerce-with-blank pattern.
export { optInt, optFloat };

/**
 * Build a partial Zod input object from a FormData payload.
 * Server actions get FormData; this normalizes it before zod parsing.
 */
export function formDataToObject(formData: FormData): Record<string, unknown> {
  const obj: Record<string, unknown> = {};
  for (const [key, value] of formData.entries()) {
    // Skip File entries here — handle photos separately so we don't mix
    // binary blobs into the zod-validated object.
    if (value instanceof File) continue;
    obj[key] = value;
  }
  return obj;
}
