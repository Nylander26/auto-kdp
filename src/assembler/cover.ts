/**
 * Full-wrap paperback cover PDF: back (description) + spine (title if >= 79 pages)
 * + front (cover art with a title band). Dimensions follow KDP's cover calculator.
 */
import { readFileSync } from "fs";
import sharp from "sharp";
import { PDFDocument, StandardFonts, degrees, rgb, type RGB } from "pdf-lib";
import { BLEED_IN, SPINE_TEXT_MIN_PAGES, coverLayout, inToPt, inToPx, type PaperType, type TrimSize } from "../lib/kdp-specs.js";
import { getConfig } from "../lib/config.js";
import { cropFrame } from "../postprocess/line-art.js";
import { fitText, htmlToText, sanitize, wrapText } from "./text.js";

export interface CoverInfo {
  title: string;
  subtitle: string;
  author: string;
  description: string;
  artFile: string;
  trim: TrimSize;
  paper: PaperType;
  pages: number;
}

// Text stays this far inside the trim line (KDP minimum is 0.125").
const SAFE_IN = 0.375;
// KDP prints the barcode bottom-right of the back cover: 2" x 1.2" plus clearance.
const BARCODE_CLEAR_IN = 1.6;

export async function renderCover(info: CoverInfo): Promise<Uint8Array> {
  const L = coverLayout(info.trim, info.pages, info.paper);
  const pdf = await PDFDocument.create();
  pdf.setTitle(sanitize(info.title));
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const page = pdf.addPage([inToPt(L.size.width), inToPt(L.size.height)]);

  // Background = dominant color of the art, so back + spine match the front.
  // Art must run to the trim: a frame drawn by the model would sit on the cut line.
  const art = await cropFrame(readFileSync(info.artFile), getConfig().validator.max_frame_coverage);
  const { dominant } = await sharp(art).stats();
  const bg = rgb(dominant.r / 255, dominant.g / 255, dominant.b / 255);
  const lum = 0.2126 * dominant.r + 0.7152 * dominant.g + 0.0722 * dominant.b;
  const ink: RGB = lum > 140 ? rgb(0.08, 0.08, 0.08) : rgb(1, 1, 1);
  page.drawRectangle({ x: 0, y: 0, width: page.getWidth(), height: page.getHeight(), color: bg });

  // Front panel art, cropped to fill trim + outer/top/bottom bleed.
  const frontW = L.trim.width + BLEED_IN;
  const frontH = L.size.height;
  const front = await sharp(art).resize(inToPx(frontW), inToPx(frontH), { fit: "cover" }).png().toBuffer();
  const frontImg = await pdf.embedPng(front);
  page.drawImage(frontImg, { x: inToPt(L.frontX), y: 0, width: inToPt(frontW), height: inToPt(frontH) });

  // Title band across the top of the front panel.
  const bandX = inToPt(L.frontX + SAFE_IN);
  const bandW = inToPt(L.trim.width - 2 * SAFE_IN);
  const title = fitText(info.title, bold, 44, 20, bandW - 24, 3);
  const subtitle = wrapText(info.subtitle, regular, 15, bandW - 24);
  const PAD = 18;
  const bandH = PAD + title.lines.length * title.size * 1.2 + 8 + subtitle.length * 19 + PAD;
  const bandTop = inToPt(BLEED_IN + L.trim.height - SAFE_IN);
  page.drawRectangle({ x: bandX, y: bandTop - bandH, width: bandW, height: bandH, color: rgb(1, 1, 1), opacity: 0.88 });
  let y = bandTop - PAD;
  for (const line of title.lines) {
    y -= title.size;
    const w = bold.widthOfTextAtSize(line, title.size);
    page.drawText(line, { x: bandX + (bandW - w) / 2, y, size: title.size, font: bold, color: rgb(0.08, 0.08, 0.08) });
    y -= title.size * 0.2;
  }
  y -= 8;
  for (const line of subtitle) {
    y -= 15;
    const w = regular.widthOfTextAtSize(line, 15);
    page.drawText(line, { x: bandX + (bandW - w) / 2, y, size: 15, font: regular, color: rgb(0.2, 0.2, 0.2) });
    y -= 4;
  }

  // Author along the bottom of the front.
  const author = sanitize(info.author);
  const aw = bold.widthOfTextAtSize(author, 16);
  const ay = inToPt(BLEED_IN + SAFE_IN);
  page.drawRectangle({ x: bandX + (bandW - aw) / 2 - 10, y: ay - 6, width: aw + 20, height: 26, color: rgb(1, 1, 1), opacity: 0.88 });
  page.drawText(author, { x: bandX + (bandW - aw) / 2, y: ay, size: 16, font: bold, color: rgb(0.08, 0.08, 0.08) });

  // Back: description, kept above the barcode area.
  const backX = inToPt(L.backX + SAFE_IN + 0.15);
  const backW = inToPt(L.trim.width - 2 * SAFE_IN - 0.3);
  const minY = inToPt(BLEED_IN + SAFE_IN + BARCODE_CLEAR_IN);
  let by = inToPt(BLEED_IN + L.trim.height - SAFE_IN - 0.4);
  for (const line of wrapText(htmlToText(info.description), regular, 13, backW)) {
    by -= 18;
    if (by < minY) break;
    page.drawText(line, { x: backX, y: by, size: 12, font: regular, color: ink });
  }

  // Spine: KDP only allows text from 79 pages, and keeps 0.0625" clear each side.
  if (info.pages >= SPINE_TEXT_MIN_PAGES) {
    const size = Math.min(14, inToPt(L.spine - 0.125) * 0.7);
    const text = sanitize(`${info.title}  -  ${info.author}`);
    const tw = Math.min(regular.widthOfTextAtSize(text, size), inToPt(L.trim.height - 1));
    page.drawText(text, {
      // Rotated -90°: glyphs grow toward +x, so shift left by half the cap height.
      x: inToPt(L.spineX + L.spine / 2) - size * 0.35,
      y: (page.getHeight() + tw) / 2,
      size,
      font: regular,
      color: ink,
      rotate: degrees(-90),
    });
  }
  return pdf.save();
}
