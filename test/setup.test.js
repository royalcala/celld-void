import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { runCreate } from "../src/create.js";
import { runSetup } from "../src/setup.js";

const BIN = fileURLToPath(new URL("../bin/deploy.js", import.meta.url));

const tempProject = () => mkdtempSync(join(tmpdir(), "celld-void-setup-"));

const read = (root, path) => readFileSync(join(root, path), "utf8");

const writePackage = (root, pkg) =>
  writeFileSync(join(root, "package.json"), `${JSON.stringify(pkg, null, 2)}\n`);

const PLACEHOLDERS = [
  "worker-exports.ts",
  "wasm/README.md",
  "wasm.d.ts",
  "container/README.md",
  "app.manifest.json",
  "scripts/check-local.sh",
];

test("crea AGENTS.md, skill y placeholders para Claude Code", () => {
  const root = tempProject();
  try {
    mkdirSync(join(root, ".claude"));
    writePackage(root, { name: "demo-app" });

    const result = runSetup({ cwd: root });

    assert.deepEqual(
      result.agents.map((agent) => agent.id),
      ["claude"],
    );
    const agents = read(root, "AGENTS.md");
    assert.match(agents, /<!-- celld-void:start -->/);
    assert.match(agents, /<!-- celld-void:end -->/);
    assert.match(agents, /## celld-void/);
    assert.match(agents, /\.claude\/skills\/celld-void\/SKILL\.md/);
    assert.match(agents, /node_modules\/celld-void\/docs\/MAPPING\.md/);
    assert.match(agents, /node_modules\/celld-void\/docs\/LAB\.md/);

    const skill = read(root, ".claude/skills/celld-void/SKILL.md");
    assert.match(skill, /^---\nname: celld-void/m);
    assert.match(skill, /## Docs de la versión instalada/);
    assert.match(skill, /node_modules\/celld-void\/docs\/MAPPING\.md/);
    assert.match(skill, /node_modules\/celld-void\/docs\/LAB\.md/);

    for (const path of PLACEHOLDERS) {
      assert.ok(existsSync(join(root, path)), `falta ${path}`);
    }
    assert.ok(
      statSync(join(root, "scripts/check-local.sh")).mode & 0o111,
      "check-local.sh debe ser ejecutable",
    );

    const manifest = JSON.parse(read(root, "app.manifest.json"));
    assert.deepEqual(Object.keys(manifest), [
      "id",
      "capabilities",
      "events",
      "gatekeepers",
      "blueprints",
    ]);
    assert.equal(manifest.id, "demo-app");
    assert.deepEqual(manifest.capabilities, []);

    const pkg = JSON.parse(read(root, "package.json"));
    assert.equal(pkg.scripts.check, "sh scripts/check-local.sh");
    assert.equal(existsSync(join(root, ".github")), false);
    assert.equal(
      existsSync(join(root, "container/Dockerfile")),
      false,
      "el placeholder no debe activar containers",
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("preserva el contenido existente de AGENTS.md y agrega su sección", () => {
  const root = tempProject();
  try {
    mkdirSync(join(root, ".claude"));
    const original = "# Void\n\nSección generada por void init.\n";
    writeFileSync(join(root, "AGENTS.md"), original);

    runSetup({ cwd: root });

    const agents = read(root, "AGENTS.md");
    assert.ok(agents.startsWith(original), "el contenido previo queda intacto");
    assert.match(agents, /## celld-void/);
    assert.match(agents, /Sección generada por void init/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("es idempotente: una segunda corrida no cambia nada", () => {
  const root = tempProject();
  try {
    mkdirSync(join(root, ".claude"));
    writePackage(root, { name: "idempotent-app" });

    runSetup({ cwd: root });
    const before = new Map(
      ["AGENTS.md", ".claude/skills/celld-void/SKILL.md", ...PLACEHOLDERS].map(
        (path) => [path, read(root, path)],
      ),
    );

    const second = runSetup({ cwd: root });

    assert.deepEqual(second.changed, []);
    for (const [path, content] of before) {
      assert.equal(read(root, path), content, `${path} cambió`);
    }
    assert.equal(existsSync(join(root, "AGENTS.md.celld-void.bak")), false);
    assert.equal(
      existsSync(join(root, ".claude/skills/celld-void/SKILL.md.celld-void.bak")),
      false,
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("no pisa placeholders existentes ni un script check custom", () => {
  const root = tempProject();
  try {
    mkdirSync(join(root, ".claude"));
    mkdirSync(join(root, "container"), { recursive: true });
    mkdirSync(join(root, "scripts"), { recursive: true });
    writeFileSync(join(root, "worker-exports.ts"), "// custom exports\n");
    writeFileSync(join(root, "wasm.d.ts"), "// custom wasm types\n");
    writeFileSync(join(root, "container/README.md"), "custom container\n");
    writeFileSync(join(root, "scripts/check-local.sh"), "#!/bin/sh\necho custom\n");
    writePackage(root, { name: "keep-me", scripts: { check: "custom-check" } });

    runSetup({ cwd: root, yes: true });

    assert.equal(read(root, "worker-exports.ts"), "// custom exports\n");
    assert.equal(read(root, "wasm.d.ts"), "// custom wasm types\n");
    assert.equal(read(root, "container/README.md"), "custom container\n");
    assert.equal(
      read(root, "scripts/check-local.sh"),
      "#!/bin/sh\necho custom\n",
    );
    assert.equal(JSON.parse(read(root, "package.json")).scripts.check, "custom-check");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("detecta Claude Code, Command Code y Codex/universal a la vez", () => {
  const root = tempProject();
  try {
    mkdirSync(join(root, ".claude"));
    mkdirSync(join(root, ".commandcode"));
    mkdirSync(join(root, ".agents"));

    const result = runSetup({ cwd: root });

    assert.deepEqual(
      result.agents.map((agent) => agent.id),
      ["claude", "commandcode", "universal"],
    );
    for (const path of [
      ".claude/skills/celld-void/SKILL.md",
      ".commandcode/skills/celld-void/SKILL.md",
      ".agents/skills/celld-void/SKILL.md",
    ]) {
      assert.ok(existsSync(join(root, path)), `falta ${path}`);
      assert.match(read(root, path), /## Docs de la versión instalada/);
    }
    const agents = read(root, "AGENTS.md");
    assert.match(agents, /\.claude\/skills\/celld-void\/SKILL\.md/);
    assert.match(agents, /\.commandcode\/skills\/celld-void\/SKILL\.md/);
    assert.match(agents, /\.agents\/skills\/celld-void\/SKILL\.md/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("sin agente detectado deja AGENTS.md y avisa", () => {
  const root = tempProject();
  try {
    const result = runSetup({ cwd: root });

    assert.deepEqual(result.agents, []);
    assert.ok(
      result.warnings.some((warning) => /no detecté/.test(warning)),
      "debe avisar que no hay agente",
    );
    assert.ok(existsSync(join(root, "AGENTS.md")));
    assert.match(read(root, "AGENTS.md"), /node_modules\/celld-void\/skills\/celld-void\/SKILL\.md/);
    assert.equal(existsSync(join(root, ".claude")), false);
    assert.equal(existsSync(join(root, ".commandcode")), false);
    assert.equal(existsSync(join(root, ".agents")), false);
    assert.equal(JSON.parse(read(root, "app.manifest.json")).id, basename(root));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("sección editada: avisa sin --yes y hace backup al regenerar", () => {
  const root = tempProject();
  try {
    mkdirSync(join(root, ".claude"));
    const prefix = "# Void\n\nContenido de void init.\n\n";
    writeFileSync(join(root, "AGENTS.md"), prefix);

    runSetup({ cwd: root });
    const edited = read(root, "AGENTS.md").replace(
      "Reglas duras:",
      "Reglas duras:\n\nEDITADO POR HUMANO",
    );
    writeFileSync(join(root, "AGENTS.md"), edited);

    const kept = runSetup({ cwd: root });
    assert.match(read(root, "AGENTS.md"), /EDITADO POR HUMANO/);
    assert.ok(kept.warnings.some((warning) => /editada/.test(warning)));
    assert.equal(existsSync(join(root, "AGENTS.md.celld-void.bak")), false);

    const forced = runSetup({ cwd: root, yes: true });
    const regenerated = read(root, "AGENTS.md");
    assert.ok(regenerated.startsWith(prefix), "el resto del archivo se preserva");
    assert.doesNotMatch(regenerated, /EDITADO POR HUMANO/);
    assert.ok(forced.warnings.some((warning) => /backup/.test(warning)));
    assert.match(
      read(root, "AGENTS.md.celld-void.bak"),
      /EDITADO POR HUMANO/,
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("skill editada: se conserva sin --yes y se respalda al reinstalar", () => {
  const root = tempProject();
  try {
    mkdirSync(join(root, ".claude"));
    runSetup({ cwd: root });
    const path = ".claude/skills/celld-void/SKILL.md";
    writeFileSync(join(root, path), `${read(root, path)}\nEDITADO POR HUMANO\n`);

    const kept = runSetup({ cwd: root });
    assert.match(read(root, path), /EDITADO POR HUMANO/);
    assert.ok(kept.warnings.some((warning) => /skill fue editada/.test(warning)));
    assert.equal(existsSync(join(root, `${path}.celld-void.bak`)), false);

    const forced = runSetup({ cwd: root, yes: true });
    assert.doesNotMatch(read(root, path), /EDITADO POR HUMANO/);
    assert.ok(forced.warnings.some((warning) => /backup/.test(warning)));
    assert.match(read(root, `${path}.celld-void.bak`), /EDITADO POR HUMANO/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("CLI setup --yes corre sin interacción y devuelve 0", () => {
  const root = tempProject();
  try {
    mkdirSync(join(root, ".claude"));
    writePackage(root, { name: "cli-app" });

    const stdout = execFileSync(
      process.execPath,
      [BIN, "setup", "--dir", root, "--yes"],
      { encoding: "utf8" },
    );

    assert.match(stdout, /celld-void setup:/);
    assert.match(stdout, /app: cli-app/);
    assert.ok(existsSync(join(root, "app.manifest.json")));
    assert.ok(existsSync(join(root, ".claude/skills/celld-void/SKILL.md")));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("CLI ayuda y comando desconocido", () => {
  const help = spawnSync(process.execPath, [BIN, "help"], { encoding: "utf8" });
  assert.equal(help.status, 0);
  assert.match(help.stdout, /setup/);
  assert.match(help.stdout, /create/);

  const setupHelp = spawnSync(process.execPath, [BIN, "setup", "--help"], {
    encoding: "utf8",
  });
  assert.equal(setupHelp.status, 0);
  assert.match(setupHelp.stdout, /--yes/);

  const unknown = spawnSync(process.execPath, [BIN, "nope"], { encoding: "utf8" });
  assert.equal(unknown.status, 2);
  assert.match(unknown.stderr, /comando desconocido/);
});

test("create rechaza directorios no vacíos y soporta --skip-scaffold", () => {
  const root = tempProject();
  const empty = tempProject();
  try {
    writeFileSync(join(root, "keep.txt"), "x\n");
    assert.throws(
      () => runCreate(root, { skipScaffold: true }),
      /no está vacío/,
    );

    const result = runCreate(empty, { skipScaffold: true, yes: true });
    assert.equal(result.scaffold, null);
    assert.equal(result.setup.appId, basename(empty));
    assert.ok(existsSync(join(empty, "AGENTS.md")));
    assert.ok(existsSync(join(empty, "app.manifest.json")));
  } finally {
    rmSync(root, { recursive: true, force: true });
    rmSync(empty, { recursive: true, force: true });
  }
});
