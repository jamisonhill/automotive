"use client";

import Image from "next/image";
import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Field, Section } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  SERVICE_CATEGORIES,
  type ServiceCategory,
  getBrandSuggestions,
  getServiceTypeById,
  serviceTypesByCategory,
} from "@/lib/service-types";

/*
 * Service entry form — client component because:
 *   - Service-type selection drives default category and shows/hides
 *     type-specific sections (oil change, repair narrative).
 *   - Cost split: typing parts + labor auto-fills total on blur.
 *   - Receipt preview: show the existing receipt with a "remove" toggle.
 *
 * The Save submission still uses a server action via <form action={...}>.
 */

type ServiceDefaults = {
  category?: ServiceCategory | null;
  serviceType?: string | null;
  customLabel?: string | null;
  performedAt?: Date | null;
  odometer?: number | null;

  partBrand?: string | null;
  partNumber?: string | null;
  partCondition?: "new" | "reman" | "used" | null;
  supplier?: string | null;

  warrantyMonths?: number | null;
  warrantyMiles?: number | null;

  partsCost?: number | null;
  laborCost?: number | null;
  totalCost?: number | null;

  diy?: boolean | null;
  shopName?: string | null;

  symptoms?: string | null;
  diagnosis?: string | null;

  oilType?: "conventional" | "synthetic" | "high-mileage" | "blend" | null;
  oilViscosity?: string | null;
  oilFilterPart?: string | null;

  notes?: string | null;
  receiptPath?: string | null;
};

interface ServiceFormProps {
  action: (formData: FormData) => Promise<void> | void;
  defaults?: ServiceDefaults;
  submitLabel: string;
}

