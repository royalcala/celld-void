import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { basename, join, resolve } from "node:path";
import { translateVoidConfig } from "./translate.js";

const findExports = (root, exportsFile) => {
  if (exportsFile) {
    const candidate = resolve(root, exportsFile);
    if (!existsSync(candidate)) {
      throw new Error(`missing worker exports file: ${candidate}`);
    }
    return candidate;
  }
  return ["worker-exports.ts", "worker-exports.js"]
    .map((file) => join(root, file))
    .find((candidate) => existsSync(candidate));
};

export function stageVoidDist({ projectDir, outDir, name, vars, exports: exportsFile }) {
  const root = resolve(projectDir);
  const ssr = join(root, "dist", "ssr");
  const client = join(root, "dist", "client");
  const configPath = join(ssr, "wrangler.json");
  if (!existsSync(configPath)) {
    throw new Error(
      `missing ${configPath}; run \`pnpm build\` before celld-void`,
    );
  }

  const stage = resolve(outDir ?? join(root, ".celld-void"));
  rmSync(stage, { recursive: true, force: true });
  mkdirSync(stage, { recursive: true });
  cpSync(ssr, stage, { recursive: true });
  if (existsSync(client)) {
    cpSync(client, join(stage, "client"), { recursive: true });
  }
  const assetsIgnore = join(stage, "client", ".assetsignore");
  if (existsSync(assetsIgnore)) rmSync(assetsIgnore, { force: true });

  const migrations = [join(root, "migrations"), join(root, "db", "migrations")].find(
    (candidate) => existsSync(candidate),
  );
  if (migrations) {
    cpSync(migrations, join(stage, "migrations"), { recursive: true });
  }

  const exportsPath = findExports(root, exportsFile);
  let main = "index.js";
  if (exportsPath) {
    const custom = basename(exportsPath);
    cpSync(exportsPath, join(stage, custom));
    writeFileSync(
      join(stage, "entry.js"),
      `export { default } from "./index.js";\nexport * from "./index.js";\nexport * from "./${custom}";\n`,
    );
    main = "entry.js";
  }
  for (const entry of readdirSync(root)) {
    if (entry.endsWith(".wasm")) cpSync(join(root, entry), join(stage, entry));
  }
  const wasmDir = join(root, "wasm");
  if (existsSync(wasmDir)) {
    cpSync(wasmDir, join(stage, "wasm"), { recursive: true });
  }
  const containerDir = join(root, "container");
  if (existsSync(containerDir)) {
    cpSync(containerDir, join(stage, "container"), { recursive: true });
  }

  const input = JSON.parse(readFileSync(configPath, "utf8"));
  const output = translateVoidConfig(input, {
    name,
    main,
    // Void emite JS con imports relativos; siempre bundleamos. Celld sube el
    // wasm importado al lado del bundle (CompiledWasm).
    noBundle: false,
    migrationsDir: migrations ? "./migrations" : undefined,
    containerImage: existsSync(join(containerDir, "Dockerfile"))
      ? "./container/Dockerfile"
      : undefined,
    vars,
  });
  writeFileSync(join(stage, "wrangler.json"), `${JSON.stringify(output, null, 2)}\n`);
  return stage;
}
