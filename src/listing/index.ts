/**
 * listing.json — everything to paste into KDP's "Paperback Details / Content / Pricing"
 * tabs, plus the manual-upload checklist (KDP has no publishing API).
 */
import type { Config } from "../lib/config.js";
import type { BookMeta } from "../lib/types.js";
import { suggestPrice } from "./pricing.js";

export function buildListing(book: BookMeta, pageCount: number, illustrations: number, pricing: Config["pricing"]) {
  const price = suggestPrice(pageCount, book.trim, pricing);
  return {
    details: {
      language: "English",
      title: book.title,
      subtitle: book.subtitle,
      author: book.author,
      description: book.description,
      keywords: book.keywords,
      categories: book.categories,
      lowContent: false,
      adultContent: false,
      readingAge: book.audience === "kids" ? "4-8" : undefined,
    },
    content: {
      printOptions: {
        ink: book.paper === "premium-color" ? "Premium color" : "Black & white",
        paper: book.paper === "cream" ? "Cream" : "White",
        trimSize: `${book.trim.replace("x", " x ")} in`,
        bleed: book.bleed ? "Bleed" : "No Bleed",
        coverFinish: "Matte",
      },
      pageCount,
      illustrations,
      files: { interior: "interior.pdf", cover: "cover.pdf" },
      // KDP asks this on the Content tab. All imagery here is AI-generated.
      aiGeneratedContent: { text: "AI-generated, edited by author", images: "AI-generated", translations: "None" },
    },
    pricing: {
      marketplace: "Amazon.com",
      listPriceUsd: price.price,
      printingCostUsd: Math.round(price.printing * 100) / 100,
      estimatedRoyaltyUsd: price.royalty,
    },
    checklist: [
      "Abrir interior.pdf y cover.pdf y revisar cada página (texto raro, cortes, anatomía).",
      "Subir y pasar el Print Previewer de KDP sin errores (márgenes, sangrado, lomo).",
      "Declarar el contenido generado por IA en la pestaña Content.",
      "Pedir una copia de prueba (proof) antes de publicar el primer libro de una serie.",
      "Verificar que el costo de impresión que muestra KDP coincide con printingCostUsd.",
    ],
  };
}
