# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Automated pipeline (Node.js + TypeScript, `pnpm`) that turns a niche into a KDP-ready coloring book:
AI plans the book → Nano Banana draws each page as line art → `sharp` binarizes it to 300 DPI → a Gemini Vision
validator scores each page (auto-regenerating rejects up to a cap) → `pdf-lib` assembles `interior.pdf` + full-wrap
`cover.pdf` + `listing.json`. KDP has no publishing API: the final upload is manual at kdp.amazon.com.

Spun off from `Nylander26/agentic-etsy-printify` (Etsy/Printify POD). Shared modules were copied, not linked:
`lib/gemini.ts`, `lib/budget.ts`, `lib/approval.ts`, `lib/telegram.ts`, the validate/regenerate loop and the reviewer.

## Commands

```bash
pnpm plan --niche "cozy cats" [--audience kids|adults] [--pages 30] [--force]   # → output/books/{id}/book.json
pnpm generate [--book <id>] [--limit N] [--regen-cover]   # resumable: only slots with no attempt yet
pnpm validate [--book <id>]                               # AI validator + auto-regenerate loop
pnpm review [--book <id>]                                 # manual A/R/G/S for borderline pages
pnpm assemble [--book <id>] [--allow-short]               # → output/books/{id}/kdp/
pnpm pipeline --niche "..." [--yes]                       # plan → approve → generate → validate → assemble
pnpm typecheck && pnpm test
```
Without `--book`, commands target the most recently planned book.

## Architecture

```
src/planner/     → Gemini JSON plan: title/subtitle/description/7 keywords/categories, ONE styleGuide, page subjects
src/generator/   → prompts.ts (page + cover prompts) · page.ts (generatePage / generateCover) · index.ts (CLI)
src/postprocess/ → line-art.ts: grayscale → trim → fit into margins → threshold → white trim-size page @300 DPI; inkCoverage()
src/validator/   → criteria.ts (rubric, normalizeValidation, inkCheck pre-check) · index.ts (loop, regeneratePage)
src/reviewer/    → CLI review of pending-review pages
src/assembler/   → interior.ts (slot sequence + render) · cover.ts (full wrap) · text.ts (WinAnsi sanitize, wrap)
src/listing/     → pricing.ts (printing cost, royalty, suggested .99 price) · index.ts (listing.json)
src/lib/         → kdp-specs.ts (trim/bleed/spine/gutter math — pure) · book-store.ts · config · gemini · budget · db
```

**Page state machine** (status in `page.json`; pages never move folders):
`pending-validation` → inkCheck (no API) → vision rubric →
  ├─ approved (≥ approval_threshold, auto_approve_passing) → `approved`
  ├─ borderline → `pending-review` → reviewer A/R/G
  └─ rejected → regenerate with SAME image model + hints (`p03` → `p03-r1` → `p03-r2`), capped at `max_regenerations`, else `rejected`

`currentPageBySlot` picks the approved attempt per page index; the assembler uses only approved pages.

**Layout:** `output/books/{bookId}/{book.json, cover/raw.png, pages/{pageId}/{page.json,raw.png,print.png}, kdp/}`.
SQLite (`pipeline.sqlite`) only records which niches already have a book.

## Key Constraints

- Image throttle 8 req/min (`lib/gemini.ts`); vision 5 RPM. Per-run budget cap in `config.yaml::budget`.
- Interior: no bleed by default, art inside `book.margin_in`, single-sided (blank verso), even page count ≥ 24.
- Cover: width = 2×0.125 bleed + 2×trim + spine (pages × 0.002252" white); spine text only ≥ 79 pages; keep the
  back-cover barcode area (bottom right) clear.
- Standard PDF fonts are WinAnsi only — run every string through `sanitize()`.
- KDP requires declaring AI-generated content; `listing.json` carries the answer.
- Printing-cost/royalty numbers in `config.yaml::pricing` must be checked against KDP's current table.
