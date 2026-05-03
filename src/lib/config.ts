import path from "node:path";

/*
 * Runtime config helpers.
 *
 * DATA_DIR is the root for all user-uploaded files (vehicle photos, receipt
 * photos, OCR captures pre-extraction). In production this is mounted as
 * /data in the container; locally it's ./data relative to the project root.
 *
 * Always import these helpers — never hand-construct file paths — so we have
 * one place to swap the storage backend later (e.g., S3) if we ever need to.
 */

export function dataDir(): string {
  return process.env.DATA_DIR ?? "/data";
}

export function photoDir(): string {
  return path.join(dataDir(), "photos");
}

export function receiptDir(): string {
  return path.join(dataDir(), "receipts");
}
