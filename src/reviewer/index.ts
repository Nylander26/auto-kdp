/**
 * Manual review of borderline / unsure pages (status pending-review).
 *
 * Acciones:
 *   - En lote: [AA] aprobar TODO · [RA] rechazar TODO
 *   - Una a una: [A]probar · [R]echazar · [G] regenerar (mismo modelo + sugerencias) · [S]altar
 *
 * Uso: pnpm review [--book <id>]
 */
import * as readline from "readline";
import { getFlag, isMain } from "../lib/args.js";
import { latestBookId, listPages, readBook, writePage } from "../lib/book-store.js";
import { regeneratePage } from "../validator/index.js";
import type { PageMeta } from "../lib/types.js";

function prompt(rl: readline.Interface, msg: string): Promise<string> {
  return new Promise((resolve) => {
    process.stdout.write(msg);
    rl.once("line", (line) => resolve(line.trim().toLowerCase()));
  });
}

function describe(p: PageMeta, i: number, total: number): void {
  const divider = "─".repeat(60);
  console.log(`\n${divider}\n  Página ${i}/${total} — ${p.id}${p.forceApproved ? " ⚡FORCE" : ""}`);
  console.log(`  Tema:    ${p.subject}`);
  console.log(`  Archivo: ${p.files.print}`);
  if (p.validation) {
    const v = p.validation;
    console.log(`  IA: ${v.verdict} ${v.scores.overall.toFixed(1)}/10  (líneas=${v.scores.lineQuality} colorear=${v.scores.colorability} tema=${v.scores.subjectFidelity} público=${v.scores.audienceFit})`);
    if (v.reasons.concerns.length > 0) console.log(`    ! ${v.reasons.concerns.join("; ")}`);
  }
  console.log(divider);
}

async function main() {
  const bookId = getFlag("book") ?? latestBookId();
  if (!bookId) throw new Error("No hay libros.");
  const book = readBook(bookId);
  const pending = listPages(bookId, (p) => p.status === "pending-review");

  if (book.cover) console.log(`\n🖼  Revisa también la portada: ${book.cover.raw}  (regenerar: pnpm generate --regen-cover)`);
  if (pending.length === 0) {
    console.log(`\n✅ ${book.title}: no hay páginas pendientes de revisión.\n`);
    return;
  }
  console.log(`\n📘 ${book.title} — ${pending.length} páginas para revisar (abre los PNG mientras revisas)`);

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: false });
  const stats = { approved: 0, rejected: 0, regenerated: 0, skipped: 0 };

  const top = await prompt(rl, "\n  [AA] aprobar todo · [RA] rechazar todo · [Enter] una por una: ");
  if (top === "aa" || top === "ra") {
    const status = top === "aa" ? "approved" : "rejected";
    for (const p of pending) writePage({ ...p, status });
    stats[top === "aa" ? "approved" : "rejected"] = pending.length;
  } else {
    for (let i = 0; i < pending.length; i++) {
      const p = pending[i] as PageMeta;
      describe(p, i + 1, pending.length);
      let handled = false;
      while (!handled) {
        const input = await prompt(rl, "  [A/R/G/S]: ");
        handled = true;
        if (input === "a") {
          writePage({ ...p, status: "approved" });
          stats.approved++;
        } else if (input === "r") {
          writePage({ ...p, status: "rejected" });
          stats.rejected++;
        } else if (input === "g" && p.validation) {
          const next = await regeneratePage(book, p, p.validation);
          if (next) {
            console.log(`  🔄 ${next.id} generada — corre pnpm validate`);
            stats.regenerated++;
          } else {
            console.log("  ⚠️  Cap de regeneraciones alcanzado — usa A/R/S.");
            handled = false;
          }
        } else if (input === "s") {
          stats.skipped++;
        } else {
          console.log("  Opción inválida.");
          handled = false;
        }
      }
    }
  }
  rl.close();
  console.log(`\n  ✅ ${stats.approved} · ❌ ${stats.rejected} · 🔄 ${stats.regenerated} · ⏭ ${stats.skipped}`);
  console.log(`  Siguiente paso: ${stats.regenerated > 0 ? "pnpm validate" : "pnpm assemble"} --book ${bookId}\n`);
}

if (isMain(import.meta.url)) {
  main().catch((err) => {
    console.error("Reviewer failed:", err instanceof Error ? err.message : err);
    process.exit(1);
  });
}
