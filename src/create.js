import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { runSetup } from "./setup.js";

export function runCreate(target, options = {}) {
  if (!target) {
    throw new Error("create necesita un directorio: `celld-void create <dir>`");
  }

  const root = resolve(options.cwd ?? process.cwd(), target);
  if (existsSync(root)) {
    if (!statSync(root).isDirectory()) {
      throw new Error(`create: ${root} existe y no es un directorio`);
    }
    if (readdirSync(root).length > 0) {
      throw new Error(`create: ${root} no está vacío; usá \`celld-void setup\` dentro del proyecto`);
    }
  }

  const packageManager = options.packageManager ?? "pnpm";
  if (packageManager !== "pnpm" && packageManager !== "npm") {
    throw new Error(`create: package manager no soportado: ${packageManager}`);
  }

  const result = { dir: root, scaffold: null, setup: null };

  if (!options.skipScaffold) {
    const args = ["create", "void", root];
    const scaffold = spawnSync(packageManager, args, {
      cwd: options.cwd ?? process.cwd(),
      stdio: "inherit",
    });
    if (scaffold.error) {
      throw new Error(
        `create: no pude ejecutar ${packageManager}: ${scaffold.error.message}`,
      );
    }
    if (scaffold.status !== 0) {
      throw new Error(
        `create: ${packageManager} ${args.join(" ")} falló con código ${scaffold.status}`,
      );
    }
    if (!existsSync(root)) {
      throw new Error(`create: el scaffold no creó ${root}`);
    }
    result.scaffold = `${packageManager} ${args.join(" ")}`;
  }

  result.setup = runSetup({ cwd: root, yes: Boolean(options.yes) });
  return result;
}
