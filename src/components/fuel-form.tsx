"use client";

import { Camera, Loader2 } from "lucide-react";
import { useRef, useState, useTransition } from "react";

import { extractPumpData } from "@/app/actions/fuel";
import { Button } from "@/components/ui/button";
import { Field, Section } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { resizeImageForOcr } from "@/lib/image-resize";

/*
 * Fuel entry form — client component because:
 *   - We auto-derive the third of {gallons, totalCost, pricePerGallon} from
 *     the other two as the user types.
 *   - The "Snap pump" flow opens the camera, resizes, calls the OCR action,
 *     and prefills the fields without a page reload.
 *
 * The "Save" submission still uses a server action via <form action={...}>.
 */

type FuelDefaults = {
  filledAt?: Date | null;
  odometer?: number | null;
  gallons?: number | null;
  totalCost?: number | null;
  pricePerGallon?: number | null;
  octane?: number | null;
  station?: string | null;
  partialFill?: boolean | null;
  missedFill?: boolean | null;
  notes?: string | null;
};

interface FuelFormProps {
  action: (formData: FormData) => Promise<void> | void;
  defaults?: FuelDefaults;
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

export function FuelForm({ action, defaults, submitLabel }: FuelFormProps) {
  // Default to "now" for new entries.
  const initialFilledAt = dateTimeInputValue(
    defaults?.filledAt ?? (defaults ? null : new Date())
  );

  // Controlled state for the three derivable fields. As the user edits any
  // two, the third auto-fills. The user can also just type all three.
  const [gallons, setGallons] = useState<string>(
    defaults?.gallons != null ? String(defaults.gallons) : ""
  );
  const [totalCost, setTotalCost] = useState<string>(
    defaults?.totalCost != null ? String(defaults.totalCost) : ""
  );
  const [pricePerGallon, setPricePerGallon] = useState<string>(
    defaults?.pricePerGallon != null ? String(defaults.pricePerGallon) : ""
  );
  const [octane, setOctane] = useState<string>(
    defaults?.octane != null ? String(defaults.octane) : ""
  );

  const [ocrError, setOcrError] = useState<string | null>(null);
  const [ocrNote, setOcrNote] = useState<string | null>(null);
  const [isOcr, startOcr] = useTransition();
  const fileInputRef = useRef<HTMLInputElement>(null);

  /**
   * Try to fill in the missing field of {gallons, totalCost, pricePerGallon}
   * from the other two. Called on each blur — the user can override any
   * derived value just by typing.
   */
  function autofillCost() {
    const g = Number.parseFloat(gallons);
    const t = Number.parseFloat(totalCost);
    const p = Number.parseFloat(pricePerGallon);
    if (Number.isFinite(g) && Number.isFinite(p) && !Number.isFinite(t)) {
      setTotalCost((g * p).toFixed(2));
    } else if (
      Number.isFinite(g) &&
      Number.isFinite(t) &&
      !Number.isFinite(p)
    ) {
      setPricePerGallon((t / g).toFixed(3));
    } else if (
      Number.isFinite(t) &&
      Number.isFinite(p) &&
      !Number.isFinite(g)
    ) {
      setGallons((t / p).toFixed(3));
    }
  }

  /**
   * Camera button click → open file picker that targets the rear camera.
   * iOS Safari shows the system camera UI when type=file + capture is set.
   */
  function openCamera() {
    setOcrError(null);
    setOcrNote(null);
    fileInputRef.current?.click();
  }

  /**
   * After the user takes a photo:
   *   1. Resize on-device to ~1280px JPEG (faster upload, cheaper OCR)
   *   2. Send to Claude vision via the extractPumpData server action
   *   3. Prefill fields from whatever Claude returns
   */
  async function onPhotoSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    // Reset the input so picking the same file twice still re-fires onChange.
    e.target.value = "";

    startOcr(async () => {
      setOcrError(null);
      setOcrNote(null);
      try {
        const resized = await resizeImageForOcr(file);
        const fd = new FormData();
        fd.append("photo", resized, "pump.jpg");

        const result = await extractPumpData(fd);
        if (!result.ok) {
          setOcrError(result.error);
          return;
        }
        const d = result.data;
        if (d.gallons != null) setGallons(String(d.gallons));
        if (d.totalCost != null) setTotalCost(String(d.totalCost));
        if (d.pricePerGallon != null)
          setPricePerGallon(String(d.pricePerGallon));
        if (d.octane != null) setOctane(String(d.octane));
        if (d.uncertain) setOcrNote(d.uncertain);
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "OCR failed unexpectedly.";
        setOcrError(message);
      }
    });
  }

