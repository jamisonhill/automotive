/*
 * Curated catalog of common service types.
 *
 * Why a fixed list:
 *   - Free-form serviceType means "oil change", "Oil Change", "oil-change",
 *     and "oil_change" all live as separate strings, breaking grouping/history.
 *   - Pinning to ids gives us stable per-component history queries
 *     (e.g., "show me every alternator replacement").
 *
 * The schema field `customLabel` exists for the rare case the user needs
 * something not on this list — they pick "custom" and type a label.
 *
 * If you add an entry, do NOT renumber existing ids; ids are stored in the DB.
 */

export type ServiceCategory =
  | "routine"
  | "repair"
  | "inspection"
  | "modification"
  | "diagnostic";

export interface ServiceTypeDef {
  id: string;
  label: string;
  category: ServiceCategory;
  // Suggested default warranty in months — common parts have manufacturer
  // warranties; the user can override on the form. Null = no default.
  defaultWarrantyMonths?: number;
}

export const SERVICE_TYPES: ServiceTypeDef[] = [
  // ---- Routine maintenance ------------------------------------------------
  { id: "oil_change", label: "Oil change", category: "routine" },
  { id: "tire_rotation", label: "Tire rotation", category: "routine" },
  { id: "air_filter", label: "Engine air filter", category: "routine" },
  { id: "cabin_filter", label: "Cabin air filter", category: "routine" },
  { id: "wiper_blades", label: "Wiper blades", category: "routine" },
  { id: "brake_fluid_flush", label: "Brake fluid flush", category: "routine" },
  { id: "coolant_flush", label: "Coolant flush", category: "routine" },
  { id: "transmission_flush", label: "Transmission fluid", category: "routine" },
  { id: "diff_fluid", label: "Differential fluid", category: "routine" },
  { id: "transfer_case_fluid", label: "Transfer case fluid", category: "routine" },
  { id: "power_steering_flush", label: "Power steering fluid", category: "routine" },
  { id: "spark_plugs", label: "Spark plugs", category: "routine" },
  { id: "serpentine_belt", label: "Serpentine belt", category: "routine" },
  { id: "timing_belt", label: "Timing belt", category: "routine" },
  { id: "fuel_filter", label: "Fuel filter", category: "routine" },

  // ---- Repairs ------------------------------------------------------------
  { id: "battery", label: "Battery", category: "repair", defaultWarrantyMonths: 36 },
  { id: "alternator", label: "Alternator", category: "repair", defaultWarrantyMonths: 24 },
  { id: "starter", label: "Starter", category: "repair", defaultWarrantyMonths: 24 },
  { id: "brake_pads", label: "Brake pads", category: "repair", defaultWarrantyMonths: 12 },
  { id: "brake_rotors", label: "Brake rotors", category: "repair", defaultWarrantyMonths: 12 },
  { id: "brake_calipers", label: "Brake calipers", category: "repair", defaultWarrantyMonths: 24 },
  { id: "shocks_struts", label: "Shocks / struts", category: "repair", defaultWarrantyMonths: 24 },
  { id: "control_arm", label: "Control arm", category: "repair", defaultWarrantyMonths: 24 },
  { id: "wheel_bearing", label: "Wheel bearing", category: "repair", defaultWarrantyMonths: 24 },
  { id: "cv_axle", label: "CV axle", category: "repair", defaultWarrantyMonths: 12 },
  { id: "water_pump", label: "Water pump", category: "repair", defaultWarrantyMonths: 24 },
  { id: "thermostat", label: "Thermostat", category: "repair", defaultWarrantyMonths: 12 },
  { id: "radiator", label: "Radiator", category: "repair", defaultWarrantyMonths: 24 },
  { id: "ac_recharge", label: "A/C recharge", category: "repair" },
  { id: "ac_compressor", label: "A/C compressor", category: "repair", defaultWarrantyMonths: 12 },
  { id: "tires_replace", label: "Tires (replacement)", category: "repair" },
  { id: "windshield", label: "Windshield", category: "repair" },

  // ---- Inspections --------------------------------------------------------
  { id: "state_inspection", label: "State inspection", category: "inspection" },
  { id: "emissions_test", label: "Emissions test", category: "inspection" },
  { id: "pre_purchase_inspection", label: "Pre-purchase inspection", category: "inspection" },
  { id: "alignment_check", label: "Alignment check", category: "inspection" },

  // ---- Modifications ------------------------------------------------------
  { id: "alignment", label: "Wheel alignment", category: "modification" },
  { id: "tint", label: "Window tint", category: "modification" },
  { id: "dash_cam", label: "Dash cam", category: "modification" },
  { id: "audio", label: "Audio / stereo", category: "modification" },
  { id: "lighting", label: "Lighting", category: "modification" },

  // ---- Diagnostic ---------------------------------------------------------
  { id: "diagnostic_scan", label: "Diagnostic / scan", category: "diagnostic" },

  // ---- Escape hatch -------------------------------------------------------
  { id: "custom", label: "Custom (type below)", category: "routine" },
];

