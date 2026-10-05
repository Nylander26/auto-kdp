/**
 * Full run: plan → (approve plan) → generate → validate → notify → assemble.
 * Stops before assembling when pages wait for manual review.
 *
 * Uso: pnpm pipeline --niche "cozy cats" [--audience kids|adults|bold-easy] [--pages 30] [--force] [--yes]
 */
import { getConfig } from "./lib/config.js";
import { getFlag, hasFlag } from "./lib/args.js";
import { askApproval } from "./lib/approval.js";
import { notifyBookAssembled, notifyError, notifyPagesReady } from "./lib/telegram.js";
import { budgetReport } from "./lib/budget.js";
import { planBook, printPlan } from "./planner/index.js";
import { generateBook } from "./generator/index.js";
import { validateBook } from "./validator/index.js";
import { assembleBook } from "./assembler/index.js";
import { parseAudience } from "./lib/types.js";

async function main() {
  const cfg = getConfig();
  const niche = getFlag("niche");
  if (!niche || niche === "true") {
    console.error('Uso: pnpm pipeline --niche "cozy cats" [--audience kids|adults|bold-easy] [--pages 30] [--yes]');
    process.exit(1);
  }
  const audience = parseAudience(getFlag("audience"));
  const pagesFlag = getFlag("pages");

  console.log("[1/4] Plan");
  const book = await planBook(niche, {
    ...(audience ? { audience } : {}),
    ...(pagesFlag ? { pages: parseInt(pagesFlag, 10) } : {}),
    force: hasFlag("force"),
  });
  printPlan(book);

  // Gate before spending image credits on ~30-50 generations.
  if (!hasFlag("yes")) {
    const choice = await askApproval(`¿Generar "${book.title}" (${book.pages.length} páginas + portada)?`, [
      { label: "Sí, generar", detail: `id ${book.id}` },
    ]);
    if (choice.kind === "cancel") {
      console.log(`\nCancelado. El plan quedó guardado: pnpm generate --book ${book.id}`);
      return;
    }
  }

  console.log("\n[2/4] Generación");
  await generateBook(book.id);

  console.log("\n[3/4] Validación");
  const s = await validateBook(book.id);
  if (cfg.pipeline.notify_telegram) await notifyPagesReady(book.title, s.pendingReview, s.approved);

  if (s.pendingReview > 0) {
    console.log(`\n⏸  ${s.pendingReview} páginas esperan revisión: pnpm review --book ${book.id}, luego pnpm assemble --book ${book.id}`);
    console.log(`   ${budgetReport()}`);
    return;
  }

  console.log("\n[4/4] Ensamblado");
  try {
    const out = await assembleBook(book.id);
    if (cfg.pipeline.notify_telegram) await notifyBookAssembled(book.title, out);
  } catch (err) {
    console.log(`\n⏸  ${err instanceof Error ? err.message : err}`);
  }
  console.log(`   ${budgetReport()}`);
}

main().catch(async (err) => {
  const msg = err instanceof Error ? err.message : String(err);
  console.error("Pipeline failed:", msg);
  await notifyError("pipeline", msg);
  process.exit(1);
});
