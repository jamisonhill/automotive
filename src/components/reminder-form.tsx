"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Field, Section } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  serviceTypesByCategory,
  SERVICE_CATEGORIES,
  getServiceTypeById,
} from "@/lib/service-types";

/*
 * Reminder form — client component because:
 *   - Picking a service type auto-suggests a label (one less thing to
 *     type), which we drive via local state.
 *   - The "Last done" override fields are optional but the user might
 *     toggle them, so we keep them available either way without a
 *     dedicated open/close toggle (kept simple for v1).
 *
 * Submission goes through a server action via <form action={...}>.
 * Don't set encType — React handles it for server-action forms;
 * setting it triggers a console warning on iOS Safari.
 */

type ReminderDefaults = {
  label?: string | null;
  serviceType?: string | null;
  intervalMiles?: number | null;
  intervalMonths?: number | null;
  lastDoneMiles?: number | null;
  lastDoneAt?: Date | null;
  isActive?: boolean | null;
  notes?: string | null;
};

interface ReminderFormProps {
  action: (formData: FormData) => Promise<void> | void;
  defaults?: ReminderDefaults;
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

function num(v: number | null | undefined): string {
  return v == null ? "" : String(v);
}

export function ReminderForm({
  action,
  defaults,
  submitLabel,
}: ReminderFormProps) {
  // Track label + serviceType in state so picking a type can auto-fill
  // the label (only when the label is currently empty — never overwrite
  // something the user typed).
  const [label, setLabel] = useState<string>(defaults?.label ?? "");
  const [serviceType, setServiceType] = useState<string>(
    defaults?.serviceType ?? ""
  );

  // Hydration-safe lastDone date — mirrors the pattern used everywhere
  // else (no new Date() at render time).
  const [lastDoneAt, setLastDoneAt] = useState<string>(
    defaults?.lastDoneAt ? dateTimeInputValue(defaults.lastDoneAt) : ""
  );

  function handleServiceTypeChange(value: string) {
    setServiceType(value);
    // Auto-suggest a label when the user picks a type and the label
    // field is currently blank — saves a typing step. If they typed
    // something already, don't overwrite it.
    if (value && !label) {
      const def = getServiceTypeById(value);
      if (def) setLabel(def.label);
    }
  }

  function stampLastDoneNow() {
    setLastDoneAt(dateTimeInputValue(new Date()));
  }

  const grouped = serviceTypesByCategory();

  return (
    <form action={action} className="space-y-6">
      <Section title="What & when">
        <Field
          label="Service type"
          hint="Optional — links this reminder to service entries so it
                advances automatically when matching work is logged."
        >
          <Select
            name="serviceType"
            value={serviceType}
            onChange={(e) => handleServiceTypeChange(e.target.value)}
          >
            <option value="">— none —</option>
            {SERVICE_CATEGORIES.map((cat) => (
              <optgroup key={cat.id} label={cat.label}>
                {grouped[cat.id].map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.label}
                  </option>
                ))}
              </optgroup>
            ))}
          </Select>
        </Field>

        <Field label="Label" required>
          <Input
            name="label"
            required
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="e.g., Oil change"
          />
        </Field>
      </Section>

      <Section
        title="Interval"
        description="Set at least one. Whichever expires first triggers."
      >
        <div className="grid grid-cols-2 gap-3">
          <Field label="Every (miles)">
            <Input
              name="intervalMiles"
              type="number"
              min={0}
              step={1}
              inputMode="numeric"
              defaultValue={num(defaults?.intervalMiles)}
              placeholder="e.g., 5000"
            />
          </Field>
          <Field label="Every (months)">
            <Input
              name="intervalMonths"
              type="number"
              min={0}
              step={1}
              inputMode="numeric"
              defaultValue={num(defaults?.intervalMonths)}
              placeholder="e.g., 6"
            />
          </Field>
        </div>
      </Section>

      <Section
        title="Last done (optional)"
        description="Use this if the work was done before you started tracking
                    here. Leave blank to let matching service entries fill it
                    in automatically."
      >
        <Field label="Mileage">
          <Input
            name="lastDoneMiles"
            type="number"
            min={0}
            step={1}
            inputMode="numeric"
            defaultValue={num(defaults?.lastDoneMiles)}
            placeholder="miles"
          />
        </Field>
        <Field label="Date">
          <div className="flex gap-2">
            <Input
              type="datetime-local"
              name="lastDoneAt"
              value={lastDoneAt}
              onChange={(e) => setLastDoneAt(e.target.value)}
              className="flex-1"
            />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={stampLastDoneNow}
            >
              Now
            </Button>
          </div>
        </Field>
      </Section>

      <Section title="Status">
        {/*
         * Browsers do NOT submit unchecked checkboxes at all. To make
         * "unchecked" survive as false instead of falling back to the
         * schema's default-true, emit a hidden "off" first; the
         * checkbox below overrides it with "on" when checked. Order
         * matters here — formDataToObject reads the LAST value for a
         * given name, so the checkbox must come *after* the hidden.
         */}
        <input type="hidden" name="isActive" value="off" />
        <Label className="flex items-center gap-2 cursor-pointer select-none">
          <input
            type="checkbox"
            name="isActive"
            defaultChecked={defaults?.isActive ?? true}
            className="size-4 accent-current"
          />
          <span>Active</span>
        </Label>
      </Section>

      <Section title="Notes">
        <Field label="Notes">
          <Textarea
            name="notes"
            defaultValue={defaults?.notes ?? ""}
            rows={3}
            placeholder="e.g., Use full synthetic 0W-20"
          />
        </Field>
      </Section>

      <Button type="submit" size="lg">
        {submitLabel}
      </Button>
    </form>
  );
}
