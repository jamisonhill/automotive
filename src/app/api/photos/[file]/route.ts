import { stat } from "node:fs/promises";
import { createReadStream } from "node:fs";
import path from "node:path";

import { NextResponse } from "next/server";

import { photoDir } from "@/lib/config";
import { isSafePhotoFilename } from "@/lib/photos";

/*
 * Serve a vehicle/receipt photo from the data volume.
 *
 * Why a route handler vs. just dropping files in /public?
 *   - /public is part of the build artifact; we'd lose photos on every deploy
 *   - We want the data on the NAS volume, separate from the image
 *   - Route handler lets us add auth, caching, and path-traversal checks
 *
 * The Cloudflare Access proxy (src/proxy.ts) already gates the request,
 * so by the time we get here the user is authenticated.
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
