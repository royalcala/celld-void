import { createHash } from "node:crypto";
import {
  chmodSync,
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { basename, dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { detectAgents } from "./agents.js";
import {
  buildCheckScript,
  buildContainerReadme,
  buildManifest,
  buildWasmReadme,
  buildWasmTypes,
  buildWorkerExports,
} from "./placeholders.js";

const PACKAGE_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SKILL_SOURCE = join(PACKAGE_ROOT, "skills", "celld-void", "SKILL.md");

const START = "<!-- celld-void:start -->";
const END = "<!-- celld-void:end -->";
const GENERATED_RE = /<!-- celld-void:generated sha256=([a-f0-9]{64}) -->/;
const INSTALLED_RE = /<!-- celld-void:installed sha256=([a-f0-9]{64}) -->\s*$/;

const sha256 = (value) => createHash("sha256").update(value).digest("hex");
const readIfExists = (file) => (existsSync(file) ? readFileSync(file, "utf8") : undefined);
const push = (list, value) => {
  if (!list.includes(value)) list.push(value);
};
const display = (root, file) => relative(root, file) || ".";

function writeText(file, content, mode) {
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, content);
  if (mode !== undefined) chmodSync(file, mode);
}

function backup(file) {
  const base = `${file}.celld-void.bak`;
  let target = base;
  for (let index = 1; existsSync(target); index += 1) {
    target = `${base}.${index}`;
  }
  copyFileSync(file, target);
  return target;
}

function resolveAppId(root) {
  const raw = readIfExists(join(root, "package.json"));
  if (raw !== undefined) {
    try {
      const name = JSON.parse(raw).name;
      if (typeof name === "string" && name.trim().length > 0) return name.trim();
    } catch {
      // Fall through to the directory name.
    }
  }
  return basename(root);
}

function buildAgentsSection(skillPaths) {
  return `## celld-void

Esta app se despliega en **celld** con el adapter \`celld-void\`. \`void init\` es
dueño del resto de este archivo; esta sección la genera \`celld-void setup\`.

Antes de cambiar bindings, storage o config de deploy, leé:

- Skill: ${skillPaths.map((path) => `\`${path}\``).join(", ")}
- Docs: \`node_modules/celld-void/docs/MAPPING.md\`,
  \`node_modules/celld-void/docs/LAB.md\`

Reglas duras:

- Una flota = una app. El tenant se resuelve por sesión/\`tenant_id\`, nunca por
  \`Host\`.
- No hay código de tenant en la flota compartida.
- R2 scoped por flota; los datos de la app van bajo \`app/\`.
- Wasm y containers solo para código propio/confiable.
- Deploy: \`pnpm build && pnpm exec celld-void deploy ...\`. Antes corré
  \`scripts/check-local.sh\`.`;
}

function buildAgentsBlock(skillPaths) {
  const body = buildAgentsSection(skillPaths);
  return `${START}\n<!-- celld-void:generated sha256=${sha256(body)} -->\n${body}\n${END}`;
}

function blockIsGenerated(block) {
  const match = block.match(GENERATED_RE);
  if (!match) return false;
  const body = block
    .slice(block.indexOf("\n") + 1)
    .replace(/^<!-- celld-void:generated sha256=[a-f0-9]{64} -->\n/, "")
    .replace(/\n*<!-- celld-void:end -->\s*$/, "");
  return sha256(body) === match[1];
}

function upsertAgents(root, block, yes, result) {
  const file = join(root, "AGENTS.md");
  const existing = readIfExists(file);

  if (existing === undefined) {
    writeText(file, `# AGENTS\n\n${block}\n`);
    push(result.changed, "AGENTS.md");
    return;
  }

  const start = existing.indexOf(START);
  const end = existing.indexOf(END);
  if (start === -1 && end === -1) {
    const separator = existing.endsWith("\n") ? "\n" : "\n\n";
    writeText(file, `${existing}${separator}${block}\n`);
    push(result.changed, "AGENTS.md");
    return;
  }
  if (start === -1 || end === -1 || end < start) {
    result.warnings.push(
      "AGENTS.md tiene marcadores celld-void incompletos; no lo toco. Corregí los marcadores a mano.",
    );
    push(result.skipped, "AGENTS.md");
    return;
  }

  const endIndex = end + END.length;
  const existingBlock = existing.slice(start, endIndex);
  if (blockIsGenerated(existingBlock)) {
    const next = `${existing.slice(0, start)}${block}${existing.slice(endIndex)}`;
    if (next === existing) {
      push(result.skipped, "AGENTS.md");
    } else {
      writeText(file, next);
      push(result.changed, "AGENTS.md");
    }
    return;
  }

  if (!yes) {
    result.warnings.push(
      "AGENTS.md: la sección celld-void fue editada; la conservo. Corré con --yes para regenerarla (se crea un backup).",
    );
    push(result.skipped, "AGENTS.md");
    return;
  }

  const backupFile = backup(file);
  result.warnings.push(
    `AGENTS.md: la sección celld-void fue editada; backup en ${display(root, backupFile)}.`,
  );
  writeText(file, `${existing.slice(0, start)}${block}${existing.slice(endIndex)}`);
  push(result.changed, "AGENTS.md");
}

