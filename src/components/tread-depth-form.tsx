"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Field, Section } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { treadBand } from "@/lib/tread-projection";

/*
 * Per-corner tread depth form. Client component because:
 *   - Each corner shows live color-coded feedback (good / wearing /
 *     replace) as the user types, which needs controlled inputs.
 *   - The "Now" button on recordedAt has to stay hydration-safe
 *     (computed post-mount, never at render time).
 *
 * Submission still goes through a server action via <form action={...}>.
 * Don't set encType — React handles it for server-action forms; setting
 * it triggers a console warning on iOS Safari.
 */

type Corner = "fl" | "fr" | "rl" | "rr";

const CORNERS: { key: Corner; label: string }[] = [
  { key: "fl", label: "Front Left" },
  { key: "fr", label: "Front Right" },
  { key: "rl", label: "Rear Left" },
  { key: "rr", label: "Rear Right" },
];

type TreadDepthDefaults = {
  recordedAt?: Date | null;
  mileage?: number | null;
  fl?: number | null;
  fr?: number | null;
  rl?: number | null;
  rr?: number | null;
  notes?: string | null;
};

interface TreadDepthFormProps {
  action: (formData: FormData) => Promise<void> | void;
  defaults?: TreadDepthDefaults;
  /**
   * Last odometer reading on the vehicle. Used to pre-fill mileage on
   * a fresh entry so the user usually doesn't have to type it.
   */
  lastMileage: number | null;
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

export function TreadDepthForm({
  action,
  defaults,
  lastMileage,
  submitLabel,
}: TreadDepthFormProps) {
  // Hydration-safe: never call new Date() at render. New entries start
  // blank and let the user tap "Now". Edits render the persisted value.
  const seededRecordedAt = defaults?.recordedAt
    ? dateTimeInputValue(defaults.recordedAt)
    : "";
  const [recordedAt, setRecordedAt] = useState<string>(seededRecordedAt);

  // Track each corner as a string so we can read the typed value
  // (controlled), color-code via treadBand(), and still let the input
  // show empty before the first keystroke.
  const [corners, setCorners] = useState<Record<Corner, string>>({
    fl: num(defaults?.fl),
    fr: num(defaults?.fr),
    rl: num(defaults?.rl),
    rr: num(defaults?.rr),
  });

  function setCorner(key: Corner, value: string) {
    setCorners((prev) => ({ ...prev, [key]: value }));
  }

  function stampNow() {
    setRecordedAt(dateTimeInputValue(new Date()));
  }

  // Mileage default: persisted value on edit, last odometer on create.
  const mileageDefault =
    defaults?.mileage != null ? String(defaults.mileage) : num(lastMileage);

  return (
    <form action={action} className="space-y-6">
      <Section title="When">
        <Field label="Date" required>
          <div className="flex gap-2">
            <Input
              type="datetime-local"
              name="recordedAt"
              required
              value={recordedAt}
              onChange={(e) => setRecordedAt(e.target.value)}
              className="flex-1"
            />
            <Button type="button" variant="ghost" size="sm" onClick={stampNow}>
              Now
            </Button>
          </div>
        </Field>
        <Field label="Odometer" required>
          <Input
            name="mileage"
            inputMode="numeric"
            pattern="[0-9]*"
            required
            defaultValue={mileageDefault}
            placeholder="miles"
          />
        </Field>
      </Section>

      <Section
        title="Tread depth (32nds)"
        description="New: ~10/32. Replace at 2/32. Measure to the deepest groove."
      >
        {/* 2x2 grid mirrors the car looking down: FL/FR on top, RL/RR below. */}
        <div className="grid grid-cols-2 gap-3">
          {CORNERS.map((corner) => (
            <CornerInput
              key={corner.key}
              cornerKey={corner.key}
              label={corner.label}
              value={corners[corner.key]}
              onChange={(v) => setCorner(corner.key, v)}
            />
          ))}
        </div>
      </Section>

      <Section title="Notes">
        <Field label="Notes">
          <Textarea
            name="notes"
            defaultValue={defaults?.notes ?? ""}
            rows={3}
            placeholder="e.g., Outer edges wearing faster — schedule alignment"
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
 * Single corner input + live status badge. Color-coded by treadBand:
 *   good (≥6/32)    — neutral
 *   wearing (3-5)   — warning
 *   replace (≤2)    — danger
 */
function CornerInput({
  cornerKey,
  label,
  value,
  onChange,
}: {
  cornerKey: Corner;
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  // Parse on the fly. Empty / non-numeric → no badge yet.
  const parsed = value === "" ? null : Number(value);
  const valid = parsed != null && Number.isFinite(parsed);
  const band = valid ? treadBand(parsed) : null;

  const badge = band
    ? band === "replace"
      ? { label: "Replace", cls: "bg-danger/15 text-danger" }
      : band === "wearing"
        ? { label: "Wearing", cls: "bg-warning/15 text-warning" }
        : { label: "Good", cls: "bg-success/15 text-success" }
    : null;

  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.02] p-3 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <Label className="text-xs uppercase tracking-wide text-white/60 mb-0">
          {label}
        </Label>
        {badge && (
          <span
            className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${badge.cls}`}
          >
            {badge.label}
          </span>
        )}
      </div>
      <Input
        name={cornerKey}
        // type="number" + min/max means the browser enforces the bounds
        // and shows a "less than or equal to 20" tooltip on submit if
        // the user typo'd a too-big value. Without type="number" the
        // attributes are silently ignored. iOS Safari shows a numeric
        // keyboard for type="number" without needing inputMode.
        type="number"
        min={0}
        max={20}
        step={1}
        inputMode="numeric"
        required
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="32nds"
      />
    </div>
  );
}
