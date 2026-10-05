import type { Config } from "../lib/config.js";
import { TRIM_SIZES, type TrimSize } from "../lib/kdp-specs.js";

type Pricing = Config["pricing"];

/** KDP bills trims wider than 6.12" or taller than 9" at the large-trim rate. */
export function isLargeTrim(trim: TrimSize): boolean {
  const { width, height } = TRIM_SIZES[trim];
  return width > 6.12 || height > 9;
}

/** US black-ink paperback printing cost for `pages` at `trim`. */
export function printingCost(pages: number, trim: TrimSize, p: Pricing): number {
  const large = isLargeTrim(trim);
  if (pages <= p.short_book_max_pages) return large ? p.large_short_book_cost_usd : p.short_book_cost_usd;
  return p.fixed_cost_usd + (large ? p.large_per_page_cost_usd : p.per_page_cost_usd) * pages;
}

export function royalty(price: number, pages: number, trim: TrimSize, p: Pricing): number {
  const rate = price >= p.royalty_threshold_usd ? p.royalty_rate : p.low_price_royalty_rate;
  return Math.round((rate * price - printingCost(pages, trim, p)) * 100) / 100;
}

/** Cheapest X.99 price at or above the floor that earns the target royalty. */
export function suggestPrice(pages: number, trim: TrimSize, p: Pricing): { price: number; royalty: number; printing: number } {
  let price = Math.max(0, Math.ceil(p.min_price_usd - 0.99)) + 0.99;
  while (royalty(price, pages, trim, p) < p.target_royalty_usd && price < 99) price += 1;
  price = Math.round(price * 100) / 100;
  return { price, royalty: royalty(price, pages, trim, p), printing: printingCost(pages, trim, p) };
}
