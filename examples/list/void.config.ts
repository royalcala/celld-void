import { defineConfig } from "void/config";

export default defineConfig({
  auth: { providers: ["email"] },
  worker: {
    compatibility_date: "2026-02-24",
  },
  cloudflare: {
    name: "list",
    kv_namespaces: [{ binding: "KV", id: "list" }],
    r2_buckets: [{ binding: "STORAGE", bucket_name: "app-bucket" }],
    worker_loaders: [{ binding: "LOADER" }],
    containers: [
      {
        class_name: "ListContainer",
        image: "./container/Dockerfile",
        instance_type: "basic",
      },
    ],
    workflows: [
      { name: "list-workflow", binding: "WF", class_name: "ListWorkflow" },
    ],
    durable_objects: {
      bindings: [
        { name: "FACET_PARENT", class_name: "FacetParent" },
        { name: "FACET_CHILD", class_name: "FacetChild" },
        { name: "WASM_CELL", class_name: "WasmCell" },
        { name: "CONTAINER", class_name: "ListContainer" },
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
