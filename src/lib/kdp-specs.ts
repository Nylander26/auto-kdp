/**
 * Amazon KDP paperback print specs — pure functions, no I/O.
 *
 * Source: KDP "Paperback submission guidelines" (trim, bleed, margins, spine) and
 * the cover calculator. All lengths are inches unless the name says px / pt.
 */
export type TrimSize = "8.5x11" | "8x10" | "8.25x8.25" | "6x9";
export type PaperType = "white" | "cream" | "premium-color";

export interface Size {
  width: number;
  height: number;
}

export const DPI = 300;
export const BLEED_IN = 0.125;
export const MIN_PAGES = 24;
export const MAX_PAGES = 828;
// KDP rejects spine text on books under this page count (spine too narrow).
export const SPINE_TEXT_MIN_PAGES = 79;

export const TRIM_SIZES: Record<TrimSize, Size> = {
  "8.5x11": { width: 8.5, height: 11 },
  "8x10": { width: 8, height: 10 },
  "8.25x8.25": { width: 8.25, height: 8.25 },
  "6x9": { width: 6, height: 9 },
};

// Spine thickness added per page, by paper stock.
export const SPINE_PER_PAGE_IN: Record<PaperType, number> = {
  white: 0.002252,
  cream: 0.0025,
  "premium-color": 0.002347,
};

/** Interior page size. Bleed adds 0.125" on the outside edge and 0.125" top + bottom. */
export function interiorPageSize(trim: TrimSize, bleed: boolean): Size {
  const t = TRIM_SIZES[trim];
  return bleed ? { width: t.width + BLEED_IN, height: t.height + 2 * BLEED_IN } : { ...t };
}

/** Minimum inside (gutter) margin KDP requires for a given page count. */
export function minGutterIn(pages: number): number {
  if (pages <= 150) return 0.375;
  if (pages <= 300) return 0.5;
  if (pages <= 500) return 0.625;
  if (pages <= 700) return 0.75;
  return 0.875;
}

/** KDP needs an even page count of at least MIN_PAGES. */
export function padPageCount(pages: number): number {
  const even = pages % 2 === 0 ? pages : pages + 1;
  return Math.max(MIN_PAGES, even);
}

export function spineWidthIn(pages: number, paper: PaperType): number {
  return pages * SPINE_PER_PAGE_IN[paper];
}

export interface CoverLayout {
  size: Size;     // full wrap incl. bleed on all four sides
  spine: number;  // spine width
  backX: number;  // left edge of the back panel's trim (after bleed)
  spineX: number; // left edge of the spine
  frontX: number; // left edge of the front panel's trim
  trim: Size;
}

/** Full-wrap cover: bleed + back + spine + front + bleed. */
export function coverLayout(trim: TrimSize, pages: number, paper: PaperType): CoverLayout {
  const t = TRIM_SIZES[trim];
  const spine = spineWidthIn(pages, paper);
  return {
    size: { width: 2 * BLEED_IN + 2 * t.width + spine, height: t.height + 2 * BLEED_IN },
    spine,
    backX: BLEED_IN,
    spineX: BLEED_IN + t.width,
    frontX: BLEED_IN + t.width + spine,
    trim: { ...t },
  };
}

export const inToPx = (inches: number, dpi = DPI): number => Math.round(inches * dpi);
export const inToPt = (inches: number): number => inches * 72;
