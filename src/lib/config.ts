import { readFileSync } from "fs";
import { parse } from "yaml";
import { z } from "zod";

const schema = z.object({
  market: z
    .object({
      country: z.string().length(2).default("US"),
      currency: z.string().length(3).default("USD"),
      language: z.string().length(2).default("en"),
    })
    .default({}),
  book: z
    .object({
      // Pen name printed on the cover / title page and used in the KDP listing.
      author: z.string().default("Your Pen Name"),
      trim: z.enum(["8.5x11", "8x10", "8.25x8.25", "6x9"]).default("8.5x11"),
      paper: z.enum(["white", "cream", "premium-color"]).default("white"),
      // Coloring books almost never need bleed: art stays inside the margins on a white
      // page, which is also what KDP's reviewers expect. Flip only for full-bleed art.
      bleed: z.boolean().default(false),
      audience: z.enum(["kids", "adults", "bold-easy"]).default("adults"),
      pages: z.number().int().min(10).max(100).default(30),
      // One illustration per sheet with a blank back — markers bleed through KDP paper.
      single_sided: z.boolean().default(true),
      // Kids books: add a "This book belongs to" page after the copyright page.
      belongs_to_page: z.boolean().default(true),
      // Inner margin around the artwork (inches). >= KDP's minimum gutter for < 151 pages.
      margin_in: z.number().min(0.375).max(1.5).default(0.5),
    })
    .default({}),
  validator: z
    .object({
      max_regenerations: z.number().int().min(0).max(5).default(2),
      approval_threshold: z.number().min(1).max(10).default(7),
      borderline_threshold: z.number().min(1).max(10).default(5.5),
      vision_model: z.string().default("gemini-2.5-flash"),
      auto_approve_passing: z.boolean().default(true),
      auto_regenerate: z.boolean().default(true),
      // Deterministic pre-check on the binarized page (no API call): fraction of black
      // pixels. Below min = nearly empty page; above max = heavy black fills nobody can color.
      min_ink_coverage: z.number().min(0).max(1).default(0.02),
      max_ink_coverage: z.number().min(0).max(1).default(0.35),
    })
    .default({}),
  gemini: z
    .object({
      model_text: z.string().default("gemini-2.5-flash"),
      model_image: z.string().default("gemini-3.1-flash-image-preview"),
      // Native output resolution. 2K at 3:4 is upscaled ~1.5x to 300 DPI; binarized line
      // art survives that cleanly. 4K gives real detail at more tokens per image.
      image_size: z.enum(["512", "1K", "2K", "4K"]).default("2K"),
    })
    .default({}),
  pricing: z
    .object({
      // KDP paperback royalty on amazon.com: 60% at/above the threshold, 50% below it.
      royalty_rate: z.number().min(0).max(1).default(0.6),
      low_price_royalty_rate: z.number().min(0).max(1).default(0.5),
      royalty_threshold_usd: z.number().min(0).default(9.99),
      // US black-ink printing cost: flat for short books, fixed + per-page above the
      // threshold. Verify against KDP's current printing-cost table before publishing.
      short_book_max_pages: z.number().int().default(108),
      short_book_cost_usd: z.number().min(0).default(2.3),
      fixed_cost_usd: z.number().min(0).default(1.0),
      per_page_cost_usd: z.number().min(0).default(0.012),
      target_royalty_usd: z.number().min(0).default(2.5),
      min_price_usd: z.number().min(0).default(7.99),
    })
    .default({}),
  pipeline: z
    .object({
      notify_telegram: z.boolean().default(true),
    })
    .default({}),
  // Per-run spend guard (see lib/budget.ts). cap=0 → track only.
  budget: z
    .object({
      enabled: z.boolean().default(true),
      max_usd_per_run: z.number().min(0).default(5),
      cost_per_image_usd: z.number().min(0).default(0.04),
      cost_per_text_usd: z.number().min(0).default(0.002),
      cost_per_vision_usd: z.number().min(0).default(0.01),
      cost_per_apify_call_usd: z.number().min(0).default(0.05),
    })
    .default({}),
});

export type Config = z.infer<typeof schema>;

function loadConfig(): Config {
  try {
    const raw = readFileSync("config.yaml", "utf-8");
    return schema.parse(parse(raw) ?? {});
  } catch (err) {
    throw new Error(`Failed to load config.yaml: ${err instanceof Error ? err.message : err}`);
  }
}

// Singleton — loaded once per process
let _config: Config | null = null;

export function getConfig(): Config {
  if (!_config) _config = loadConfig();
  return _config;
}
