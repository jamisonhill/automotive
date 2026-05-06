"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Field, Section } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

/*
 * Issue / DTC log form — client component because:
 *   - The "Resolution" section only renders when status === "resolved",
 *     which we control via local state.
 *   - We keep DTC entry as plain text (the server normalizes), so this
 *     form doesn't need any complex validation UX.
 *
 * Submission still goes through a server action via <form action={...}>.
 */

type IssueStatus = "open" | "monitoring" | "resolved";

type IssueDefaults = {
  symptom?: string | null;
  status?: IssueStatus | null;
  reportedAt?: Date | null;
  reportedMileage?: number | null;
  diagnosis?: string | null;
  dtcCodes?: string | null;
  resolvedAt?: Date | null;
  resolvedServiceEntryId?: string | null;
  notes?: string | null;
};

/**
 * Service entries we can offer as a "what fixed it" pick when the user
 * marks an issue resolved. Kept lean on purpose — only the fields the
 * dropdown needs.
 */
export type ServiceEntryOption = {
  id: string;
  label: string;       // pre-rendered display label (serviceLabel(...) on server)
  performedAt: Date;
  odometer: number;
};

interface IssueFormProps {
  action: (formData: FormData) => Promise<void> | void;
  defaults?: IssueDefaults;
  serviceEntries: ServiceEntryOption[];
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

export function IssueForm({
  action,
  defaults,
  serviceEntries,
  submitLabel,
}: IssueFormProps) {
  // Hydration-safe: never call new Date() at render. For new entries we
  // leave reportedAt blank and let the user pick (or set "now" with the
  // button below). For edits we render the persisted value.
  const seededReportedAt = defaults?.reportedAt
    ? dateTimeInputValue(defaults.reportedAt)
    : "";
  const seededResolvedAt = defaults?.resolvedAt
    ? dateTimeInputValue(defaults.resolvedAt)
    : "";

  const [status, setStatus] = useState<IssueStatus>(defaults?.status ?? "open");
  const [reportedAt, setReportedAt] = useState<string>(seededReportedAt);
  const [resolvedAt, setResolvedAt] = useState<string>(seededResolvedAt);
  const [linkedServiceEntryId, setLinkedServiceEntryId] = useState<string>(
    defaults?.resolvedServiceEntryId ?? ""
  );

  /**
   * "Set to now" helper for the reportedAt field — saves a few taps on
   * mobile. Computed on click (post-mount) to stay hydration-safe.
   */
  function stampReportedNow() {
    setReportedAt(dateTimeInputValue(new Date()));
  }
  function stampResolvedNow() {
    setResolvedAt(dateTimeInputValue(new Date()));
  }

  return (
    <form action={action} className="space-y-6">
      <Section title="What's wrong" description="A short description of what you noticed.">
        <Field label="Symptom" required>
          <Textarea
            name="symptom"
            required
            defaultValue={defaults?.symptom ?? ""}
            rows={2}
            placeholder="e.g., Check engine light on; rough idle when cold"
          />
        </Field>
        <Field label="Status" required>
          <Select
            name="status"
            required
            value={status}
            onChange={(e) => setStatus(e.target.value as IssueStatus)}
          >
            <option value="open">Open</option>
            <option value="monitoring">Monitoring</option>
            <option value="resolved">Resolved</option>
          </Select>
        </Field>
      </Section>

      <Section title="When noticed">
        <Field label="Date" required>
          <div className="flex gap-2">
            <Input
              type="datetime-local"
              name="reportedAt"
              required
              value={reportedAt}
              onChange={(e) => setReportedAt(e.target.value)}
              className="flex-1"
            />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={stampReportedNow}
            >
              Now
            </Button>
          </div>
        </Field>
        <Field
          label="Odometer"
          hint="Optional — falls back to your latest reading."
        >
          <Input
            name="reportedMileage"
            inputMode="numeric"
            pattern="[0-9]*"
            defaultValue={defaults?.reportedMileage ?? ""}
          />
        </Field>
      </Section>

      <Section title="Diagnostic detail" description="Optional.">
        <Field
          label="DTC codes"
          hint="Comma- or space-separated, e.g. P0301 P0302"
        >
          <Input
            name="dtcCodes"
            defaultValue={defaults?.dtcCodes ?? ""}
            placeholder="P0301, P0302"
            autoCapitalize="characters"
          />
        </Field>
        <Field label="Diagnosis">
          <Textarea
            name="diagnosis"
            defaultValue={defaults?.diagnosis ?? ""}
            rows={2}
            placeholder="e.g., Cyl 1 misfire — bad coil pack"
          />
        </Field>
      </Section>

      {status === "resolved" && (
        <Section
          title="Resolution"
          description="Optional — link to the service entry that fixed it."
        >
          <Field label="Resolved at" hint="Defaults to now if left blank.">
            <div className="flex gap-2">
              <Input
                type="datetime-local"
                name="resolvedAt"
                value={resolvedAt}
                onChange={(e) => setResolvedAt(e.target.value)}
                className="flex-1"
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={stampResolvedNow}
              >
                Now
              </Button>
            </div>
          </Field>
          <Field label="Fixed by">
            <Select
              name="resolvedServiceEntryId"
              value={linkedServiceEntryId}
              onChange={(e) => setLinkedServiceEntryId(e.target.value)}
            >
              <option value="">— none —</option>
              {serviceEntries.map((s) => (
                <option key={s.id} value={s.id}>
                  {formatEntryDate(s.performedAt)} ·{" "}
                  {s.odometer.toLocaleString()} mi · {s.label}
                </option>
              ))}
            </Select>
          </Field>
        </Section>
      )}

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

function formatEntryDate(d: Date): string {
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "2-digit",
  });
}
