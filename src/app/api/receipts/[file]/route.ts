import { stat } from "node:fs/promises";
import { createReadStream } from "node:fs";
import path from "node:path";

import { NextResponse } from "next/server";

import { receiptDir } from "@/lib/config";
import { prisma } from "@/lib/db";
import { isSafeReceiptFilename } from "@/lib/receipts";
import { requireUserId } from "@/lib/session";

/*
 * Serve a service-entry receipt from the data volume.
 *
 * Mirrors src/app/api/photos/[file]/route.ts. Auth: session is enforced by
 * middleware, plus we verify the receipt's parent ServiceEntry hangs off a
 * Vehicle owned by the current user. 404 on miss avoids leaking existence.
 */

const MIME_BY_EXT: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  heic: "image/heic",
  heif: "image/heif",
  pdf: "application/pdf",
};

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ file: string }> }
) {
  const { file } = await params;

  if (!isSafeReceiptFilename(file)) {
    return new NextResponse("Bad request", { status: 400 });
  }

  // Ownership gate. Walk the relation: ServiceEntry → Vehicle → userId.
  const userId = await requireUserId();
  const owner = await prisma.serviceEntry.findFirst({
    where: { receiptPath: file, vehicle: { userId } },
    select: { id: true },
  });
  if (!owner) {
    return new NextResponse("Not found", { status: 404 });
  }

  const fullPath = path.join(receiptDir(), file);

  try {
    const stats = await stat(fullPath);
    if (!stats.isFile()) {
      return new NextResponse("Not found", { status: 404 });
    }

    const ext = file.split(".").pop()?.toLowerCase() ?? "";
    const mime = MIME_BY_EXT[ext] ?? "application/octet-stream";

    const stream = createReadStream(fullPath);

    return new NextResponse(stream as unknown as ReadableStream, {
      headers: {
        "Content-Type": mime,
        "Content-Length": String(stats.size),
        // Hash-based filename means the URL changes when content changes,
        // so we can cache aggressively.
        "Cache-Control": "private, max-age=31536000, immutable",
      },
    });
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      return new NextResponse("Not found", { status: 404 });
    }
    throw err;
  }
}
