import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Combine Tailwind class names safely.
 * - clsx handles conditional/array/object class inputs
 * - twMerge resolves conflicts (e.g. "px-2 px-4" → "px-4")
 *
 * Used by every UI component so callers can pass `className` overrides
 * without worrying about Tailwind specificity collisions.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
