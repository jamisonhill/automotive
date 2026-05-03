import { Button } from "@/components/ui/button";
import { Field, Section } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

/*
 * Shared form layout used by both /vehicles/new and /vehicles/[id]/edit.
 *
 * The action prop is a server action — both create and update share the same
 * field shape, so we just bind a different action depending on the route.
 *
 * defaults pre-fills inputs when editing.
 */
type VehicleDefaults = {
  nickname?: string | null;
  year?: number | null;
  make?: string | null;
  model?: string | null;
  trim?: string | null;
  vin?: string | null;
  engine?: string | null;
  transmission?: string | null;
  drivetrain?: string | null;
  color?: string | null;
  licensePlate?: string | null;
  purchaseDate?: Date | null;
  purchaseMileage?: number | null;
  purchasePrice?: number | null;
  notes?: string | null;
};

interface VehicleFormProps {
  action: (formData: FormData) => Promise<void> | void;
  defaults?: VehicleDefaults;
  submitLabel: string;
  /** When true, hide the photo input (we don't replace photos via /edit yet) */
  hidePhoto?: boolean;
}

// Format a Date for an <input type="date" /> (yyyy-mm-dd, local time).
function dateInputValue(d: Date | null | undefined): string {
  if (!d) return "";
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export function VehicleForm({
  action,
  defaults,
  submitLabel,
  hidePhoto,
}: VehicleFormProps) {
  return (
    <form action={action} className="space-y-6">
      <Section title="Identity">
        <Field label="Nickname" hint="Optional — e.g. 'Daily', 'Truck'">
          <Input name="nickname" defaultValue={defaults?.nickname ?? ""} />
        </Field>
        <div className="grid grid-cols-3 gap-3">
          <Field label="Year" required>
            <Input
              name="year"
              inputMode="numeric"
              pattern="[0-9]*"
              required
              defaultValue={defaults?.year ?? ""}
            />
          </Field>
          <div className="col-span-2">
            <Field label="Make" required>
              <Input
                name="make"
                required
                defaultValue={defaults?.make ?? ""}
                autoCapitalize="words"
              />
            </Field>
          </div>
        </div>
        <Field label="Model" required>
          <Input
            name="model"
            required
            defaultValue={defaults?.model ?? ""}
            autoCapitalize="words"
          />
        </Field>
        <Field label="Trim">
          <Input name="trim" defaultValue={defaults?.trim ?? ""} />
        </Field>
        <Field label="Color">
          <Input name="color" defaultValue={defaults?.color ?? ""} />
        </Field>
      </Section>

      <Section title="Specs">
        <Field label="Engine" hint="e.g. 3.5L V6">
          <Input name="engine" defaultValue={defaults?.engine ?? ""} />
        </Field>
        <Field label="Transmission" hint="e.g. 6-speed automatic">
          <Input
            name="transmission"
            defaultValue={defaults?.transmission ?? ""}
          />
        </Field>
        <Field label="Drivetrain">
          <Select name="drivetrain" defaultValue={defaults?.drivetrain ?? ""}>
            <option value="">— Select —</option>
            <option value="FWD">FWD</option>
            <option value="RWD">RWD</option>
            <option value="AWD">AWD</option>
            <option value="4WD">4WD</option>
          </Select>
        </Field>
        <Field label="VIN">
          <Input
            name="vin"
            defaultValue={defaults?.vin ?? ""}
            autoCapitalize="characters"
            spellCheck={false}
          />
        </Field>
        <Field label="License plate">
          <Input
            name="licensePlate"
            defaultValue={defaults?.licensePlate ?? ""}
            autoCapitalize="characters"
            spellCheck={false}
          />
        </Field>
      </Section>

      <Section title="Purchase">
        <Field label="Purchase date">
          <Input
            type="date"
            name="purchaseDate"
            defaultValue={dateInputValue(defaults?.purchaseDate)}
          />
        </Field>
        <Field
          label="Mileage at purchase"
          hint="Used as the baseline odometer reading"
        >
          <Input
            name="purchaseMileage"
            inputMode="numeric"
            pattern="[0-9]*"
            defaultValue={defaults?.purchaseMileage ?? ""}
          />
        </Field>
        <Field label="Purchase price">
          <Input
            name="purchasePrice"
            inputMode="decimal"
            defaultValue={defaults?.purchasePrice ?? ""}
          />
        </Field>
      </Section>

      {!hidePhoto && (
        <Section title="Photo" description="Optional — appears on the garage tile">
          <Field label="Vehicle photo" hint="JPEG, PNG, WebP, or HEIC. Max 10MB.">
            {/*
              capture="environment" hints to iOS that this is for the rear camera
              if the user picks "Take Photo" — but they can also pick from library.
            */}
            <Input
              type="file"
              name="photo"
              accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
              className="h-auto py-2 file:mr-3 file:rounded file:border-0 file:bg-bg-overlay file:px-3 file:py-1.5 file:text-sm file:text-fg-primary"
            />
          </Field>
        </Section>
      )}

      <Section title="Notes">
        <Field label="General notes" hint="Anything not captured above">
          <Textarea name="notes" defaultValue={defaults?.notes ?? ""} />
        </Field>
      </Section>

      <Button type="submit" size="lg">
        {submitLabel}
      </Button>
    </form>
  );
}