function buildInstalledSkill(source) {
  const body = `${source.trimEnd()}

## Docs de la versión instalada

- \`node_modules/celld-void/docs/MAPPING.md\`
- \`node_modules/celld-void/docs/LAB.md\``;
  return `${body}

<!-- celld-void:installed sha256=${sha256(body)} -->
`;
}

function skillIsGenerated(existing) {
  const match = existing.match(INSTALLED_RE);
  if (!match) return false;
  const body = existing.slice(0, match.index).replace(/\n+$/, "");
  return sha256(body) === match[1];
}

function installSkill(root, agent, desired, yes, result) {
  const path = join(agent.skillPath, "SKILL.md").replaceAll("\\", "/");
  const file = join(root, path);
  const existing = readIfExists(file);

  if (existing === undefined) {
    writeText(file, desired);
    push(result.changed, path);
    return;
  }
  if (existing === desired) {
    push(result.skipped, path);
    return;
  }
  if (skillIsGenerated(existing)) {
    writeText(file, desired);
    push(result.changed, path);
    return;
  }
  if (!yes) {
    result.warnings.push(
      `${path}: la skill fue editada; la conservo. Corré con --yes para reinstalarla (se crea un backup).`,
    );
    push(result.skipped, path);
    return;
  }

  const backupFile = backup(file);
  result.warnings.push(
    `${path}: la skill fue editada; backup en ${display(root, backupFile)}.`,
  );
  writeText(file, desired);
  push(result.changed, path);
}

function ensurePlaceholder(root, path, content, result, mode) {
  const file = join(root, path);
  if (existsSync(file)) {
    push(result.skipped, path.replaceAll("\\", "/"));
    return;
  }
  writeText(file, content, mode);
  push(result.changed, path.replaceAll("\\", "/"));
}

function ensurePackageCheck(root, result) {
  const file = join(root, "package.json");
  const raw = readIfExists(file);
  if (raw === undefined) {
    push(result.skipped, "package.json (no existe)");
    return;
  }

  let pkg;
  try {
    pkg = JSON.parse(raw);
  } catch {
    result.warnings.push("package.json inválido; no agrego el script `check`.");
    return;
  }
  if (!pkg || typeof pkg !== "object" || Array.isArray(pkg)) {
    result.warnings.push("package.json inválido; no agrego el script `check`.");
    return;
  }
  if (
    pkg.scripts !== undefined &&
    (typeof pkg.scripts !== "object" || Array.isArray(pkg.scripts))
  ) {
    result.warnings.push("package.json: `scripts` no es un objeto; no agrego `check`.");
    return;
  }

  pkg.scripts = pkg.scripts ?? {};
  if (pkg.scripts.check !== undefined) {
    push(result.skipped, "package.json#scripts.check");
    return;
  }

  pkg.scripts.check = "sh scripts/check-local.sh";
  const indentMatch = raw.match(/\n([ \t]+)"/);
  const indent = indentMatch ? indentMatch[1] : "  ";
  const trailing = raw.endsWith("\n") ? "\n" : "";
  writeText(file, `${JSON.stringify(pkg, null, indent)}${trailing}`);
  push(result.changed, "package.json#scripts.check");
}

export function runSetup(options = {}) {
  const root = resolve(options.cwd ?? process.cwd());
  if (!existsSync(root) || !statSync(root).isDirectory()) {
    throw new Error(`setup: no existe el directorio ${root}`);
  }
  const yes = Boolean(options.yes);
  const result = {
    cwd: root,
    appId: resolveAppId(root),
    agents: [],
    changed: [],
    skipped: [],
    warnings: [],
  };

  const agents = detectAgents(root);
  result.agents = agents.map(({ id, label }) => ({ id, label }));

  const skillPaths =
    agents.length > 0
      ? agents.map((agent) => `${agent.skillPath.replaceAll("\\", "/")}/SKILL.md`)
      : ["node_modules/celld-void/skills/celld-void/SKILL.md"];
  upsertAgents(root, buildAgentsBlock(skillPaths), yes, result);

  if (agents.length === 0) {
    result.warnings.push(
      "no detecté Claude Code, Command Code ni Codex/universal; dejé AGENTS.md sin instalar la skill. Creá .claude/, .commandcode/ o .agents/ y volvé a correr `celld-void setup`.",
    );
  } else {
    const source = readFileSync(SKILL_SOURCE, "utf8");
    const desired = buildInstalledSkill(source);
    for (const agent of agents) installSkill(root, agent, desired, yes, result);
  }

  ensurePlaceholder(root, "worker-exports.ts", buildWorkerExports(), result);
  ensurePlaceholder(root, join("wasm", "README.md"), buildWasmReadme(), result);
  ensurePlaceholder(root, "wasm.d.ts", buildWasmTypes(), result);
  ensurePlaceholder(root, join("container", "README.md"), buildContainerReadme(), result);
  ensurePlaceholder(root, "app.manifest.json", buildManifest(result.appId), result);
  ensurePlaceholder(
    root,
    join("scripts", "check-local.sh"),
    buildCheckScript(),
    result,
    0o755,
  );
  ensurePackageCheck(root, result);

  return result;
}
