import "server-only";
import { serverEnv } from "@/lib/env";

/**
 * Alt text for property photos.
 *
 * Two providers behind one interface:
 *
 *   none       a descriptive sentence built from the property data we already
 *              hold. Deterministic, free, and always better than IMG_1034.jpg.
 *   anthropic  a vision model describing the actual photo.
 *
 * The deterministic path is the default so that alt text is never missing,
 * and the AI path is a drop-in improvement when a key is configured.
 */

export type AltTextContext = {
  propertyType: "FULL" | "SHARED";
  category: string | null;
  area: string | null;
  town: string | null;
  outcode: string;
  furnished: boolean | null;
  bedrooms: number | null;
  roomName?: string | null;
  /** Position in the gallery, used to vary the generated sentence. */
  index?: number;
};

const CATEGORY_WORDS: Record<string, string> = {
  HOUSE: "house",
  FLAT: "flat",
  STUDIO_FLAT: "studio flat",
};

/**
 * A useful sentence from the data we already have.
 * "Bright furnished double bedroom in a shared house in Rusholme, Manchester"
 */
export function describeFromContext(context: AltTextContext): string {
  const place = [context.area, context.town].filter(Boolean).join(", ") || context.outcode;
  const furnished = context.furnished === true ? "furnished " : "";

  if (context.propertyType === "SHARED") {
    const room = context.roomName ? `${context.roomName.toLowerCase()}` : "room";
    return `A ${furnished}${room} in a shared house in ${place}`;
  }

  const category = context.category ? (CATEGORY_WORDS[context.category] ?? "property") : "property";
  const bedrooms = context.bedrooms ? `${context.bedrooms} bedroom ` : "";

  // Vary the leading noun so a gallery does not read as the same line repeated.
  const aspects = ["Interior of", "Inside", "A room in", "A view of"];
  const lead = context.index && context.index > 0 ? aspects[context.index % aspects.length] : "A";

  return lead === "A"
    ? `A ${furnished}${bedrooms}${category} in ${place}`
    : `${lead} a ${furnished}${bedrooms}${category} in ${place}`;
}

/**
 * Generate alt text for an uploaded image. Falls back to the deterministic
 * description whenever the vision provider is unavailable or fails - a photo
 * must never end up with no alt text.
 */
export async function generateAltText(
  imageUrl: string,
  context: AltTextContext,
): Promise<string> {
  const fallback = describeFromContext(context);

  let env;
  try {
    env = serverEnv();
  } catch {
    return fallback;
  }

  if (env.ALT_TEXT_PROVIDER !== "anthropic" || !env.ANTHROPIC_API_KEY) {
    return fallback;
  }

  try {
    const described = await describeWithAnthropic(imageUrl, context, env.ANTHROPIC_API_KEY, env.ALT_TEXT_MODEL);
    return described ?? fallback;
  } catch (error) {
    console.error("Alt text generation failed, using the generated description:", error);
    return fallback;
  }
}

async function describeWithAnthropic(
  imageUrl: string,
  context: AltTextContext,
  apiKey: string,
  model: string,
): Promise<string | null> {
  const place = [context.area, context.town].filter(Boolean).join(", ") || context.outcode;

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model,
      max_tokens: 100,
      messages: [
        {
          role: "user",
          content: [
            { type: "image", source: { type: "url", url: imageUrl } },
            {
              type: "text",
              text: [
                "Write alt text for this photo of a rental property listing.",
                `The property is in ${place}.`,
                "One sentence, under 125 characters, describing what is actually visible.",
                "Do not start with 'Image of' or 'Photo of'. Do not add marketing language.",
                "Reply with the sentence only.",
              ].join(" "),
            },
          ],
        },
      ],
    }),
  });

  if (!response.ok) {
    console.error("Anthropic alt text request failed:", response.status);
    return null;
  }

  const payload = (await response.json()) as {
    content?: { type: string; text?: string }[];
  };

  const text = payload.content?.find((block) => block.type === "text")?.text?.trim();
  if (!text) return null;

  // Guard against a chatty response slipping into the alt attribute.
  return text.length > 200 ? `${text.slice(0, 197)}...` : text;
}
