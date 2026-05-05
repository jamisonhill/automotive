import { createHash, randomBytes } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { receiptDir } from "@/lib/config";

/*
 * Receipt upload handling.
 *
 * Mirrors src/lib/photos.ts but accepts PDFs in addition to images, since
 * service receipts come in both forms (paper receipt photo or emailed PDF).
 *
 * Storage strategy is identical to photos:
 *   - Validate MIME type and size before touching disk
 *   - Pick extension from MIME type (don't trust the original filename)
 *   - Filename = sha256(content)[:16] + random suffix + ext
 *   - Store under DATA_DIR/receipts
 *   - DB persists only the bare filename, not the path — keeps storage portable.
 */

const ALLOWED_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
  "application/pdf",
]);

const MAX_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

const TYPE_TO_EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/heic": "heic",
  "image/heif": "heif",
  "application/pdf": "pdf",
};

export async function saveReceiptUpload(file: File): Promise<string> {
  if (!ALLOWED_TYPES.has(file.type)) {
    throw new Error(
      `Unsupported receipt type: ${file.type}. Use JPEG, PNG, WebP, HEIC, or PDF.`
    );
  }
  if (file.size > MAX_SIZE_BYTES) {
    throw new Error(
      `Receipt too large (${Math.round(file.size / 1024 / 1024)}MB). Max 10MB.`
    );
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const hash = createHash("sha256").update(buffer).digest("hex").slice(0, 16);
  const suffix = randomBytes(4).toString("hex");
  const ext = TYPE_TO_EXT[file.type] ?? "bin";
  const filename = `${hash}-${suffix}.${ext}`;

  const dir = receiptDir();
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, filename), buffer);

  return filename;
}

/**
 * Defense-in-depth filename validator — same shape as photos but allows pdf.
 * Used by the receipt-serving route handler before joining with receiptDir.
 */
export function isSafeReceiptFilename(name: string): boolean {
  if (name.includes("/") || name.includes("\\") || name.includes("..")) {
    return false;
  }
  return /^[a-f0-9]{16}-[a-f0-9]{8}\.(jpg|png|webp|heic|heif|pdf)$/i.test(name);
}
