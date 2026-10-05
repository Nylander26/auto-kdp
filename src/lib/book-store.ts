/**
 * Filesystem layout + state helpers for books and their pages.
 *
 *   output/books/{bookId}/book.json
 *   output/books/{bookId}/cover/raw.png
 *   output/books/{bookId}/pages/{pageId}/{page.json,raw.png,print.png}
 *   output/books/{bookId}/kdp/{interior.pdf,cover.pdf,listing.json}
 *
 * Unlike the Etsy pipeline, pages never move between lifecycle dirs — they belong to
 * one book, so status lives only in page.json.
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "fs";
import { join } from "path";
import type { BookMeta, PageMeta } from "./types.js";

export const BOOKS_ROOT = join("output", "books");

export const bookDir = (bookId: string): string => join(BOOKS_ROOT, bookId);
export const pageDir = (bookId: string, pageId: string): string => join(bookDir(bookId), "pages", pageId);
export const kdpDir = (bookId: string): string => join(bookDir(bookId), "kdp");

export function pageId(index: number, regeneration = 0): string {
  const base = `p${String(index).padStart(2, "0")}`;
  return regeneration > 0 ? `${base}-r${regeneration}` : base;
}

export function readBook(bookId: string): BookMeta {
  const p = join(bookDir(bookId), "book.json");
  if (!existsSync(p)) throw new Error(`Libro no encontrado: ${p}`);
  return JSON.parse(readFileSync(p, "utf-8")) as BookMeta;
}

export function writeBook(book: BookMeta): void {
  mkdirSync(bookDir(book.id), { recursive: true });
  writeFileSync(join(bookDir(book.id), "book.json"), JSON.stringify(book, null, 2));
}

export function listBooks(): string[] {
  if (!existsSync(BOOKS_ROOT)) return [];
  return readdirSync(BOOKS_ROOT)
    .filter((d) => existsSync(join(BOOKS_ROOT, d, "book.json")))
    .sort();
}

/** Most recently created book — default target when a CLI gets no --book. */
export function latestBookId(): string | undefined {
  const books = listBooks().map((id) => readBook(id));
  books.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  return books.at(-1)?.id;
}

export function listPages(bookId: string, filter: (p: PageMeta) => boolean = () => true): PageMeta[] {
  const root = join(bookDir(bookId), "pages");
  if (!existsSync(root)) return [];
  const pages: PageMeta[] = [];
  for (const dir of readdirSync(root)) {
    const p = join(root, dir, "page.json");
    if (!existsSync(p)) continue;
    try {
      const meta = JSON.parse(readFileSync(p, "utf-8")) as PageMeta;
      if (filter(meta)) pages.push(meta);
    } catch {
      // skip malformed
    }
  }
  return pages.sort((a, b) => a.index - b.index || a.id.localeCompare(b.id));
}

export function writePage(page: PageMeta): void {
  const dir = pageDir(page.bookId, page.id);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "page.json"), JSON.stringify(page, null, 2));
}

/**
 * The page that represents each planned slot: the approved one if any, else the
 * newest attempt. Regenerations supersede their parent, so at most one per index
 * should be approved; if several are, the latest attempt wins.
 */
export function currentPageBySlot(pages: PageMeta[]): Map<number, PageMeta> {
  const bySlot = new Map<number, PageMeta>();
  const rank = (p: PageMeta) => (p.status === "approved" ? 1 : 0);
  for (const p of pages) {
    const cur = bySlot.get(p.index);
    if (
      !cur ||
      rank(p) > rank(cur) ||
      (rank(p) === rank(cur) && (p.regenerationCount ?? 0) >= (cur.regenerationCount ?? 0))
    ) {
      bySlot.set(p.index, p);
    }
  }
  return bySlot;
}

export function approvedPages(bookId: string): PageMeta[] {
  return [...currentPageBySlot(listPages(bookId)).values()]
    .filter((p) => p.status === "approved")
    .sort((a, b) => a.index - b.index);
}
