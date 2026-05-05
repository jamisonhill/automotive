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
  // Station name when visible on the pump or receipt — e.g., "Shell",
  // "Costco", "QuikTrip". Null if not in the frame.
  station: string | null;
  uncertain: string | null;
}

const SYSTEM_PROMPT = `You are an OCR specialist for fuel pump LCD/digital displays.
Extract numeric values exactly as shown on the pump screen.

The two values that matter are:
- Total cost (largest, often top-left): the dollars charged for this fill
- Gallons (often middle): the volume dispensed

Bonus values that may not be visible — read them if present, return null if not:
- Price per gallon: the rate (we can compute it from total/gallons if missing)
- Octane (87, 89, 91, 93): the grade selected (we default to 87 if missing)
- Station: the station/brand name shown anywhere in the photo — on the
  pump housing, awning, signage, screen header, receipt header, or
  branded fixtures. Read whatever brand text is actually present and
  return it verbatim (case-corrected to title case is fine), regardless
  of whether you recognize the chain. Major US examples include Shell,
  Chevron, BP, Exxon, Mobil, Sunoco, Marathon, Costco, Sam's Club,
  QuikTrip, Sheetz, Wawa, Casey's, RaceTrac, Maverik, Speedway, Circle K,
  7-Eleven, Kwik Trip, Buc-ee's, Pilot, Flying J, Love's, TA — but do
  NOT restrict yourself to this list. Any visible brand name counts.
  If you only see a logo without text, infer the brand only if it's
  unmistakable; otherwise null.

Return ONLY a JSON object matching this exact shape — no markdown, no commentary:
{
  "gallons": number | null,
  "totalCost": number | null,
  "pricePerGallon": number | null,
  "octane": number | null,
  "station": string | null,
  "uncertain": string | null
}

Only populate "uncertain" when something is genuinely ambiguous — for
example, if gallons or totalCost is unreadable, smudged, or partially
obscured. Do NOT mention price per gallon, octane, or station being
absent; those are optional. If the image is not a fuel pump at all,
return all nulls and put "Image does not appear to be a fuel pump
display" in uncertain.`;

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
    station:
      typeof obj.station === "string" && obj.station.trim().length > 0
        ? obj.station.trim()
        : null,
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
