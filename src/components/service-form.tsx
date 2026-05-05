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
  serviceTypesByCategory,
  getServiceTypeById,
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

  // Receipt UI: existing receipt is shown with a "remove" toggle. If the
  // user attaches a new file, the server replaces the old one on save.
  const [removeReceipt, setRemoveReceipt] = useState<boolean>(false);

  // Group service types by category for the dropdown's optgroups. Memoized
  // so we don't rebuild on every keystroke.
  const groups = useMemo(() => serviceTypesByCategory(), []);

  /**
   * When the user picks a service type from the dropdown, snap the
   * category to that type's catalog default. They can still change it
   * afterward (the category field is editable), but most users won't
   * need to.
   */
  function handleServiceTypeChange(id: string) {
    setServiceType(id);
    if (id === "custom") {
      // Leave category alone — user picks for custom entries.
      return;
    }
    const def = getServiceTypeById(id);
    if (def) setCategory(def.category);
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
  const isCustom = serviceType === "custom";

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

      <Section title="Part info" description="Optional — useful for repairs and parts you want to track.">
        <Field label="Brand">
          <Input name="partBrand" defaultValue={defaults?.partBrand ?? ""} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Part number">
            <Input
              name="partNumber"
              defaultValue={defaults?.partNumber ?? ""}
            />
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
      </Section>

      <Section title="Warranty" description="Set whichever the part comes with.">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Months">
            <Input
              name="warrantyMonths"
              inputMode="numeric"
              pattern="[0-9]*"
              defaultValue={defaults?.warrantyMonths ?? ""}
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
