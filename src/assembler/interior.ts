/**
 * Interior PDF: front matter, one illustration per recto with a blank verso
 * (single-sided), padded to KDP's even page count >= 24.
 */
import { readFileSync } from "fs";
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { inToPt, padPageCount, type Size } from "../lib/kdp-specs.js";
import { fitText, sanitize, wrapText } from "./text.js";

export type Slot =
  | { kind: "title" }
  | { kind: "copyright" }
  | { kind: "belongs-to" }
  | { kind: "art"; file: string }
  | { kind: "blank" };

export function buildInteriorSequence(artFiles: string[], opts: { belongsTo: boolean; singleSided: boolean }): Slot[] {
  const slots: Slot[] = [{ kind: "title" }, { kind: "copyright" }];
  if (opts.belongsTo) slots.push({ kind: "belongs-to" }, { kind: "blank" });
  // Slots so far are an even count, so the first illustration lands on a recto.
  for (const file of artFiles) {
    slots.push({ kind: "art", file });
    if (opts.singleSided) slots.push({ kind: "blank" });
  }
  while (slots.length < padPageCount(slots.length)) slots.push({ kind: "blank" });
  return slots;
}

export interface InteriorInfo {
  title: string;
  subtitle: string;
  author: string;
  year: number;
}

function centered(page: PDFPage, text: string, font: PDFFont, size: number, y: number): void {
  const w = font.widthOfTextAtSize(text, size);
  page.drawText(text, { x: (page.getWidth() - w) / 2, y, size, font, color: rgb(0, 0, 0) });
}

export async function renderInterior(slots: Slot[], pageIn: Size, info: InteriorInfo): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(sanitize(info.title));
  pdf.setAuthor(sanitize(info.author));
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const W = inToPt(pageIn.width);
  const H = inToPt(pageIn.height);
  const textWidth = W - inToPt(1.5);

  for (const slot of slots) {
    const page = pdf.addPage([W, H]);
    switch (slot.kind) {
      case "title": {
        const t = fitText(info.title, bold, 36, 18, textWidth, 4);
        let y = H * 0.62;
        for (const line of t.lines) {
          centered(page, line, bold, t.size, y);
          y -= t.size * 1.25;
        }
        y -= 12;
        for (const line of wrapText(info.subtitle, regular, 16, textWidth)) {
          centered(page, line, regular, 16, y);
          y -= 20;
        }
        centered(page, sanitize(info.author), regular, 14, inToPt(1.25));
        break;
      }
      case "copyright": {
        const text =
          `Copyright © ${info.year} ${info.author}. All rights reserved.\n\n` +
          "No part of this book may be reproduced, stored or transmitted in any form or by any means " +
          "without written permission from the author, except for personal coloring use.\n\n" +
          "Tip: place a sheet of paper behind the page you are coloring to protect the next design.";
        let y = inToPt(3);
        for (const line of wrapText(text, regular, 10, textWidth)) {
          page.drawText(line, { x: inToPt(0.75), y, size: 10, font: regular });
          y -= 13;
        }
        break;
      }
      case "belongs-to": {
        centered(page, "This Book Belongs To", bold, 30, H * 0.6);
        page.drawLine({
          start: { x: inToPt(1.5), y: H * 0.5 },
          end: { x: W - inToPt(1.5), y: H * 0.5 },
          thickness: 1.5,
          color: rgb(0, 0, 0),
        });
        break;
      }
      case "art": {
        // print.png is already the full page (margins included) at 300 DPI.
        const img = await pdf.embedPng(readFileSync(slot.file));
        page.drawImage(img, { x: 0, y: 0, width: W, height: H });
        break;
      }
      case "blank":
        break;
    }
  }
  return pdf.save();
}
