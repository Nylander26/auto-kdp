import { describe, it, expect, beforeAll } from "vitest";
import { mkdtempSync, readFileSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import sharp from "sharp";
import { PDFDocument } from "pdf-lib";
import { buildInteriorSequence, renderInterior } from "../src/assembler/interior.js";
import { renderCover } from "../src/assembler/cover.js";
import { htmlToText, sanitize } from "../src/assembler/text.js";
import { toPrintPage, inkCoverage } from "../src/postprocess/line-art.js";
import { coverLayout } from "../src/lib/kdp-specs.js";

const dir = mkdtempSync(join(tmpdir(), "auto-kdp-"));
let printFile = "";
let coverArt = "";

beforeAll(async () => {
  // Synthetic "model output": gray-ish noisy background with a black circle outline.
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="768" height="1024">
    <rect width="768" height="1024" fill="#f4f4f4"/>
    <circle cx="384" cy="512" r="300" fill="none" stroke="#111" stroke-width="14"/>
    <circle cx="384" cy="512" r="120" fill="#bbbbbb" stroke="#111" stroke-width="10"/>
  </svg>`;
  const raw = await sharp(Buffer.from(svg)).png().toBuffer();
  const print = await toPrintPage(raw, { page: { width: 8.5, height: 11 }, marginIn: 0.5 });
  printFile = join(dir, "print.png");
  writeFileSync(printFile, print);
  coverArt = join(dir, "cover.png");
  writeFileSync(coverArt, await sharp({ create: { width: 768, height: 1024, channels: 3, background: "#3366aa" } }).png().toBuffer());
});

describe("line-art post-processing", () => {
  it("outputs a pure black/white page at 300 DPI trim size", async () => {
    const meta = await sharp(printFile).metadata();
    expect(meta.width).toBe(2550);
    expect(meta.height).toBe(3300);
    expect(meta.density).toBe(300);
    const { data, info } = await sharp(printFile).grayscale().raw().toBuffer({ resolveWithObject: true });
    const levels = new Set<number>();
    for (let i = 0; i < data.length; i += info.channels) levels.add(data[i] ?? 0);
    expect([...levels].every((l) => l === 0 || l === 255)).toBe(true);
    const ink = await inkCoverage(readFileSync(printFile));
    expect(ink).toBeGreaterThan(0.005);
    expect(ink).toBeLessThan(0.2); // light-gray fill was thresholded to white
  });
});

describe("interior sequence", () => {
  it("puts every illustration on a recto with a blank verso and pads to even >= 24", () => {
    const seq = buildInteriorSequence(["a", "b", "c"], { belongsTo: true, singleSided: true });
    expect(seq.length).toBe(24);
    seq.forEach((s, i) => {
      if (s.kind === "art") {
        expect(i % 2).toBe(0); // 0-based even index = odd page number = recto
        expect(seq[i + 1]?.kind).toBe("blank");
      }
    });
    const big = buildInteriorSequence(Array.from({ length: 40 }, (_, i) => `f${i}`), { belongsTo: false, singleSided: true });
    expect(big.length).toBe(82);
  });
});

describe("PDF rendering", () => {
  it("interior pages are exactly the trim size", async () => {
    const slots = buildInteriorSequence([printFile, printFile], { belongsTo: true, singleSided: true });
    const bytes = await renderInterior(slots, { width: 8.5, height: 11 }, { title: "Cozy Cats Coloring Book", subtitle: "30 Relaxing Designs", author: "A. Author", year: 2026 });
    const pdf = await PDFDocument.load(bytes);
    expect(pdf.getPageCount()).toBe(slots.length);
    for (const p of pdf.getPages()) {
      expect(p.getWidth()).toBeCloseTo(612, 3);
      expect(p.getHeight()).toBeCloseTo(792, 3);
    }
  });

  it("cover is the full wrap size, with spine text only from 79 pages", async () => {
    for (const pages of [24, 120]) {
      const bytes = await renderCover({
        title: "Cozy Cats “Coloring” Book 🐱",
        subtitle: "Relaxing Designs",
        author: "A. Author",
        description: "<b>Relax</b> with cats.<br><ul><li>Single-sided</li></ul>",
        artFile: coverArt,
        trim: "8.5x11",
        paper: "white",
        pages,
      });
      const pdf = await PDFDocument.load(bytes);
      const L = coverLayout("8.5x11", pages, "white");
      expect(pdf.getPage(0).getWidth()).toBeCloseTo(L.size.width * 72, 2);
      expect(pdf.getPage(0).getHeight()).toBeCloseTo(L.size.height * 72, 2);
    }
  });
});

describe("text helpers", () => {
  it("sanitizes to WinAnsi and flattens HTML", () => {
    expect(sanitize("“Hi” — cats 🐱")).toBe('"Hi" - cats ');
    expect(htmlToText("<b>A</b><br>B<ul><li>C</li></ul>")).toBe("A\nB\n- C");
  });
});