export const SERVICE_CATEGORIES: { id: ServiceCategory; label: string }[] = [
  { id: "routine", label: "Routine" },
  { id: "repair", label: "Repair" },
  { id: "inspection", label: "Inspection" },
  { id: "modification", label: "Modification" },
  { id: "diagnostic", label: "Diagnostic" },
];

export function getServiceTypeById(id: string): ServiceTypeDef | undefined {
  return SERVICE_TYPES.find((t) => t.id === id);
}

/**
 * Render a service entry's user-visible label.
 * For "custom" entries, prefer the customLabel the user typed; otherwise
 * fall back to the catalog label.
 */
export function serviceLabel(
  serviceType: string,
  customLabel: string | null | undefined
): string {
  if (serviceType === "custom" && customLabel) return customLabel;
  const def = getServiceTypeById(serviceType);
  return def?.label ?? serviceType;
}

/**
 * Suggested part brands per service type. These are *suggestions* surfaced
 * via a <datalist> on the part-brand input — not a closed list. The user
 * can still type whatever they want.
 *
 * Aim for 4–6 widely-recognized brands per type, plus "OEM" where it's a
 * meaningful option. Order matters: most popular first.
 *
 * If a service type isn't in this map, the brand input has no suggestions
 * (which is fine — most tool-like service types don't have a "part brand").
 */
const BRAND_SUGGESTIONS: Record<string, string[]> = {
  // Routine — fluids and consumables
  oil_change: ["Mobil 1", "Pennzoil", "Castrol", "Valvoline", "Royal Purple", "OEM"],
  air_filter: ["K&N", "Fram", "WIX", "Bosch", "OEM"],
  cabin_filter: ["Bosch", "WIX", "Fram", "K&N", "OEM"],
  wiper_blades: ["Bosch", "Rain-X", "Trico", "Michelin", "OEM"],
  spark_plugs: ["NGK", "Denso", "Bosch", "Champion", "OEM"],
  serpentine_belt: ["Gates", "Goodyear", "Continental", "Dayco", "OEM"],
  timing_belt: ["Gates", "Continental", "Aisin", "OEM"],
  fuel_filter: ["WIX", "Bosch", "Mahle", "OEM"],
  brake_fluid_flush: ["Motul", "ATE", "Castrol", "Bosch", "OEM"],
  coolant_flush: ["Prestone", "Zerex", "Peak", "OEM"],
  transmission_flush: ["Valvoline", "Castrol", "Mobil", "Amsoil", "OEM"],
  diff_fluid: ["Mobil 1", "Royal Purple", "Amsoil", "Red Line", "OEM"],
  power_steering_flush: ["Lubegard", "Prestone", "OEM"],

  // Repairs — wear parts and major components
  battery: ["Optima", "Interstate", "DieHard", "Duralast", "AC Delco", "Bosch", "OEM"],
  alternator: ["Denso", "Bosch", "AC Delco", "Remanufactured", "OEM"],
  starter: ["Denso", "Bosch", "AC Delco", "Remanufactured", "OEM"],
  brake_pads: ["Akebono", "Bosch", "EBC", "PowerStop", "Wagner", "OEM"],
  brake_rotors: ["Brembo", "Bosch", "PowerStop", "Wagner", "Centric", "OEM"],
  brake_calipers: ["Centric", "Wagner", "Cardone", "OEM"],
  shocks_struts: ["Bilstein", "KYB", "Monroe", "Koni", "OEM"],
  control_arm: ["Moog", "Mevotech", "Dorman", "OEM"],
  wheel_bearing: ["Timken", "SKF", "Moog", "OEM"],
  cv_axle: ["GSP", "SurTrack", "Cardone", "OEM"],
  water_pump: ["Aisin", "Gates", "Bosch", "Denso", "OEM"],
  thermostat: ["Stant", "Gates", "Motorcraft", "OEM"],
  radiator: ["Denso", "Mishimoto", "Spectra", "Koyorad", "OEM"],
  ac_compressor: ["Denso", "Four Seasons", "Cardone", "OEM"],
  tires_replace: [
    "Michelin",
    "Continental",
    "Bridgestone",
    "Goodyear",
    "Pirelli",
    "Falken",
    "Kumho",
    "BFGoodrich",
  ],
};

/**
 * Returns brand suggestions for a service type, or an empty array.
 * Used to populate the <datalist> behind the part-brand input.
 */
export function getBrandSuggestions(serviceType: string): string[] {
  return BRAND_SUGGESTIONS[serviceType] ?? [];
}

/**
 * Group service types by category for rendering inside an optgroup-style
 * dropdown. Excludes the "custom" entry (callers add it as a separate option
 * at the bottom of the picker).
 */
export function serviceTypesByCategory(): Record<ServiceCategory, ServiceTypeDef[]> {
  const groups: Record<ServiceCategory, ServiceTypeDef[]> = {
    routine: [],
    repair: [],
    inspection: [],
    modification: [],
    diagnostic: [],
  };
  for (const t of SERVICE_TYPES) {
    if (t.id === "custom") continue;
    groups[t.category].push(t);
  }
  return groups;
}
