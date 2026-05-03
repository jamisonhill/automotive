import Anthropic from "@anthropic-ai/sdk";

/*
 * Anthropic SDK client singleton.
 *
 * Lazy initialization: throw if the API key is missing only when an actual
 * call is made, so the rest of the app can boot without the key set
 * (e.g., during build, or for users who haven't enabled OCR yet).
 */
let cached: Anthropic | null = null;

export function getAnthropic(): Anthropic {
  if (cached) return cached;

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error(
      "ANTHROPIC_API_KEY is not set. Add it to .env.local for local dev or to the Portainer stack env in production."
    );
  }
  cached = new Anthropic({ apiKey });
  return cached;
}

/**
 * Model used for pump OCR. Haiku 4.5 has vision and is the cheapest model
 * with the accuracy we need for the (often gnarly) fuel pump LCDs.
 */
export const VISION_MODEL = "claude-haiku-4-5-20251001";