// Format a Date for <input type="datetime-local"> (yyyy-mm-ddThh:mm, local).
function dateTimeInputValue(d: Date | null | undefined): string {
  if (!d) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(
    d.getDate()
  )}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function ServiceForm({
  action,
  defaults,
  submitLabel,
}: ServiceFormProps) {
  // SSR-stable seed for performedAt — empty for new entries (the user will
  // pick a date), persisted value for edits. We avoid `new Date()` here for
  // the same hydration reason as the fuel form.
  const seededPerformedAt = defaults?.performedAt
    ? dateTimeInputValue(defaults.performedAt)
    : "";

  // Service type drives default category + which sections we show.
  const [serviceType, setServiceType] = useState<string>(
    defaults?.serviceType ?? ""
  );
  const [customLabel, setCustomLabel] = useState<string>(
    defaults?.customLabel ?? ""
  );
  const [category, setCategory] = useState<ServiceCategory>(
    (defaults?.category as ServiceCategory) ?? "routine"
  );

  // Cost split — typing two of {parts, labor, total} auto-derives the third.
  const [partsCost, setPartsCost] = useState<string>(
    defaults?.partsCost != null ? String(defaults.partsCost) : ""
  );
  const [laborCost, setLaborCost] = useState<string>(
    defaults?.laborCost != null ? String(defaults.laborCost) : ""
  );
  const [totalCost, setTotalCost] = useState<string>(
    defaults?.totalCost != null ? String(defaults.totalCost) : ""
  );

  // DIY/shop toggle. When DIY is on we hide the shop name field.
  const [diy, setDiy] = useState<boolean>(defaults?.diy ?? false);

  // Warranty months as controlled state so we can auto-fill from the
  // catalog default when the user picks a known service type.
  const [warrantyMonths, setWarrantyMonths] = useState<string>(
    defaults?.warrantyMonths != null ? String(defaults.warrantyMonths) : ""
  );

  // Receipt UI: existing receipt is shown with a "remove" toggle. If the
  // user attaches a new file, the server replaces the old one on save.
  const [removeReceipt, setRemoveReceipt] = useState<boolean>(false);

  // Group service types by category for the dropdown's optgroups. Memoized
  // so we don't rebuild on every keystroke.
  const groups = useMemo(() => serviceTypesByCategory(), []);

  // Brand suggestions for the part-brand <datalist>, scoped to whichever
  // service type is currently selected. Empty array = no datalist rendered.
  const brandSuggestions = useMemo(
    () => getBrandSuggestions(serviceType),
    [serviceType]
  );

  /**
   * When the user picks a service type from the dropdown:
   *   - Snap category to that type's catalog default.
   *   - Apply defaultWarrantyMonths if the warranty field is empty (don't
   *     stomp on a value the user already typed).
   * They can still change either afterward.
   */
  function handleServiceTypeChange(id: string) {
    setServiceType(id);
    if (id === "custom") {
      // Leave category and warranty alone — user picks for custom entries.
      return;
    }
    const def = getServiceTypeById(id);
    if (def) {
      setCategory(def.category);
      // Only auto-fill if the user hasn't already entered a warranty value.
      if (def.defaultWarrantyMonths != null && warrantyMonths === "") {
        setWarrantyMonths(String(def.defaultWarrantyMonths));
      }
    }
  }

  /**
   * Auto-fill the third of {parts, labor, total} when the user has typed
   * any two. Called on blur — the user can override any derived value
   * just by typing into that field.
   */
  function autofillCost() {
    const p = Number.parseFloat(partsCost);
    const l = Number.parseFloat(laborCost);
    const t = Number.parseFloat(totalCost);
    if (Number.isFinite(p) && Number.isFinite(l) && !Number.isFinite(t)) {
      setTotalCost((p + l).toFixed(2));
    } else if (
      Number.isFinite(p) &&
      Number.isFinite(t) &&
      !Number.isFinite(l)
    ) {
      setLaborCost((t - p).toFixed(2));
    } else if (
      Number.isFinite(l) &&
      Number.isFinite(t) &&
      !Number.isFinite(p)
    ) {
      setPartsCost((t - l).toFixed(2));
    }
  }

  const isOilChange = serviceType === "oil_change";
  const isRepair = category === "repair";
  const isModification = category === "modification";
  const isInspection = category === "inspection";
  const isDiagnostic = category === "diagnostic";
  const isCustom = serviceType === "custom";

  // Section visibility rules (Phase 4b — tighter conditional sections):
  //   - Warranty: only useful for repairs (where you're tracking part
  //     warranties on something that broke). Not shown for routine,
  //     inspections, modifications (typically aftermarket, no OEM
  //     warranty), or diagnostics.
  //   - Part info: inline for repair + modification + oil_change (where
  //     the brand/part-number/supplier of the part is meaningful). For
  //     routine, hidden behind a disclosure so the form is shorter.
  //     Hidden entirely for inspection + diagnostic (no part).
  const showWarranty = isRepair;
  const showPartInfoInline = isRepair || isModification || isOilChange;
  const showPartInfoCollapsed =
    !showPartInfoInline && !isInspection && !isDiagnostic;

  // Selected catalog entry (if any) — used for warranty placeholder hint.
  const selectedDef = useMemo(
    () => (serviceType ? getServiceTypeById(serviceType) : undefined),
    [serviceType]
  );
  const warrantyDefault = selectedDef?.defaultWarrantyMonths;

  return (
    <form action={action} className="space-y-6">
      <Section title="What was done" description="Pick from the catalog or choose Custom.">
        <Field label="Service" required>
          <Select
            name="serviceType"
            required
            value={serviceType}
            onChange={(e) => handleServiceTypeChange(e.target.value)}
          >
            <option value="" disabled>
              Select a service…
            </option>
            {SERVICE_CATEGORIES.map((cat) => {
              const types = groups[cat.id];
              if (types.length === 0) return null;
              return (
                <optgroup key={cat.id} label={cat.label}>
                  {types.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.label}
                    </option>
                  ))}
                </optgroup>
              );
            })}
            <option value="custom">Custom (type below)</option>
          </Select>
        </Field>
        {isCustom && (
          <Field
            label="Custom label"
            required
            hint="Short description of what was done"
          >
            <Input
              name="customLabel"
              required
              value={customLabel}
              onChange={(e) => setCustomLabel(e.target.value)}
              placeholder="e.g., Replaced glove box latch"
            />
          </Field>
        )}
        <Field label="Category" required>
          <Select
            name="category"
            required
            value={category}
            onChange={(e) => setCategory(e.target.value as ServiceCategory)}
          >
            {SERVICE_CATEGORIES.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </Select>
        </Field>
      </Section>

      <Section title="When">
        <Field label="Date" required>
          <Input
            type="datetime-local"
            name="performedAt"
            required
            defaultValue={seededPerformedAt}
          />
        </Field>
        <Field label="Odometer" required hint="Whole miles at time of service">
          <Input
            name="odometer"
            inputMode="numeric"
            pattern="[0-9]*"
            required
            defaultValue={defaults?.odometer ?? ""}
          />
        </Field>
      </Section>

      <Section title="Cost" description="Enter any two; the third auto-fills.">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Parts" hint="$">
            <Input
              name="partsCost"
              inputMode="decimal"
              value={partsCost}
              onChange={(e) => setPartsCost(e.target.value)}
              onBlur={autofillCost}
            />
          </Field>
          <Field label="Labor" hint="$">
            <Input
              name="laborCost"
              inputMode="decimal"
              value={laborCost}
              onChange={(e) => setLaborCost(e.target.value)}
              onBlur={autofillCost}
            />
          </Field>
        </div>
        <Field label="Total" hint="$">
          <Input
            name="totalCost"
            inputMode="decimal"
            value={totalCost}
            onChange={(e) => setTotalCost(e.target.value)}
            onBlur={autofillCost}
          />
        </Field>
      </Section>

      <Section title="Where">
        <label className="flex items-start gap-3">
          <input
            type="checkbox"
            name="diy"
            checked={diy}
            onChange={(e) => setDiy(e.target.checked)}
            className="mt-1 h-5 w-5 accent-accent"
          />
          <div className="flex-1">
            <p className="text-sm text-fg-primary">DIY (did it myself)</p>
            <p className="text-xs text-fg-muted">
              When checked, shop name is hidden.
            </p>
          </div>
        </label>
        {!diy && (
          <Field label="Shop">
            <Input
              name="shopName"
              defaultValue={defaults?.shopName ?? ""}
              placeholder="e.g., Firestone, Bob's Auto"
            />
          </Field>
        )}
      </Section>

      {/*
       * Part-brand suggestions. Rendered once at form level; each
       * brand input that wants suggestions points at this list via
       * `list="part-brand-suggestions"`. iOS Safari supports datalist.
       */}
      {brandSuggestions.length > 0 && (
        <datalist id="part-brand-suggestions">
          {brandSuggestions.map((b) => (
            <option key={b} value={b} />
          ))}
        </datalist>
      )}

      {/* Part info — inline for repair / modification / oil change. */}
      {showPartInfoInline && (
        <Section
          title="Part info"
          description="What you put in. Tap the brand field for common options."
        >
          <PartInfoFields
            defaults={defaults}
            hasBrandSuggestions={brandSuggestions.length > 0}
          />
        </Section>
      )}

      {/* Part info — collapsed disclosure for routine work. */}
      {showPartInfoCollapsed && (
        <details className="group rounded-md border border-border-subtle bg-bg-elevated">
          <summary className="flex cursor-pointer items-center justify-between px-3 py-3 text-sm font-medium text-fg-secondary">
            <span>Part info (optional)</span>
            <span className="text-xs text-fg-muted group-open:hidden">
              Tap to add brand, supplier, etc.
            </span>
          </summary>
          <div className="space-y-4 border-t border-border-subtle px-3 py-3">
            <PartInfoFields
              defaults={defaults}
              hasBrandSuggestions={brandSuggestions.length > 0}
            />
          </div>
        </details>
      )}

      {showWarranty && (
        <Section
          title="Warranty"
          description={
            warrantyDefault != null
              ? `${warrantyDefault}-month default applied — change or clear if it doesn't match.`
              : "Set whichever the part comes with."
          }
        >
          <div className="grid grid-cols-2 gap-3">
            <Field label="Months">
              <Input
                name="warrantyMonths"
                inputMode="numeric"
                pattern="[0-9]*"
                value={warrantyMonths}
                onChange={(e) => setWarrantyMonths(e.target.value)}
                placeholder={
                  warrantyDefault != null ? String(warrantyDefault) : undefined
                }
              />
            </Field>
            <Field label="Miles">
              <Input
                name="warrantyMiles"
                inputMode="numeric"
                pattern="[0-9]*"
                defaultValue={defaults?.warrantyMiles ?? ""}
              />
            </Field>
          </div>
        </Section>
      )}

      {isOilChange && (
        <Section title="Oil change details">
          <Field label="Oil type">
            <Select name="oilType" defaultValue={defaults?.oilType ?? ""}>
              <option value="">—</option>
              <option value="conventional">Conventional</option>
              <option value="synthetic">Full synthetic</option>
              <option value="blend">Synthetic blend</option>
              <option value="high-mileage">High mileage</option>
            </Select>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Viscosity" hint="e.g., 5W-30">
              <Input
                name="oilViscosity"
                defaultValue={defaults?.oilViscosity ?? ""}
              />
            </Field>
            <Field label="Filter part #">
              <Input
                name="oilFilterPart"
                defaultValue={defaults?.oilFilterPart ?? ""}
              />
            </Field>
          </div>
        </Section>
      )}

      {isRepair && (
        <Section title="Repair narrative" description="Optional — helpful for tracking why a repair was done.">
          <Field label="Symptoms">
            <Textarea
              name="symptoms"
              defaultValue={defaults?.symptoms ?? ""}
              rows={2}
              placeholder="e.g., Grinding noise on left turns"
            />
          </Field>
          <Field label="Diagnosis">
            <Textarea
              name="diagnosis"
              defaultValue={defaults?.diagnosis ?? ""}
              rows={2}
              placeholder="e.g., Worn left front wheel bearing"
            />
          </Field>
        </Section>
      )}

      <Section title="Receipt" description="Photo or PDF — optional but handy for warranty claims.">
        {defaults?.receiptPath && !removeReceipt && (
          <div className="flex items-center gap-3 rounded border border-border-subtle bg-bg-elevated p-2">
            {defaults.receiptPath.endsWith(".pdf") ? (
              <a
                href={`/api/receipts/${defaults.receiptPath}`}
                target="_blank"
                rel="noopener"
                className="text-sm text-accent underline"
              >
                Current receipt (PDF) — open
              </a>
            ) : (
              <Image
                src={`/api/receipts/${defaults.receiptPath}`}
                alt="Current receipt"
                width={96}
                height={96}
                className="rounded object-cover"
                unoptimized
              />
            )}
            <label className="flex items-center gap-2 text-sm text-fg-muted">
              <input
                type="checkbox"
                name="removeReceipt"
                checked={removeReceipt}
                onChange={(e) => setRemoveReceipt(e.target.checked)}
                className="h-5 w-5 accent-accent"
              />
              Remove on save
            </label>
          </div>
        )}
        <Field
          label={defaults?.receiptPath ? "Replace receipt" : "Upload receipt"}
        >
          <input
            type="file"
            name="receipt"
            accept="image/jpeg,image/png,image/webp,image/heic,image/heif,application/pdf"
            className="block w-full text-sm text-fg-primary file:mr-3 file:rounded file:border file:border-border-subtle file:bg-bg-elevated file:px-3 file:py-2 file:text-sm file:text-fg-primary"
          />
        </Field>
      </Section>

      <Section title="Notes">
        <Field label="Notes">
          <Textarea
            name="notes"
            defaultValue={defaults?.notes ?? ""}
            rows={3}
          />
        </Field>
      </Section>

      <Button type="submit" size="lg">
        {submitLabel}
      </Button>
    </form>
  );
}

