# Mapeo Void → celld (12 servicios)

Estado: 2026-10-20. Fuente celld: `crates/celld/deploy.rs` (claves aceptadas).
Fuente Void: `void.config.ts` (`cloudflare` como escape hatch) + convenciones
(`pages/`, `routes/`, `middleware/`, `crons/`, `queues/`, `db/`, `*.ws.ts`).

| Servicio | Clave celld | Cómo llega desde Void | Traducción del adapter | Estado |
|---|---|---|---|---|
| Workers (entry) | `main` | Void genera `dist/ssr` | `main` apunta al entry SSR | diseño |
| Static assets | `assets` | `dist/client`; `cloudflare.assets` | `directory: ./dist/client`, `binding: ASSETS`, `run_worker_first` | diseño |
| D1 | `d1_databases` | inferido `db` (`DB`) o `cloudflare.d1_databases` | conservar `binding`, `database_id`, `migrations_dir` | diseño |
| KV | `kv_namespaces` | inferido `kv` (`KV`) o `cloudflare.kv_namespaces` | exigir `id` o `preview_id` | diseño |
| R2 | `r2_buckets` | inferido `storage` (`STORAGE`) o `cloudflare.r2_buckets` | conservar `binding` y `bucket_name` | diseño |
| Queues | `queues` | `queues/` + `cloudflare.queues` | conservar producers/consumers | diseño |
| Workflows | `workflows` | `cloudflare.workflows` | **quitar `schedules`** (celld no lo modela) | diseño |
| Cron Triggers | `triggers.crons` | `crons/` + `cloudflare.triggers` | mapear a `triggers.crons` | diseño |
| Durable Objects / Cells | `durable_objects.bindings` + `migrations` | `*.ws.ts` + `cloudflare.durable_objects/migrations` | toda clase en `migrations` debe estar en `bindings`; SQLite | diseño |
| Durable Object Facets | (sin clave propia) | clases facet en `cloudflare.durable_objects` | agregar **cada facet class** a `durable_objects.bindings` + `migrations.new_sqlite_classes` | diseño |
| Dynamic Workers | `worker_loaders` | `cloudflare.worker_loaders` | solo `binding`; rechazar `limits`, `tails`, `allowExperimental` | diseño |
| Containers | `containers` | `cloudflare.containers` | Docker/Podman en el nodo; `container/Dockerfile`; experimental | verificado |

## Lectura

- **Los 12 están representados** en celld. No falta ninguno.
- **5 requieren traducción especial:** static assets (directory/binding), facets
  (bindings explícitos), dynamic workers (`worker_loaders`), workflows (sin
  `schedules`) y containers (DO SQLite + experimental).
- Void ya pasa `cloudflare` al config generado. El adapter debe leer **ese
  config generado**, no solo las convenciones, para no perder bindings custom.
- Claves que celld **rechaza** y el adapter debe quitar: `rules`, `base_dir`,
  `find_additional_modules`, `workflows[].schedules`,
  `worker_loaders[].limits/tails/allowExperimental`.
- Wasm (ADR-003): `no_bundle: true` y los `.wasm` **junto al entry**; no usar
  `rules`.

## Verificación en lab (raw celld, 2026-10-20)

- Workers, static assets, D1, KV, R2, Queues, Cron, DO/Cells, Facets,
  Workflows y Dynamic Workers: **verificados** en `examples/raw-lab` (Worker crudo).
- **En Void:** Workers, assets, D1, KV, R2, Queues, Cron y DO/Cells se
  verificaron en `apps/list` (counter, kv, storage, audit, heartbeat).
  Workflows, Facets y Dynamic Workers **no son nativos**, pero se verificaron
  en la misma app vía `worker-exports.ts` + `entry.js` del adapter (`/api/workflow`,
  `/api/facet`, `/api/dynamic`).
- **Wasm:** `add.wasm` importado y bundleado; `/api/wasm` → `{"add":5}`.
  `no_bundle: false` para apps Void.
- **Containers:** verificado en `apps/list` (`/api/container` → dos hostnames
  distintos). Requiere Docker/Podman en cada nodo; el fence de celld bloquea
  la red del nodo. Experimental y solo código propio.
- `packages/void-extras` **implementado** (traducción + staging + tests); el
  spike Void se sirvió en celld (`/` y `/login` 200) y `apps/list` corre en
  `list.example.com` con auth, D1, tenant e idempotencia. El lab sigue siendo
  Worker crudo; el port del lab a Void queda pendiente. La matriz de arriba es
  el contrato que cumple el adapter.

## Nombre del template

Lo común es **`starter`** (`create-vite`, `vite-starter`, etc.); `template` es
más genérico y `template starter` es redundante. Recomendación:

- App demo: `apps/list` (es una app real de lista, no un template vacío).
- Template reusable: `packages/void-extras/templates/starter`.
- Si se publica como repo aparte: `void-starter`.

## Fuentes

- [Void — Config](https://void.cloud/reference/config)
- [Void — Cron Jobs](https://void.cloud/guide/jobs)
