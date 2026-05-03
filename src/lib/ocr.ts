import { getAnthropic, VISION_MODEL } from "@/lib/anthropic";

/*
 * Pump-screen OCR via Claude vision.
 *
 * Why Claude over Tesseract: pump displays vary wildly (segmented LCDs,
 * faded backlights, sun glare, weird angles, partially obstructed
 * housings). General OCR engines struggle. Claude Haiku reads them
 * reliably for ~$0.01 per call.
 *
 * Returned values:
 *   - gallons: gallons dispensed (the volume number)
 *   - totalCost: total dollar cost of the transaction
 *   - pricePerGallon: $/gallon (often the largest digits on the screen)
 *   - octane: 87/89/91/93/etc when visible
 *   - uncertain: free-text note from Claude flagging anything ambiguous
 */

export interface PumpOcrResult {
  gallons: number | null;
  totalCost: number | null;
  pricePerGallon: number | null;
  octane: number | null;
  uncertain: string | null;
}

const SYSTEM_PROMPT = `You are an OCR specialist for fuel pump LCD/digital displays.
Extract numeric values exactly as shown on the pump screen.

Common pump display layout:
- Total cost (largest, often top-left): the dollars charged for this fill
- Gallons (often middle): the volume dispensed
- Price per gallon (often bottom): the rate
- Sometimes octane (87, 89, 91, 93) is shown next to the grade selected

Return ONLY a JSON object matching this exact shape — no markdown, no commentary:
{
  "gallons": number | null,
  "totalCost": number | null,
  "pricePerGallon": number | null,
  "octane": number | null,
  "uncertain": string | null
}

If you cannot confidently read a value, return null for that field and
explain in "uncertain". If the image is not a fuel pump, return all nulls
and put "Image does not appear to be a fuel pump display" in uncertain.`;

const USER_PROMPT = `Extract the values from this fuel pump display.
Return JSON only.`;

/**
 * Run OCR on a pump-screen image.
 *
 * @param imageBase64  base64-encoded image bytes (no data: prefix)
 * @param mediaType    "image/jpeg" | "image/png" | "image/webp"
 */
export async function pumpOcr(
  imageBase64: string,
  mediaType: "image/jpeg" | "image/png" | "image/webp"
): Promise<PumpOcrResult> {
  const client = getAnthropic();

  const response = await client.messages.create({
    model: VISION_MODEL,
    max_tokens: 512,
    // cache_control on the system prompt means the prompt is cached for 5
    // minutes after first use — reduces cost on back-to-back fills.
    system: [
      {
        type: "text",
        text: SYSTEM_PROMPT,
        cache_control: { type: "ephemeral" },
      },
    ],
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image",
            source: {
              type: "base64",
              media_type: mediaType,
              data: imageBase64,
            },
          },
          { type: "text", text: USER_PROMPT },
        ],
      },
    ],
  });

  // Pull the text content out of the response.
  // Vision responses for our shape always return a single text block.
  const textBlock = response.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("OCR response had no text content");
  }

  // Claude sometimes wraps JSON in ```json ... ``` even when asked not to.
  // Strip code fences before parsing.
  const cleaned = textBlock.text
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "");

  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    throw new Error(`OCR returned non-JSON: ${cleaned.slice(0, 120)}`);
  }

  // Narrow the unknown shape into our typed result. Any field could come
  // back as a number or null; reject if anything else.
  const obj = parsed as Record<string, unknown>;
  return {
    gallons: numOrNull(obj.gallons),
    totalCost: numOrNull(obj.totalCost),
    pricePerGallon: numOrNull(obj.pricePerGallon),
    octane: numOrNull(obj.octane),
    uncertain:
      typeof obj.uncertain === "string" && obj.uncertain.length > 0
        ? obj.uncertain
        : null,
  };
}

function numOrNull(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  return null;
}
