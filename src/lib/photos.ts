import { createHash, randomBytes } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { photoDir } from "@/lib/config";

/*
 * Photo upload handling.
 *
 * Strategy:
 *   - Validate MIME type and size before touching disk
 *   - Pick an extension from the MIME type (don't trust the original filename)
 *   - Filename is content-hash + a random suffix for uniqueness
 *     (hash alone could collide if someone uploaded the same image twice)
 *   - Store under DATA_DIR/photos
 *   - Return the bare filename (NOT the full path) — that's what we persist
 *     in the DB. The serving route prepends DATA_DIR at read time.
 *
 * Filename-only storage means the data is portable: backup the data dir,
 * restore anywhere, and the same DB rows still resolve.
 */

const ALLOWED_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
]);

const MAX_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

const TYPE_TO_EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/heic": "heic",
  "image/heif": "heif",
};

export async function savePhotoUpload(file: File): Promise<string> {
  // Validate
  if (!ALLOWED_TYPES.has(file.type)) {
    throw new Error(
      `Unsupported image type: ${file.type}. Use JPEG, PNG, WebP, or HEIC.`
    );
  }
  if (file.size > MAX_SIZE_BYTES) {
    throw new Error(
      `Photo too large (${Math.round(file.size / 1024 / 1024)}MB). Max 10MB.`
    );
  }

  // Read into memory. For 10MB max images on a personal app this is fine —
  // streaming would only matter if we were doing hundreds of concurrent uploads.
  const buffer = Buffer.from(await file.arrayBuffer());
  const hash = createHash("sha256").update(buffer).digest("hex").slice(0, 16);
  const suffix = randomBytes(4).toString("hex");
  const ext = TYPE_TO_EXT[file.type] ?? "bin";
  const filename = `${hash}-${suffix}.${ext}`;

  // Ensure the photo dir exists. mkdir -p semantics with recursive: true.
  const dir = photoDir();
  await mkdir(dir, { recursive: true });

  await writeFile(path.join(dir, filename), buffer);

  return filename;
}

/**
 * Validate a filename pulled from user input or the DB before joining it
 * with the photo dir. Defends against path traversal (e.g. "../../etc/passwd").
 *
 * Even though the names we generate are safe, sanitizing on read means a
 * compromised DB row can't be turned into a file-disclosure vulnerability.
 */
export function isSafePhotoFilename(name: string): boolean {
  // No path separators, no parent-dir markers, must look like our format
  if (name.includes("/") || name.includes("\\") || name.includes("..")) {
    return false;
  }
  // Hex-hash + dash + hex-suffix + dot + ext
  return /^[a-f0-9]{16}-[a-f0-9]{8}\.(jpg|png|webp|heic|heif)$/i.test(name);
}
