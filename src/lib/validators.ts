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

// =============================================================================
// Fuel
// =============================================================================
export const fuelSchema = z.object({
  // Required.
  filledAt: z.coerce.date(),
  odometer: z.coerce.number().int().min(0),
  gallons: z.coerce.number().positive(),

  // Optional cost fields. The form auto-derives the third from the other two
  // (if you fill in any two), but we accept whatever the user gave us.
  totalCost: z.preprocess(blankToUndef, z.coerce.number().min(0).optional()),
  pricePerGallon: z.preprocess(
    blankToUndef,
    z.coerce.number().min(0).optional()
  ),

  octane: z.preprocess(
    blankToUndef,
    z.coerce.number().int().min(50).max(120).optional()
  ),
  station: optStr,

  // Checkboxes — Boolean coerce treats "on", "true", "1" as true.
  partialFill: z.preprocess(
    (v) => v === "on" || v === "true" || v === true,
    z.boolean()
  ),
  missedFill: z.preprocess(
    (v) => v === "on" || v === "true" || v === true,
    z.boolean()
  ),

  notes: optStr,
});

export type FuelInput = z.infer<typeof fuelSchema>;

// =============================================================================
// Odometer (manual reading between fills/services)
// =============================================================================
export const odometerSchema = z.object({
  miles: z.coerce.number().int().min(0),
  recordedAt: z.coerce.date(),
});

export type OdometerInput = z.infer<typeof odometerSchema>;

// =============================================================================
// Service entry (routine maintenance, repairs, inspections, modifications)
// =============================================================================
export const serviceSchema = z
  .object({
    // Required identification
    category: z.enum([
      "routine",
      "repair",
      "inspection",
      "modification",
      "diagnostic",
    ]),
    serviceType: z.string().min(1, "Service type is required"),
    // Required when serviceType === "custom" — validated in superRefine below.
    customLabel: optStr,

    performedAt: z.coerce.date(),
    odometer: z.coerce.number().int().min(0),

    // Part info
    partBrand: optStr,
    partNumber: optStr,
    partCondition: z.preprocess(
      blankToUndef,
      z.enum(["new", "reman", "used"]).optional()
    ),
    supplier: optStr,

    // Warranty (months OR miles, whichever expires first)
    warrantyMonths: optNonNegInt,
    warrantyMiles: optNonNegInt,

    // Costs
    partsCost: optNonNegFloat,
    laborCost: optNonNegFloat,
    totalCost: optNonNegFloat,

    // Where the work was done
    diy: z.preprocess(
      (v) => v === "on" || v === "true" || v === true,
      z.boolean()
    ),
    shopName: optStr,

    // Repair narrative
    symptoms: optStr,
    diagnosis: optStr,

    // Oil-change specific
    oilType: z.preprocess(
      blankToUndef,
      z.enum(["conventional", "synthetic", "high-mileage", "blend"]).optional()
    ),
    oilViscosity: optStr,
    oilFilterPart: optStr,

    // Optional link from a repair back to the issue/diagnostic that prompted it
    resolvedIssueId: optStr,

    notes: optStr,
  })
  .superRefine((val, ctx) => {
    // Custom service-type requires a label so we don't end up with a row
    // that says "Custom" and nothing else.
    if (val.serviceType === "custom" && !val.customLabel) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Custom label is required when service type is 'custom'.",
        path: ["customLabel"],
      });
    }
  });

export type ServiceInput = z.infer<typeof serviceSchema>;

// =============================================================================
// Issue / DTC log
// =============================================================================
export const issueSchema = z.object({
  // Required: a one-line symptom and a status
  symptom: z.string().min(1, "Symptom is required"),
  status: z.enum(["open", "monitoring", "resolved"]),

  // When the issue was first noticed
  reportedAt: z.coerce.date(),
  reportedMileage: optNonNegInt,

  // Diagnosis is free-text and optional. DTC codes come in as raw text
  // (comma- or whitespace-separated). The action normalizes them to a
  // canonical "P0301,P0302" form before save.
  diagnosis: optStr,
  dtcCodes: optStr,

  // Resolution — only meaningful when status === "resolved". The form lets
  // the user link to a ServiceEntry that fixed it; on save the action also
  // sets ServiceEntry.resolvedIssueId in the other direction.
  resolvedAt: optDate,
  resolvedServiceEntryId: optStr,

  notes: optStr,
});