/**
 * Shared part-info fields. Rendered inline for repair/modification/oil
 * changes, and inside a <details> disclosure for routine work — pulled
 * out so both call sites stay in sync.
 */
function PartInfoFields({
  defaults,
  hasBrandSuggestions,
}: {
  defaults?: ServiceDefaults;
  hasBrandSuggestions: boolean;
}) {
  return (
    <>
      <Field
        label="Brand"
        hint={hasBrandSuggestions ? "Tap field for suggestions" : undefined}
      >
        <Input
          name="partBrand"
          defaultValue={defaults?.partBrand ?? ""}
          // Wire to the form-level <datalist> only when we actually rendered
          // one; otherwise iOS shows a useless empty popover on focus.
          list={hasBrandSuggestions ? "part-brand-suggestions" : undefined}
        />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Part number">
          <Input name="partNumber" defaultValue={defaults?.partNumber ?? ""} />
        </Field>
        <Field label="Condition">
          <Select
            name="partCondition"
            defaultValue={defaults?.partCondition ?? ""}
          >
            <option value="">—</option>
            <option value="new">New</option>
            <option value="reman">Remanufactured</option>
            <option value="used">Used</option>
          </Select>
        </Field>
      </div>
      <Field label="Supplier" hint="Where you bought the part">
        <Input name="supplier" defaultValue={defaults?.supplier ?? ""} />
      </Field>
    </>
  );
}
