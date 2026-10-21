#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { parseArgs } from "node:util";
import { runCreate } from "../src/create.js";
import { runSetup } from "../src/setup.js";
import { stageVoidDist } from "../src/stage.js";

const DEPLOY_HELP = `Uso: celld-void deploy --bucket s3://BUCKET [opciones]

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
ejecuta \`celld deploy\`. \`celld-void --bucket ...\` sigue funcionando igual.`;

const SETUP_HELP = `Uso: celld-void setup [opciones]

Corre después de \`void init\`. Agrega una sección idempotente a AGENTS.md,
instala la skill celld-void para el agente detectado y crea placeholders sin
pisar archivos existentes. No agrega .github/ ni CI.

  --dir DIR   Proyecto Void (default: cwd)
  --yes, -y   Regenera la sección/skill si fueron editadas (crea backup)`;

const CREATE_HELP = `Uso: celld-void create <dir> [opciones]

Scaffold Void (\`pnpm create void <dir>\`) y después corre \`celld-void setup\`.
El directorio debe estar vacío. No agrega GitHub Actions ni publica nada.

  --yes, -y              Pasa --yes a setup
  --package-manager PM   pnpm (default) o npm
  --skip-scaffold        Solo corre setup en un directorio ya inicializado

Si \`pnpm create void\` pregunta datos, respondelos en la terminal; para
automatizar un proyecto existente usá \`celld-void setup --yes\`.`;

const MAIN_HELP = `Uso: celld-void <comando> [opciones]

Comandos:
  deploy   Traduce dist/ssr/wrangler.json y despliega en celld (default).
  setup    Agrega celld-void a un proyecto Void ya inicializado.
  create   Scaffold Void + setup en un directorio nuevo.
  help     Muestra esta ayuda.

Sin comando, los flags van a \`deploy\` (compatibilidad con 0.1.0).`;

function runDeploy(argv) {
  const { values } = parseArgs({
    args: argv,
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
    console.log(DEPLOY_HELP);
    return 0;
  }

  if (!values.bucket) {
    console.error("falta --bucket s3://...");
    return 2;
  }

  const project = values.project ?? process.cwd();
  if (!values["skip-build"]) {
    const build = spawnSync("pnpm", ["build"], { cwd: project, stdio: "inherit" });
    if (build.status !== 0) return build.status ?? 1;
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
    return 1;
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
  return deploy.status ?? 1;
}

function reportSetup(result) {
  console.log(`celld-void setup: ${result.cwd}`);
  console.log(`  app: ${result.appId}`);
  console.log(
    `  agentes: ${
      result.agents.length > 0
        ? result.agents.map((agent) => agent.label).join(", ")
        : "ninguno"
    }`,
  );
  if (result.changed.length > 0) {
    console.log("  cambiado:");
    for (const item of result.changed) console.log(`    - ${item}`);
  }
  if (result.skipped.length > 0) {
    console.log("  sin cambios:");
    for (const item of result.skipped) console.log(`    - ${item}`);
  }
  for (const warning of result.warnings) console.warn(`  aviso: ${warning}`);
}

function runSetupCommand(argv) {
  const { values } = parseArgs({
    args: argv,
    options: {
      dir: { type: "string" },
      yes: { type: "boolean", short: "y", default: false },
      help: { type: "boolean", short: "h", default: false },
    },
    allowPositionals: false,
  });

  if (values.help) {
    console.log(SETUP_HELP);
    return 0;
  }

  const result = runSetup({ cwd: values.dir ?? process.cwd(), yes: values.yes });
  reportSetup(result);
  return 0;
}

function runCreateCommand(argv) {
  const { values, positionals } = parseArgs({
    args: argv,
    options: {
      yes: { type: "boolean", short: "y", default: false },
      "package-manager": { type: "string", default: "pnpm" },
      "skip-scaffold": { type: "boolean", default: false },
      help: { type: "boolean", short: "h", default: false },
    },
    allowPositionals: true,
  });

  if (values.help) {
    console.log(CREATE_HELP);
    return 0;
  }
  if (positionals.length !== 1) {
    console.error("create necesita exactamente un directorio: celld-void create <dir>");
    return 2;
  }

  const result = runCreate(positionals[0], {
    yes: values.yes,
    packageManager: values["package-manager"],
    skipScaffold: values["skip-scaffold"],
  });
  console.log(`celld-void create: ${result.dir}`);
  if (result.scaffold) console.log(`  scaffold: ${result.scaffold}`);
  reportSetup(result.setup);
  return 0;
}

function main(argv) {
  const [command, ...rest] = argv;
  try {
    if (command === "setup") return runSetupCommand(rest);
    if (command === "create") return runCreateCommand(rest);
    if (command === "deploy") return runDeploy(rest);
    if (command === "help") {
      console.log(MAIN_HELP);
      return 0;
    }
    if (command === "--help" || command === "-h") {
      console.log(MAIN_HELP);
      return 0;
    }
    if (command === undefined || command.startsWith("-")) return runDeploy(argv);
    console.error(`celld-void: comando desconocido: ${command}`);
    console.log(MAIN_HELP);
    return 2;
  } catch (error) {
    console.error(`celld-void: ${error.message}`);
    return 1;
  }
}

process.exit(main(process.argv.slice(2)));
