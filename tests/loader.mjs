/**
 * Lets `node --test` run this repo's TypeScript modules directly.
 *
 * Two things stand in the way of plain Node: the `@/` path alias, which only
 * Next and tsc understand, and `server-only`, whose default export throws by
 * design outside a server build. Both are handled here so tests can import the
 * real modules rather than a copy that drifts from them.
 *
 * Node strips the types; it does not check them. `npm run typecheck` is what
 * checks types, and these tests are about behaviour.
 */
import { existsSync } from "node:fs";
import { pathToFileURL } from "node:url";
import path from "node:path";

const ROOT = process.cwd();

export async function resolve(specifier, context, next) {
  if (specifier === "server-only") {
    return { url: "data:text/javascript,export{}", shortCircuit: true };
  }

  if (specifier.startsWith("@/")) {
    const base = path.join(ROOT, specifier.slice(2));
    for (const candidate of [
      base,
      `${base}.ts`,
      `${base}.tsx`,
      path.join(base, "index.ts"),
    ]) {
      if (existsSync(candidate)) {
        return { url: pathToFileURL(candidate).href, shortCircuit: true };
      }
    }
  }

  return next(specifier, context);
}
