import { Button } from "@/components/ui/button";
import { Field, Section } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

/*
 * Used-car baseline intake form.
 *
 * Captures pre-existing condition the day the car enters the system, so
 * future maintenance has the right reference point. Every field except
 * mileage is optional — the user can come back and fill in more later.
 *
 * Layout strategy: each piece of the car gets its own Section. On a long
 * form like this, mobile users skim by section header, fill in what they
 * can measure, skip the rest.
 */

type BaselineDefaults = {
  mileageAtBaseline?: number | null;
  treadFL?: number | null;
  treadFR?: number | null;
  treadRL?: number | null;
  treadRR?: number | null;
  tireBrand?: string | null;
  tireModel?: string | null;
  tireDotDate?: string | null;
  brakePadFront?: number | null;
  brakePadRear?: number | null;
  rotorConditionFront?: string | null;
  rotorConditionRear?: string | null;
  batteryAgeMonths?: number | null;
  batteryCca?: number | null;
  batteryBrand?: string | null;
  oilCondition?: string | null;
  coolantCondition?: string | null;
  brakeFluidCondition?: string | null;
  transFluidCondition?: string | null;
  diffFluidCondition?: string | null;
  powerSteeringCondition?: string | null;
  beltsCondition?: string | null;
  hosesCondition?: string | null;
  knownIssues?: string | null;
  recentService?: string | null;
  notes?: string | null;
};

interface BaselineFormProps {
  action: (formData: FormData) => Promise<void> | void;
  defaults?: BaselineDefaults;
  vehicleSuggestedMileage?: number | null;
  submitLabel: string;
}

// Reusable condition picker for fluids and belts/hoses.
function ConditionSelect({
  name,
  defaultValue,
}: {
  name: string;
  defaultValue?: string | null;
}) {
  return (
    <Select name={name} defaultValue={defaultValue ?? ""}>
      <option value="">— Not inspected —</option>
      <option value="new">New</option>
      <option value="good">Good</option>
      <option value="fair">Fair</option>
      <option value="poor">Poor</option>
      <option value="unknown">Unknown</option>
    </Select>
  );
}

// Rotors have a different vocabulary than fluids — separate picker.
function RotorSelect({
  name,
  defaultValue,
}: {
  name: string;
  defaultValue?: string | null;
}) {
  return (
    <Select name={name} defaultValue={defaultValue ?? ""}>
      <option value="">— Not inspected —</option>
      <option value="good">Good</option>
      <option value="lipped">Lipped</option>
      <option value="scored">Scored</option>
      <option value="warped">Warped</option>
      <option value="replace">Replace</option>
    </Select>
  );
}

