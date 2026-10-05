import { resolve } from "path";
import { pathToFileURL } from "url";

/** Minimal CLI flag reader: `--name value` or `--name=value`; `--flag` alone → "true". */
export function getFlag(name: string, argv: string[] = process.argv.slice(2)): string | undefined {
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i] ?? "";
    if (a === `--${name}`) {
      const next = argv[i + 1];
      return next === undefined || next.startsWith("--") ? "true" : next;
    }
    if (a.startsWith(`--${name}=`)) return a.slice(name.length + 3);
  }
  return undefined;
}

export function hasFlag(name: string, argv: string[] = process.argv.slice(2)): boolean {
  return getFlag(name, argv) !== undefined;
}

export function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

/** True when the module at `metaUrl` is the script being run (not imported). */
export function isMain(metaUrl: string): boolean {
  const entry = process.argv[1];
  return entry !== undefined && metaUrl === pathToFileURL(resolve(entry)).href;
}
