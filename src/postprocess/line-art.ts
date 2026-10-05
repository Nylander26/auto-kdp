/**
 * Turns a raw model image into a print-ready coloring page:
 * grayscale → fit into the printable area at 300 DPI → hard threshold to pure
 * black/white (kills the model's faint gray noise and anti-alias halos) → place on a
 * white page canvas of the interior trim size.
 */
import sharp from "sharp";
import { inToPx, type Size } from "../lib/kdp-specs.js";

export interface PrintPageOptions {
  page: Size;        // interior page size in inches (incl. bleed when enabled)
  marginIn: number;  // white margin around the artwork
  threshold?: number; // 0-255, pixels darker than this become black
}

export async function toPrintPage(input: Buffer, opts: PrintPageOptions): Promise<Buffer> {
  const pageW = inToPx(opts.page.width);
  const pageH = inToPx(opts.page.height);
  const boxW = pageW - 2 * inToPx(opts.marginIn);
  const boxH = pageH - 2 * inToPx(opts.marginIn);

  const art = await sharp(input)
    .flatten({ background: "#ffffff" })
    .grayscale()
    .trim({ background: "#ffffff", threshold: 30 })
    .resize(boxW, boxH, { fit: "inside", kernel: "lanczos3" })
    .threshold(opts.threshold ?? 160)
    .png()
    .toBuffer({ resolveWithObject: true });

  const left = Math.round((pageW - art.info.width) / 2);
  const top = Math.round((pageH - art.info.height) / 2);

  return sharp({ create: { width: pageW, height: pageH, channels: 3, background: "#ffffff" } })
    .composite([{ input: art.data, left, top }])
    .grayscale()
    .threshold(128)
    .withMetadata({ density: 300 })
    .png({ compressionLevel: 9 })
    .toBuffer();
}

/** Fraction of black pixels in a (binarized) image — the deterministic validator signal. */
export async function inkCoverage(image: Buffer): Promise<number> {
  const { data, info } = await sharp(image).grayscale().raw().toBuffer({ resolveWithObject: true });
  let black = 0;
  for (let i = 0; i < data.length; i += info.channels) if ((data[i] ?? 255) < 128) black++;
  return black / (info.width * info.height);
}

/**
 * How completely the artwork is boxed in by a page frame: for each side of the ink
 * bounding box, the fraction of that side with ink within a thin band along it; returns
 * the weakest side. A drawn border scores ~1.0; open artwork rarely passes 0.3.
 */
export async function frameCoverage(image: Buffer): Promise<number> {
  const { data, info } = await sharp(image).grayscale().raw().toBuffer({ resolveWithObject: true });
  const W = info.width;
  const H = info.height;
  const ink = (x: number, y: number) => (data[(y * W + x) * info.channels] ?? 255) < 128;

  let x0 = W, x1 = -1, y0 = H, y1 = -1;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (!ink(x, y)) continue;
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
    }
  }
  if (x1 < 0) return 0;

  const bw = x1 - x0 + 1;
  const bh = y1 - y0 + 1;
  const band = Math.max(3, Math.round(0.02 * Math.min(bw, bh)));
  const anyInk = (xa: number, ya: number, xb: number, yb: number) => {
    for (let y = ya; y <= yb; y++) for (let x = xa; x <= xb; x++) if (ink(x, y)) return true;
    return false;
  };
  const covered = (n: number, hit: (i: number) => boolean) => {
    let c = 0;
    for (let i = 0; i < n; i++) if (hit(i)) c++;
    return c / n;
  };
  return Math.min(
    covered(bw, (i) => anyInk(x0 + i, y0, x0 + i, y0 + band)),
    covered(bw, (i) => anyInk(x0 + i, y1 - band, x0 + i, y1)),
    covered(bh, (i) => anyInk(x0, y0 + i, x0 + band, y0 + i)),
    covered(bh, (i) => anyInk(x1 - band, y0 + i, x1, y0 + i))
  );
}
