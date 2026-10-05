import { describe, it, expect } from "vitest";
import { coverLayout, interiorPageSize, minGutterIn, padPageCount, spineWidthIn, inToPx } from "../src/lib/kdp-specs.js";

describe("kdp-specs", () => {
  it("interior size adds bleed only when enabled", () => {
    expect(interiorPageSize("8.5x11", false)).toEqual({ width: 8.5, height: 11 });
    expect(interiorPageSize("8.5x11", true)).toEqual({ width: 8.625, height: 11.25 });
  });

  it("pads to an even count of at least 24", () => {
    expect(padPageCount(5)).toBe(24);
    expect(padPageCount(63)).toBe(64);
    expect(padPageCount(64)).toBe(64);
  });

  it("gutter grows with page count", () => {
    expect(minGutterIn(64)).toBe(0.375);
    expect(minGutterIn(200)).toBe(0.5);
    expect(minGutterIn(828)).toBe(0.875);
  });

  it("cover matches KDP's calculator for 8.5x11, 64 white pages", () => {
    const spine = spineWidthIn(64, "white");
    expect(spine).toBeCloseTo(0.144128, 6);
    const c = coverLayout("8.5x11", 64, "white");
    expect(c.size.width).toBeCloseTo(0.125 * 2 + 8.5 * 2 + spine, 6);
    expect(c.size.height).toBeCloseTo(11.25, 6);
    expect(c.frontX).toBeCloseTo(0.125 + 8.5 + spine, 6);
  });

  it("300 DPI pixel conversion", () => {
    expect(inToPx(8.5)).toBe(2550);
    expect(inToPx(11)).toBe(3300);
  });
});
