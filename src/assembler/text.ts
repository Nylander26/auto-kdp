import type { PDFFont } from "pdf-lib";

const REPLACEMENTS: Record<string, string> = {
  "‘": "'", "’": "'", "“": '"', "”": '"', "–": "-", "—": "-",
  "…": "...", "•": "-", " ": " ",
};

/** Standard PDF fonts only encode WinAnsi — map smart punctuation and drop the rest (emoji). */
export function sanitize(text: string): string {
  return text
    .replace(/[‘’“”–—…• ]/g, (c) => REPLACEMENTS[c] ?? "")
    .replace(/[^\x20-\x7E\xA1-\xFF\n]/g, "");
}

/** KDP descriptions carry light HTML; the back cover needs plain paragraphs. */
export function htmlToText(html: string): string {
  return html
    .replace(/<\s*br\s*\/?>/gi, "\n")
    .replace(/<\s*li[^>]*>/gi, "\n- ")
    .replace(/<\/\s*(p|ul|ol)\s*>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&nbsp;/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Greedy word wrap by measured width. Explicit newlines are kept as paragraph breaks. */
export function wrapText(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const lines: string[] = [];
  for (const para of sanitize(text).split("\n")) {
    const words = para.split(/\s+/).filter(Boolean);
    if (words.length === 0) {
      lines.push("");
      continue;
    }
    let line = "";
    for (const w of words) {
      const candidate = line ? `${line} ${w}` : w;
      if (font.widthOfTextAtSize(candidate, size) <= maxWidth || !line) line = candidate;
      else {
        lines.push(line);
        line = w;
      }
    }
    lines.push(line);
  }
  return lines;
}

/** Largest font size (stepping down) at which `text` wraps into at most `maxLines`. */
export function fitText(text: string, font: PDFFont, maxSize: number, minSize: number, maxWidth: number, maxLines: number): { size: number; lines: string[] } {
  for (let size = maxSize; size > minSize; size -= 2) {
    const lines = wrapText(text, font, size, maxWidth);
    if (lines.length <= maxLines) return { size, lines };
  }
  return { size: minSize, lines: wrapText(text, font, minSize, maxWidth) };
}
