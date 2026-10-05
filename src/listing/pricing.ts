import type { Config } from "../lib/config.js";

type Pricing = Config["pricing"];

/** US black-ink paperback printing cost for `pages`. */
export function printingCost(pages: number, p: Pricing): number {
  return pages <= p.short_book_max_pages ? p.short_book_cost_usd : p.fixed_cost_usd + p.per_page_cost_usd * pages;
}

export function royalty(price: number, pages: number, p: Pricing): number {
  const rate = price >= p.royalty_threshold_usd ? p.royalty_rate : p.low_price_royalty_rate;
  return Math.round((rate * price - printingCost(pages, p)) * 100) / 100;
}

/** Cheapest X.99 price at or above the floor that earns the target royalty. */
export function suggestPrice(pages: number, p: Pricing): { price: number; royalty: number; printing: number } {
  let price = Math.max(0, Math.ceil(p.min_price_usd - 0.99)) + 0.99;
  while (royalty(price, pages, p) < p.target_royalty_usd && price < 99) price += 1;
  price = Math.round(price * 100) / 100;
  return { price, royalty: royalty(price, pages, p), printing: printingCost(pages, p) };
}
