"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Field, Section } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

/*
 * Tire-set form — used for both install (new) and edit. The "replacing
 * my current tires" toggle is only meaningful on create, so we hide it
 * on edit via the showReplaceToggle prop.
 *
 * Hydration-safe: no new Date() at render. installedAt seeds blank for
 * new entries (the user picks the date) and from defaults on edit.
 */

type TireSetDefaults = {
  brand?: string | null;
  model?: string | null;
  size?: string | null;
  loadIndex?: string | null;
  speedRating?: string | null;
  treadwear?: number | null;
  installedAt?: Date | null;
  installMileage?: number | null;
  cost?: number | null;
  notes?: string | null;
};

interface TireSetFormProps {
  action: (formData: FormData) => Promise<void> | void;
  defaults?: TireSetDefaults;
  /** Whether to render the "replacing my current tires" checkbox. */
  showReplaceToggle: boolean;
  /** Display label for the active set being replaced (informational). */
  activeSetLabel?: string | null;
  submitLabel: string;
}

function dateInputValue(d: Date | null | undefined): string {
  if (!d) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function TireSetForm({
  action,
  defaults,
  showReplaceToggle,
  activeSetLabel,
  submitLabel,
}: TireSetFormProps) {
  const seededInstalledAt = defaults?.installedAt
    ? dateInputValue(defaults.installedAt)
    : "";

  // The replace toggle defaults to ON when there's an active set to
  // close out — that's the typical install path.
  const [closePrev, setClosePrev] = useState<boolean>(
    showReplaceToggle && activeSetLabel != null
  );

  return (
    <form action={action} className="space-y-6">
      <Section title="Tire identity" description="Brand, model, and size — found on the sidewall.">
        <Field label="Brand" required>
          <Input
            name="brand"
            required
            defaultValue={defaults?.brand ?? ""}
            placeholder="e.g., Michelin"
          />
        </Field>
        <Field label="Model" required>
          <Input
            name="model"
            required
            defaultValue={defaults?.model ?? ""}
            placeholder="e.g., Defender 2"
          />
        </Field>
        <Field label="Size" required hint="From the sidewall, e.g. 225/65R17">
          <Input
            name="size"
            required
            defaultValue={defaults?.size ?? ""}
            placeholder="225/65R17"
          />
        </Field>
      </Section>

      <Section title="Spec" description="Optional — read off the sidewall.">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Load index" hint="e.g., 102">
            <Input
              name="loadIndex"
              defaultValue={defaults?.loadIndex ?? ""}
              inputMode="numeric"
              pattern="[0-9]*"
            />
          </Field>
          <Field label="Speed rating" hint="e.g., H, V, W">
            <Input
              name="speedRating"
              defaultValue={defaults?.speedRating ?? ""}
              autoCapitalize="characters"
            />
          </Field>
        </div>
        <Field label="UTQG treadwear" hint="3-digit treadwear rating">
          <Input
            name="treadwear"
            inputMode="numeric"
            pattern="[0-9]*"
            defaultValue={defaults?.treadwear ?? ""}
            placeholder="e.g., 540"
          />
        </Field>
      </Section>

      <Section title="Install">
        <Field label="Installed on" required>
          <Input
            type="date"
            name="installedAt"
            required
            defaultValue={seededInstalledAt}
          />
        </Field>
        <Field
          label="Mileage at install"
          required
          hint="Whole miles when the tires went on"
        >
          <Input
            name="installMileage"
            inputMode="numeric"
            pattern="[0-9]*"
            required
            defaultValue={defaults?.installMileage ?? ""}
          />
        </Field>
      </Section>

      {showReplaceToggle && activeSetLabel && (
        <Section title="Replacing current tires?">
          <label className="flex items-start gap-3">
            <input
              type="checkbox"
              name="closePreviousSet"
              checked={closePrev}
              onChange={(e) => setClosePrev(e.target.checked)}
              className="mt-1 h-5 w-5 accent-accent"
            />
            <div className="flex-1">
              <p className="text-sm text-fg-primary">
                Mark the current set as removed
              </p>
              <p className="text-xs text-fg-muted">
                {activeSetLabel} will be stamped removed at this install
                date and mileage. Turn off if you're tracking a separate
                set (e.g., snows alongside summers).
              </p>
            </div>
          </label>
        </Section>
      )}
      {/* Hidden field ensures closePreviousSet is in the FormData even
          when the visible checkbox isn't rendered (edit page). */}
      {!showReplaceToggle && (
        <input type="hidden" name="closePreviousSet" value="false" />
      )}

      <Section title="Cost">
        <Field label="Total" hint="$ — parts + mounting + balancing">
          <Input
            name="cost"
            inputMode="decimal"
            defaultValue={defaults?.cost ?? ""}
          />
        </Field>
      </Section>

      <Section title="Notes">
        <Field label="Notes">
          <Textarea
            name="notes"
            rows={3}
            defaultValue={defaults?.notes ?? ""}
            placeholder="DOT date code, where you bought them, etc."
          />
        </Field>
      </Section>

      <Button type="submit" size="lg">
        {submitLabel}
      </Button>
    </form>
  );
}

/*
 * Tire-removal form — used on the edit page to mark a still-active set
 * as removed (sold, worn out, switched seasonal). Separate component
 * because the field set is small and the UX is a discrete event.
 */

interface TireSetRemovalFormProps {
  action: (formData: FormData) => Promise<void> | void;
  installMileage: number;
}

export function TireSetRemovalForm({
  action,
  installMileage,
}: TireSetRemovalFormProps) {
  return (
    <form action={action} className="space-y-4">
      <Field label="Removed on" required>
        <Input type="date" name="removedAt" required />
      </Field>
      <Field
        label="Mileage at removal"
        required
        hint={`Must be ≥ install mileage (${installMileage.toLocaleString()})`}
      >
        <Input
          name="removeMileage"
          inputMode="numeric"
          pattern="[0-9]*"
          required
          defaultValue={installMileage}
        />
      </Field>
      <Field label="Reason">
        <Select name="removeReason" defaultValue="">
          <option value="">—</option>
          <option value="worn">Worn out</option>
          <option value="damage">Damage</option>
          <option value="upgrade">Upgrade</option>
          <option value="seasonal">Seasonal swap</option>
        </Select>
      </Field>
      <Field label="Notes">
        <Textarea name="removeNotes" rows={2} placeholder="Optional" />
      </Field>
      <Button type="submit" variant="secondary" size="lg">
        Mark as removed
      </Button>
    </form>
  );
}
