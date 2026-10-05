# auto-kdp

Pipeline que convierte un nicho en un libro de colorear listo para subir a Amazon KDP:

1. **plan** — Gemini define título, subtítulo, descripción, 7 keywords, categorías, una guía de estilo única y un tema por página.
2. **generate** — Nano Banana dibuja cada página como line art (3:4); `sharp` la pasa a blanco y negro puro a 300 DPI en el tamaño del libro. También genera la portada a color.
3. **validate** — chequeo de tinta sin API (página vacía / demasiado negro) + Gemini Vision (líneas, coloreable, tema, público). Las rechazadas se regeneran solas con las sugerencias del validador (tope configurable).
4. **review** — solo las dudosas pasan por revisión manual.
5. **assemble** — `interior.pdf` (portadilla, copyright, una ilustración por hoja con reverso en blanco), `cover.pdf` (contraportada + lomo + portada con el ancho exacto de KDP) y `listing.json` (metadatos, precio sugerido, regalía estimada, checklist).

La subida a KDP es manual (no hay API pública de publicación).

## Uso

```bash
pnpm install
cp .env.example .env        # GEMINI_API_KEY
pnpm pipeline --niche "cozy cats" --audience adults --pages 30
# o paso a paso:
pnpm plan --niche "cozy cats"
pnpm generate
pnpm validate
pnpm review
pnpm assemble
```

Salida en `output/books/{id}/kdp/`. Ajustes en `config.yaml` (seudónimo, tamaño, papel, umbrales del validador, precios, presupuesto).

## Antes de publicar

- Revisar cada página del PDF: la IA todavía se equivoca con manos, patas y texto escondido.
- Pasar el Print Previewer de KDP y pedir una copia de prueba del primer libro.
- Declarar el contenido generado por IA en la pestaña Content.
- Verificar el costo de impresión de KDP contra `config.yaml::pricing`.

## Próximos pasos

- Research automático de nichos en Amazon (autocompletado + BSR/reseñas vía Apify).
- Feedback con el informe de regalías de KDP para priorizar series que venden.