export function BaselineForm({
  action,
  defaults,
  vehicleSuggestedMileage,
  submitLabel,
}: BaselineFormProps) {
  // Pre-fill mileage from the vehicle's purchase mileage if no baseline yet.
  const mileageDefault =
    defaults?.mileageAtBaseline ?? vehicleSuggestedMileage ?? "";

  return (
    <form action={action} className="space-y-6">
      <Section
        title="Mileage"
        description="The odometer reading the day you're capturing this baseline."
      >
        <Field label="Current mileage" required>
          <Input
            name="mileageAtBaseline"
            inputMode="numeric"
            pattern="[0-9]*"
            required
            defaultValue={mileageDefault}
          />
        </Field>
      </Section>

      <Section
        title="Tires"
        description="Tread depth in 32nds — new tires are usually 10–11/32, replace at 4/32."
      >
        <div className="grid grid-cols-2 gap-3">
          <Field label="Front left" hint="32nds">
            <Input
              name="treadFL"
              inputMode="numeric"
              pattern="[0-9]*"
              defaultValue={defaults?.treadFL ?? ""}
            />
          </Field>
          <Field label="Front right" hint="32nds">
            <Input
              name="treadFR"
              inputMode="numeric"
              pattern="[0-9]*"
              defaultValue={defaults?.treadFR ?? ""}
            />
          </Field>
          <Field label="Rear left" hint="32nds">
            <Input
              name="treadRL"
              inputMode="numeric"
              pattern="[0-9]*"
              defaultValue={defaults?.treadRL ?? ""}
            />
          </Field>
          <Field label="Rear right" hint="32nds">
            <Input
              name="treadRR"
              inputMode="numeric"
              pattern="[0-9]*"
              defaultValue={defaults?.treadRR ?? ""}
            />
          </Field>
        </div>
        <Field label="Tire brand">
          <Input name="tireBrand" defaultValue={defaults?.tireBrand ?? ""} />
        </Field>
        <Field label="Tire model">
          <Input name="tireModel" defaultValue={defaults?.tireModel ?? ""} />
        </Field>
        <Field label="DOT date code" hint="e.g. 3220 = week 32 of 2020">
          <Input
            name="tireDotDate"
            defaultValue={defaults?.tireDotDate ?? ""}
            inputMode="numeric"
            pattern="[0-9]*"
          />
        </Field>
      </Section>

      <Section
        title="Brakes"
        description="Pad thickness in mm — new pads are ~10–12mm, replace at ~3mm."
      >
        <div className="grid grid-cols-2 gap-3">
          <Field label="Front pad" hint="mm">
            <Input
              name="brakePadFront"
              inputMode="decimal"
              defaultValue={defaults?.brakePadFront ?? ""}
            />
          </Field>
          <Field label="Rear pad" hint="mm">
            <Input
              name="brakePadRear"
              inputMode="decimal"
              defaultValue={defaults?.brakePadRear ?? ""}
            />
          </Field>
        </div>
        <Field label="Front rotors">
          <RotorSelect
            name="rotorConditionFront"
            defaultValue={defaults?.rotorConditionFront}
          />
        </Field>
        <Field label="Rear rotors">
          <RotorSelect
            name="rotorConditionRear"
            defaultValue={defaults?.rotorConditionRear}
          />
        </Field>
      </Section>

      <Section title="Battery">
        <Field label="Age" hint="Months since manufacture (or install)">
          <Input
            name="batteryAgeMonths"
            inputMode="numeric"
            pattern="[0-9]*"
            defaultValue={defaults?.batteryAgeMonths ?? ""}
          />
        </Field>
        <Field label="CCA" hint="Cold-cranking amps from a load tester">
          <Input
            name="batteryCca"
            inputMode="numeric"
            pattern="[0-9]*"
            defaultValue={defaults?.batteryCca ?? ""}
          />
        </Field>
        <Field label="Brand">
          <Input
            name="batteryBrand"
            defaultValue={defaults?.batteryBrand ?? ""}
          />
        </Field>
      </Section>

      <Section title="Fluid conditions">
        <Field label="Engine oil">
          <ConditionSelect
            name="oilCondition"
            defaultValue={defaults?.oilCondition}
          />
        </Field>
        <Field label="Coolant">
          <ConditionSelect
            name="coolantCondition"
            defaultValue={defaults?.coolantCondition}
          />
        </Field>
        <Field label="Brake fluid">
          <ConditionSelect
            name="brakeFluidCondition"
            defaultValue={defaults?.brakeFluidCondition}
          />
        </Field>
        <Field label="Transmission fluid">
          <ConditionSelect
            name="transFluidCondition"
            defaultValue={defaults?.transFluidCondition}
          />
        </Field>
        <Field label="Differential / transfer case">
          <ConditionSelect
            name="diffFluidCondition"
            defaultValue={defaults?.diffFluidCondition}
          />
        </Field>
        <Field label="Power steering">
          <ConditionSelect
            name="powerSteeringCondition"
            defaultValue={defaults?.powerSteeringCondition}
          />
        </Field>
      </Section>

      <Section title="Belts & hoses">
        <Field label="Belts">
          <ConditionSelect
            name="beltsCondition"
            defaultValue={defaults?.beltsCondition}
          />
        </Field>
        <Field label="Hoses">
          <ConditionSelect
            name="hosesCondition"
            defaultValue={defaults?.hosesCondition}
          />
        </Field>
      </Section>

      <Section title="Notes">
        <Field
          label="Known issues"
          hint="What's already wrong? Noises, leaks, warning lights, etc."
        >
          <Textarea
            name="knownIssues"
            defaultValue={defaults?.knownIssues ?? ""}
            rows={3}
          />
        </Field>
        <Field
          label="Recent service"
          hint="What did the previous owner say they recently did?"
        >
          <Textarea
            name="recentService"
            defaultValue={defaults?.recentService ?? ""}
            rows={3}
          />
        </Field>
        <Field label="Other notes">
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
