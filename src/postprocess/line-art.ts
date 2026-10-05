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