export type IssueInput = z.infer<typeof issueSchema>;

// =============================================================================
// Tire set
// =============================================================================
export const tireSetSchema = z.object({
  // Required identification
  brand: z.string().min(1, "Brand is required"),
  model: z.string().min(1, "Model is required"),
  // Size like "225/65R17". We accept any non-empty string here — strict
  // format validation belongs at the UI hint level, not the schema.
  size: z.string().min(1, "Size is required"),

  // Optional spec fields
  loadIndex: optStr,
  speedRating: optStr,
  treadwear: optNonNegInt, // UTQG treadwear rating

  // Required install context
  installedAt: z.coerce.date(),
  installMileage: z.coerce.number().int().min(0),

  // Optional purchase / financial info
  cost: optNonNegFloat,
  notes: optStr,

  // "Replacing my current tires" toggle (only used on create) — when on,
  // the create action auto-closes any active set with the new install
  // date/mileage so the user doesn't have to do it as a separate step.
  closePreviousSet: z.preprocess(
    (v) => v === "on" || v === "true" || v === true,
    z.boolean().default(false)
  ),
});

export type TireSetInput = z.infer<typeof tireSetSchema>;

// Form payload for the "mark this set as removed" action — separate from
// edit because it's a discrete event the user takes when they swap
// tires off the car (sold, worn out, switching seasonal, etc.).
export const tireSetRemovalSchema = z.object({
  removedAt: z.coerce.date(),
  removeMileage: z.coerce.number().int().min(0),
  removeReason: z.preprocess(
    blankToUndef,
    z.enum(["worn", "damage", "upgrade", "seasonal"]).optional()
  ),
  removeNotes: optStr,
});

export type TireSetRemovalInput = z.infer<typeof tireSetRemovalSchema>;

// =============================================================================
// Tire pressure log (per-corner check / fill event)
// =============================================================================

// Cold-fill PSI for passenger cars typically lands in the 25–50 range; trucks
// and commercial vehicles climb higher. 0–150 is a generous outer bound — it
// catches obvious typos ("300") without rejecting legitimate values.
const optPsi = z.preprocess(
  blankToUndef,
  z.coerce.number().min(0).max(150).optional()
);

// Ambient °F: tire pressure is temperature-sensitive, so we record it. Bounds
// chosen to catch typos (e.g. "750") while accepting real-world conditions.
const optAmbientF = z.preprocess(
  blankToUndef,
  z.coerce.number().min(-50).max(150).optional()
);

export const pressureLogSchema = z
  .object({
    // Required: when this check happened
    recordedAt: z.coerce.date(),

    // Optional outdoor temperature at the time of the reading. Cold-fill PSI
    // is the manufacturer spec, so ambient context is useful.
    ambientF: optAmbientF,

    // Optional link to a TireSet. The server action defaults to the vehicle's
    // currently-active set when this is blank, so the user usually doesn't
    // have to pick. Stays null only when there is no active set on file.
    tireSetId: optStr,

    // Before-fill PSI per corner. Independently optional, but at least one is
    // required (enforced in superRefine below) so the row has actual data.
    flBefore: optPsi,
    frBefore: optPsi,
    rlBefore: optPsi,
    rrBefore: optPsi,

    // After-fill PSI per corner. Independently optional — a check-only event
    // (no air added) leaves all four blank, which is fine.
    flAfter: optPsi,
    frAfter: optPsi,
    rlAfter: optPsi,
    rrAfter: optPsi,

    notes: optStr,
  })
  .superRefine((val, ctx) => {
    // A row with zero Before readings carries no information. Force the user
    // to enter at least one corner — the form UI defaults all four visible.
    const anyBefore =
      val.flBefore != null ||
      val.frBefore != null ||
      val.rlBefore != null ||
      val.rrBefore != null;
    if (!anyBefore) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Enter at least one Before PSI value (FL, FR, RL, or RR).",
        path: ["flBefore"],
      });
    }
  });

export type PressureLogInput = z.infer<typeof pressureLogSchema>;

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
