import { defineConfig } from "void/config";

export default defineConfig({
  auth: { providers: ["email"] },
  worker: {
    compatibility_date: "2026-02-24",
  },
  cloudflare: {
    // Cambiar por el nombre de la app/flota. `celld-void --name` lo pisa.
    name: "app",
    // Cambiar por los IDs/bucket reales de la flota.
    kv_namespaces: [{ binding: "KV", id: "app" }],
    r2_buckets: [{ binding: "STORAGE", bucket_name: "app-bucket" }],
    // Workflows/Facets/Dynamic Workers: no son nativos de Void; las clases
    // viven en worker-exports.ts y el adapter genera el entry wrapper.
    worker_loaders: [{ binding: "LOADER" }],
    containers: [
      {
        class_name: "AppContainer",
        image: "./container/Dockerfile",
        instance_type: "basic",
      },
    ],
    workflows: [
      { name: "app-workflow", binding: "WF", class_name: "AppWorkflow" },
    ],
    durable_objects: {
      bindings: [
        { name: "FACET_PARENT", class_name: "FacetParent" },
        { name: "FACET_CHILD", class_name: "FacetChild" },
        { name: "WASM_CELL", class_name: "WasmCell" },
        { name: "CONTAINER", class_name: "AppContainer" },
      ],
    },
    migrations: [
      {
        tag: "celld-void-facets-v1",
        new_sqlite_classes: ["FacetParent", "FacetChild"],
      },
    ],
  },
});
