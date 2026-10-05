import { describe, it, expect } from "vitest";
import { printingCost, royalty, suggestPrice } from "../src/listing/pricing.js";
import { getConfig } from "../src/lib/config.js";

const p = getConfig().pricing;

describe("pricing", () => {
  it("flat cost for short books, per-page above the threshold", () => {
    expect(printingCost(64, p)).toBe(p.short_book_cost_usd);
    expect(printingCost(200, p)).toBeCloseTo(p.fixed_cost_usd + 200 * p.per_page_cost_usd, 6);
  });

  it("applies the lower royalty rate below the threshold", () => {
    const below = royalty(8.99, 64, p);
    expect(below).toBeCloseTo(p.low_price_royalty_rate * 8.99 - p.short_book_cost_usd, 2);
    const above = royalty(9.99, 64, p);
    expect(above).toBeCloseTo(p.royalty_rate * 9.99 - p.short_book_cost_usd, 2);
  });

  it("suggests the cheapest .99 price that clears the target royalty", () => {
    const s = suggestPrice(64, p);
    expect(s.price % 1).toBeCloseTo(0.99, 6);
    expect(s.price).toBeGreaterThanOrEqual(p.min_price_usd);
    expect(s.royalty).toBeGreaterThanOrEqual(p.target_royalty_usd);
    expect(royalty(s.price - 1, 64, p) < p.target_royalty_usd || s.price - 1 < p.min_price_usd).toBe(true);
  });
});
