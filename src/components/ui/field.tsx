import * as React from "react";

import { cn } from "@/lib/utils";

import { Label } from "./label";

/*
 * Field — a Label + control + (optional) hint + (optional) error wrapper.
 *
 * Using this everywhere keeps form rows visually consistent and gives us
 * a single place to slot in error rendering once we add it.
 *
 * Usage:
 *   <Field label="Mileage" hint="Whole miles">
 *     <Input name="mileage" inputMode="numeric" />
 *   </Field>
 */
interface FieldProps {
  label: string;
  htmlFor?: string;
  hint?: string;
  error?: string;
  required?: boolean;
  className?: string;
  children: React.ReactNode;
}

export function Field({
  label,
  htmlFor,
  hint,
  error,
  required,
  className,
  children,
}: FieldProps) {
  return (
    <div className={cn("flex flex-col", className)}>
      <Label htmlFor={htmlFor}>
        {label}
        {required && <span className="text-danger ml-1">*</span>}
      </Label>
      {children}
      {hint && !error && (
        <p className="mt-1 text-xs text-fg-muted">{hint}</p>
      )}
      {error && <p className="mt-1 text-xs text-danger">{error}</p>}
    </div>
  );
}

/*
 * Section — visual grouping for related fields within a long form.
 * Title is rendered as a small uppercase label for low visual weight,
 * letting the form fields themselves carry the focus.
 */
interface SectionProps {
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
}

export function Section({
  title,
  description,
  children,
  className,
}: SectionProps) {
  return (
    <section className={cn("space-y-3", className)}>
      <div className="border-b border-border-subtle pb-1">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-fg-secondary">
          {title}
        </h2>
        {description && (
          <p className="mt-0.5 text-xs text-fg-muted">{description}</p>
        )}
      </div>
      <div className="space-y-4">{children}</div>
    </section>
  );
}
