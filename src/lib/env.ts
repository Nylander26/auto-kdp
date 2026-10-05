import "dotenv/config";
import { z } from "zod";

// Treat empty string env vars as undefined (zod's optional() accepts "" as valid,
// but for credentials we want an explicit "not configured").
const optionalNonEmpty = z
  .string()
  .optional()
  .transform((v) => (v === undefined || v.trim() === "" ? undefined : v));

const schema = z.object({
  GEMINI_API_KEY: z.string().min(1),
  APIFY_TOKEN: optionalNonEmpty, // future: Amazon niche research
  TELEGRAM_BOT_TOKEN: optionalNonEmpty,
  TELEGRAM_CHAT_ID: optionalNonEmpty,
});

export const env = schema.parse(process.env);
