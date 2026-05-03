/*
 * Client-side image resize before upload.
 *
 * Why: iPhone photos are 4–12 MB; sending them straight to Claude burns
 * tokens (image cost scales with pixel count) and uploads slowly. Resizing
 * to ~1280px on the longest edge is plenty for OCR'ing a pump display.
 *
 * Output: a JPEG blob (smaller than PNG, lossy is fine for OCR).
 */

const MAX_DIM = 1280;
const JPEG_QUALITY = 0.85;

/**
 * Resize an image File to a JPEG Blob with max dimension MAX_DIM.
 * If the image is already smaller, it is re-encoded (still useful — JPEG
 * is smaller than HEIC and broadly supported by Claude).
 */
export async function resizeImageForOcr(file: File): Promise<Blob> {
  const dataUrl = await fileToDataUrl(file);
  const img = await loadImage(dataUrl);

  const scale = Math.min(MAX_DIM / img.width, MAX_DIM / img.height, 1);
  const targetW = Math.round(img.width * scale);
  const targetH = Math.round(img.height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = targetW;
  canvas.height = targetH;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D context unavailable.");
  ctx.drawImage(img, 0, 0, targetW, targetH);

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error("Failed to encode resized image."));
          return;
        }
        resolve(blob);
      },
      "image/jpeg",
      JPEG_QUALITY
    );
  });
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Could not decode image."));
    img.src = src;
  });
}
