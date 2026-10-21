import assert from "node:assert/strict";
import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { stageVoidDist } from "../src/stage.js";
import { translateVoidConfig } from "../src/translate.js";

const fixture = JSON.parse(
  readFileSync(new URL("./fixtures/void-wrangler.json", import.meta.url), "utf8"),
);

test("traduce el config generado por Void a celld", () => {
  const out = translateVoidConfig(fixture);
  assert.equal(out.rules, undefined, "ESModule se descarta");
  assert.equal(out.assets.directory, "./client");
  assert.equal(out.assets.binding, "ASSETS");
  assert.equal(out.d1_databases[0].migrations_dir, undefined);
  assert.equal(out.d1_databases[0].database_name, "default");
  assert.equal(out.workflows[0].schedules, undefined);
  assert.equal(out.workflows[0].binding, "WF");
  assert.deepEqual(out.worker_loaders, [{ binding: "LOADER" }]);
  assert.equal(out.python_modules, undefined);
  assert.equal(out.queues, undefined, "queues vacías se omiten");
  assert.equal(out.no_bundle, false, "sin wasm, celld bundlea");
  assert.ok(
    out.durable_objects.bindings.some(
      (binding) => binding.class_name === "Extra",
    ),
    "la clase de migrations queda bindeada",
  );
});

test("rechaza un servicio no soportado si tiene contenido", () => {
  assert.throws(
    () => translateVoidConfig({ ...fixture, vectorize: [{ index: "x" }] }),
    /vectorize/,
  );
});

test("rechaza claves desconocidas con contenido", () => {
  assert.throws(
    () => translateVoidConfig({ ...fixture, algo_raro: { x: 1 } }),
    /algo_raro/,
  );
});

test("rechaza containers sin clase DO declarada", () => {
  assert.throws(
    () =>
      translateVoidConfig({
        ...fixture,
        containers: [{ class_name: "Missing", image: "./Dockerfile" }],
      }),
    /Missing/,
  );
});

test("inyecta vars del deploy", () => {
  const out = translateVoidConfig(fixture, {
    vars: { BETTER_AUTH_SECRET: "test" },
  });
  assert.equal(out.vars.BETTER_AUTH_SECRET, "test");
});

test("agrega migración para una clase DO sin migración", () => {
  const out = translateVoidConfig({
    ...fixture,
    durable_objects: {
      bindings: [{ name: "FACET_PARENT", class_name: "FacetParent" }],
    },
    migrations: [],
  });
  assert.ok(
    out.migrations.some((migration) =>
      (migration.new_sqlite_classes ?? []).includes("FacetParent"),
    ),
  );
});

test("stage agrega un entry wrapper para exports custom", () => {
  const root = mkdtempSync(join(tmpdir(), "celld-void-exports-"));
  try {
    mkdirSync(join(root, "dist", "ssr"), { recursive: true });
    writeFileSync(join(root, "dist", "ssr", "index.js"), "export default {};\n");
    writeFileSync(
      join(root, "dist", "ssr", "wrangler.json"),
      JSON.stringify(fixture),
    );
    writeFileSync(
      join(root, "worker-exports.ts"),
      "export class FacetParent {}\n",
    );

    const stage = stageVoidDist({
      projectDir: root,
      outDir: join(root, ".celld-void"),
      name: "lab-void",
      exports: "worker-exports.ts",
    });
    const config = JSON.parse(readFileSync(join(stage, "wrangler.json"), "utf8"));
    assert.equal(config.main, "entry.js");
    const entry = readFileSync(join(stage, "entry.js"), "utf8");
    assert.match(entry, /export \{ default \} from "\.\/index\.js"/);
    assert.match(entry, /export \* from "\.\/worker-exports\.ts"/);
    assert.equal(
      readFileSync(join(stage, "worker-exports.ts"), "utf8"),
      "export class FacetParent {}\n",
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
test("reescribe la imagen del container al path del staging", () => {
  const out = translateVoidConfig(
    {
      ...fixture,
      durable_objects: {
        bindings: [{ name: "CONT", class_name: "Cont" }],
      },
      containers: [{ class_name: "Cont", image: "/abs/Dockerfile" }],
    },
    { containerImage: "./container/Dockerfile" },
  );
  assert.equal(out.containers[0].image, "./container/Dockerfile");
});

test("stage copia ssr/client y escribe el config celld", () => {
  const root = mkdtempSync(join(tmpdir(), "celld-void-"));
  try {
    mkdirSync(join(root, "dist", "ssr"), { recursive: true });
    mkdirSync(join(root, "dist", "client"), { recursive: true });
    writeFileSync(join(root, "dist", "ssr", "index.js"), "export default {};\n");
    writeFileSync(
      join(root, "dist", "ssr", "wrangler.json"),
      JSON.stringify(fixture),
    );
    writeFileSync(join(root, "dist", "client", "asset.txt"), "asset\n");
    writeFileSync(join(root, "dist", "client", ".assetsignore"), "*.map\n");
    mkdirSync(join(root, "migrations"), { recursive: true });
    writeFileSync(join(root, "migrations", "0001.sql"), "create table t (id text);\n");

    const stage = stageVoidDist({
      projectDir: root,
      outDir: join(root, ".celld-void"),
      name: "lab-void",
    });
    const config = JSON.parse(readFileSync(join(stage, "wrangler.json"), "utf8"));
    assert.equal(config.name, "lab-void");
    assert.equal(config.main, "index.js");
    assert.equal(config.assets.directory, "./client");
    assert.equal(config.d1_databases[0].migrations_dir, "./migrations");
    assert.equal(
      readFileSync(join(stage, "migrations", "0001.sql"), "utf8"),
      "create table t (id text);\n",
    );
    assert.equal(
      readFileSync(join(stage, "client", "asset.txt"), "utf8"),
      "asset\n",
    );
    assert.equal(
      existsSync(join(stage, "client", ".assetsignore")),
      false,
      ".assetsignore se elimina para celld",
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
