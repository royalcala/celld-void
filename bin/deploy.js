#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { parseArgs } from "node:util";
import { stageVoidDist } from "../src/stage.js";

const { values } = parseArgs({
  options: {
    project: { type: "string" },
    out: { type: "string" },
    name: { type: "string" },
    bucket: { type: "string" },
    endpoint: { type: "string" },
    region: { type: "string" },
    celld: { type: "string" },
    var: { type: "string", multiple: true },
    exports: { type: "string" },
    "skip-build": { type: "boolean", default: false },
    help: { type: "boolean", short: "h", default: false },
  },
  allowPositionals: false,
});

if (values.help) {
  console.log(`Uso: celld-void --bucket s3://BUCKET [opciones]

  --project DIR    Proyecto Void (default: cwd)
  --out DIR        Directorio de staging (default: <project>/.celld-void)
  --name NAME      Sobrescribe el nombre del Worker/proyecto
  --bucket URI     Bucket celld (s3://...) [requerido]
  --endpoint URL   Endpoint S3 (R2)
  --region REGION  Región (default: auto)
  --celld PATH     Binario celld (default: celld)
  --var K=V        Variable/secret extra en \`vars\` (repetible)
  --exports FILE   Worker exports custom (default: worker-exports.ts|js)
  --skip-build     No corre \`pnpm build\`

El comando corre \`pnpm build\`, traduce dist/ssr/wrangler.json a celld y
ejecuta \`celld deploy\`.`);
  process.exit(0);
}

if (!values.bucket) {
  console.error("falta --bucket s3://...");
  process.exit(2);
}

const project = values.project ?? process.cwd();
if (!values["skip-build"]) {
  const build = spawnSync("pnpm", ["build"], { cwd: project, stdio: "inherit" });
  if (build.status !== 0) process.exit(build.status ?? 1);
}

let stage;
try {
  const vars = Object.fromEntries(
    (values.var ?? []).map((entry) => {
      const index = entry.indexOf("=");
      if (index <= 0) throw new Error(`--var inválido: ${entry}`);
      return [entry.slice(0, index), entry.slice(index + 1)];
    }),
  );
  stage = stageVoidDist({
    projectDir: project,
    outDir: values.out,
    name: values.name,
    vars,
    exports: values.exports,
  });
} catch (error) {
  console.error(`celld-void: ${error.message}`);
  process.exit(1);
}

let celld = values.celld ?? "celld";
if (existsSync(join(celld, "bin", "celld"))) celld = join(celld, "bin", "celld");
const args = ["deploy", stage, "--bucket", values.bucket];
if (values.endpoint) args.push("--endpoint", values.endpoint);
if (values.region) args.push("--region", values.region);

const deploy = spawnSync(celld, args, { stdio: "inherit" });
if (deploy.error) {
  console.error(`celld-void: no pude ejecutar ${celld}: ${deploy.error.message}`);
}
process.exit(deploy.status ?? 1);
