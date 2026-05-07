"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Field, Section } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

/*
 * Per-corner tire pressure log form — client component because:
 *   - "After fill" is a toggle that hides/shows the After column. We need
 *     local state to drive that.
 *   - The "Now" button on recordedAt has to stay hydration-safe (computed
 *     post-mount, never at render time). Same pattern as fuel/service/
 *     issue forms.
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

type CornerPsiDefaults = {
  flBefore?: number | null;
  frBefore?: number | null;
  rlBefore?: number | null;
  rrBefore?: number | null;
  flAfter?: number | null;
  frAfter?: number | null;
  rlAfter?: number | null;
  rrAfter?: number | null;
};

type PressureLogDefaults = CornerPsiDefaults & {
  recordedAt?: Date | null;
  ambientF?: number | null;
  tireSetId?: string | null;
  notes?: string | null;
};

/**
 * Tire set options for the picker. The page builds these — typically
 * the active set first (preselected) plus any other still-installed sets
 * (rare, but possible during a seasonal swap window).
 */
export type TireSetOption = {
  id: string;
  label: string;   // e.g. "Michelin CrossClimate 2 · 225/65R17"
  isActive: boolean;
};

interface PressureLogFormProps {
  action: (formData: FormData) => Promise<void> | void;
  defaults?: PressureLogDefaults;
  tireSetOptions: TireSetOption[];
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

// Format a numeric default for an <input>; blank string if null/undefined.
function num(v: number | null | undefined): string {
  return v == null ? "" : String(v);
}

export function PressureLogForm({
  action,
  defaults,
  tireSetOptions,
  submitLabel,
}: PressureLogFormProps) {
  // Hydration-safe: never call new Date() at render. New entries start
  // blank and let the user tap "Now" (computed post-mount). Edits render
  // the persisted value.
  const seededRecordedAt = defaults?.recordedAt
    ? dateTimeInputValue(defaults.recordedAt)
    : "";

  const [recordedAt, setRecordedAt] = useState<string>(seededRecordedAt);

  // Default the picker to the active set when there are no defaults.
  // On edit, defaults?.tireSetId is the persisted link.
  const initialTireSetId =
    defaults?.tireSetId ??
    tireSetOptions.find((s) => s.isActive)?.id ??
    "";
  const [tireSetId, setTireSetId] = useState<string>(initialTireSetId);

  // "After fill" toggle: on by default if any After value is present
  // (typical edit case), off otherwise (typical create case = check-only).
  const hasAnyAfter =
    defaults?.flAfter != null ||
    defaults?.frAfter != null ||
    defaults?.rlAfter != null ||
    defaults?.rrAfter != null;
  const [showAfter, setShowAfter] = useState<boolean>(hasAnyAfter);

  function stampNow() {
    setRecordedAt(dateTimeInputValue(new Date()));
  }

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
        <Field
          label="Ambient °F"
          hint="Optional — cold-fill PSI is the spec, so context matters."
        >
          <Input
            name="ambientF"
            inputMode="decimal"
            defaultValue={num(defaults?.ambientF)}
            placeholder="e.g., 55"
          />
        </Field>
      </Section>

      {tireSetOptions.length > 0 && (
        <Section
          title="Tire set"
          description="Defaults to the set currently on the car."
        >
          <Field label="Set">
            <Select
              name="tireSetId"
              value={tireSetId}
              onChange={(e) => setTireSetId(e.target.value)}
            >
              <option value="">— none on file —</option>
              {tireSetOptions.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                  {s.isActive ? " (current)" : ""}
                </option>
              ))}
            </Select>
          </Field>
        </Section>
      )}

      <Section
        title="PSI per corner"
        description="Enter at least one Before reading."
      >
        {/* "After fill" toggle gates the After column. Off = check-only event. */}
        <Label className="flex items-center gap-2 cursor-pointer select-none mb-2">
          <input
            type="checkbox"
            checked={showAfter}
            onChange={(e) => setShowAfter(e.target.checked)}
            className="size-4 accent-current"
          />
          <span>I added air (record After PSI too)</span>
        </Label>

        {/* 2×2 grid mirrors the car looking down: FL/FR on top, RL/RR below. */}
        <div className="grid grid-cols-2 gap-3">
          {CORNERS.map((corner) => {
            const beforeName = `${corner.key}Before`;
            const afterName = `${corner.key}After`;
            const beforeDefault = num(
              defaults?.[beforeName as keyof CornerPsiDefaults]
            );
            const afterDefault = num(
              defaults?.[afterName as keyof CornerPsiDefaults]
            );
            return (
              <div
                key={corner.key}
                className="rounded-lg border border-white/10 bg-white/[0.02] p-3 space-y-2"
              >
                <div className="text-xs font-medium uppercase tracking-wide text-white/60">
                  {corner.label}
                </div>
                <div>
                  <Label className="text-xs text-white/50">Before</Label>
                  <Input
                    name={beforeName}
                    inputMode="decimal"
                    defaultValue={beforeDefault}
                    placeholder="psi"
                  />
                </div>
                {showAfter && (
                  <div>
                    <Label className="text-xs text-white/50">After</Label>
                    <Input
                      name={afterName}
                      inputMode="decimal"
                      defaultValue={afterDefault}
                      placeholder="psi"
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </Section>

      <Section title="Notes">
        <Field label="Notes">
          <Textarea
            name="notes"
            defaultValue={defaults?.notes ?? ""}
            rows={3}
            placeholder="e.g., All four cold; checked after parking overnight"
          />
        </Field>
      </Section>

      <Button type="submit" size="lg">
        {submitLabel}
      </Button>
    </form>
  );
}