  return (
    <form action={action} className="space-y-6">
      {/* Hidden file input controlled by the camera button */}
      <input
        ref={fileInputRef}
        type="file"
        name="__ocrPhoto"
        accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
        capture="environment"
        className="hidden"
        onChange={onPhotoSelected}
      />

      <Section
        title="Pump"
        description="Snap a photo of the pump screen and we'll fill in the numbers."
      >
        <Button
          type="button"
          variant="secondary"
          size="lg"
          onClick={openCamera}
          disabled={isOcr}
        >
          {isOcr ? (
            <>
              <Loader2 className="h-5 w-5 animate-spin" />
              Reading pump…
            </>
          ) : (
            <>
              <Camera className="h-5 w-5" />
              Snap pump screen
            </>
          )}
        </Button>
        {ocrError && (
          <p className="text-sm text-danger">{ocrError}</p>
        )}
        {ocrNote && (
          <p className="text-sm text-warning">⚠ {ocrNote}</p>
        )}
      </Section>

      <Section title="Fill-up">
        <Field label="When" required>
          <Input
            type="datetime-local"
            name="filledAt"
            required
            defaultValue={initialFilledAt}
          />
        </Field>
        <Field label="Odometer" required hint="Whole miles, current reading">
          <Input
            name="odometer"
            inputMode="numeric"
            pattern="[0-9]*"
            required
            defaultValue={defaults?.odometer ?? ""}
          />
        </Field>
        <Field label="Gallons" required>
          <Input
            name="gallons"
            inputMode="decimal"
            required
            value={gallons}
            onChange={(e) => setGallons(e.target.value)}
            onBlur={autofillCost}
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Total cost" hint="$">
            <Input
              name="totalCost"
              inputMode="decimal"
              value={totalCost}
              onChange={(e) => setTotalCost(e.target.value)}
              onBlur={autofillCost}
            />
          </Field>
          <Field label="$ / gallon">
            <Input
              name="pricePerGallon"
              inputMode="decimal"
              value={pricePerGallon}
              onChange={(e) => setPricePerGallon(e.target.value)}
              onBlur={autofillCost}
            />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Octane" hint="87 / 89 / 91 / 93">
            <Input
              name="octane"
              inputMode="numeric"
              pattern="[0-9]*"
              value={octane}
              onChange={(e) => setOctane(e.target.value)}
            />
          </Field>
          <Field label="Station">
            <Input
              name="station"
              defaultValue={defaults?.station ?? ""}
            />
          </Field>
        </div>
      </Section>

      <Section title="Notes">
        <label className="flex items-start gap-3">
          <input
            type="checkbox"
            name="partialFill"
            defaultChecked={defaults?.partialFill ?? false}
            className="mt-1 h-5 w-5 accent-accent"
          />
          <div className="flex-1">
            <p className="text-sm text-fg-primary">Partial fill</p>
            <p className="text-xs text-fg-muted">
              MPG won&apos;t be calculated for this fill. Gallons will count
              toward your next full fill.
            </p>
          </div>
        </label>
        <label className="flex items-start gap-3">
          <input
            type="checkbox"
            name="missedFill"
            defaultChecked={defaults?.missedFill ?? false}
            className="mt-1 h-5 w-5 accent-accent"
          />
          <div className="flex-1">
            <p className="text-sm text-fg-primary">I missed a previous fill</p>
            <p className="text-xs text-fg-muted">
              MPG since the last logged fill is unreliable. This entry resets
              the trip counter.
            </p>
          </div>
        </label>
        <Field label="Notes">
          <Textarea
            name="notes"
            defaultValue={defaults?.notes ?? ""}
            rows={2}
          />
        </Field>
      </Section>

      <Button type="submit" size="lg">
        {submitLabel}
      </Button>
    </form>
  );
}
