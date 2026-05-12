import { stat } from "node:fs/promises";
import { createReadStream } from "node:fs";
import path from "node:path";

import { NextResponse } from "next/server";

import { photoDir } from "@/lib/config";
import { prisma } from "@/lib/db";
import { isSafePhotoFilename } from "@/lib/photos";
import { requireUserId } from "@/lib/session";

/*
 * Serve a vehicle photo from the data volume.
 *
 * Auth: the proxy middleware has already required a valid session. We also
 * verify that the requested photo is referenced by a Vehicle row owned by
 * the current user — so logged-in user A can't fetch logged-in user B's
 * photos even if they somehow learn B's hash. 404 on miss to avoid leaking
 * existence across the tenant boundary.
 */

const MIME_BY_EXT: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  heic: "image/heic",
  heif: "image/heif",
};

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ file: string }> }
) {
  const { file } = await params;

  // Defense in depth — only allow filenames that match the format we generate.
  if (!isSafePhotoFilename(file)) {
    return new NextResponse("Bad request", { status: 400 });
  }

  // Ownership gate. The current user must own a Vehicle that references
  // this file. Otherwise return 404 so we never leak that the file exists.
  const userId = await requireUserId();
  const owner = await prisma.vehicle.findFirst({
    where: { photoPath: file, userId },
    select: { id: true },
  });
  if (!owner) {
    return new NextResponse("Not found", { status: 404 });
  }

  const fullPath = path.join(photoDir(), file);

  try {
    const stats = await stat(fullPath);
    if (!stats.isFile()) {
      return new NextResponse("Not found", { status: 404 });
    }

    const ext = file.split(".").pop()?.toLowerCase() ?? "";
    const mime = MIME_BY_EXT[ext] ?? "application/octet-stream";

    // Stream the file rather than loading into memory — keeps memory bounded
    // even if photos grow larger than expected.
    const stream = createReadStream(fullPath);

    return new NextResponse(stream as unknown as ReadableStream, {
      headers: {
        "Content-Type": mime,
        "Content-Length": String(stats.size),
        // Hash-based filename means the URL changes when the photo changes,
        // so we can cache aggressively.
        "Cache-Control": "private, max-age=31536000, immutable",
      },
    });
  } catch (err) {
    // ENOENT (file missing) is the common failure here; treat as 404.
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      return new NextResponse("Not found", { status: 404 });
    }
    throw err;
  }
}
