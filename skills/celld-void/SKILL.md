---
name: celld-void
description: Build and deploy Void apps on celld. Use when creating, editing, testing, or deploying an app in this repo; covers bindings, Void→celld constraints, tenant model, wasm, idempotency, and the celld-void adapter.
---

# Void sobre celld

## Modelo

- **Una flota = una app nuestra.** Cada app tiene su instancia de `celld` en
  todos los nodos (`us.celld.fleets.<app>`).
- **Multi-tenant dentro de la app**: cells/DOs, `tenant_id`, authz de app.
- `celld` **no** es un runtime para que terceros suban apps.
- El `Host` **solo elige el upstream** en Caddy; **no autoriza**. El tenant se
  resuelve por sesión/`tenant_id`.

## Adapter

`celld-void` traduce `dist/ssr/wrangler.json` (generado por Void) a
un config que celld acepta, stagea `dist/ssr` + `dist/client` y corre
`celld deploy`.

```bash
pnpm build
pnpm exec celld-void deploy \
  --project <project> \
  --name list \
  --bucket s3://<bucket> \
  --endpoint https://<account>.r2.cloudflarestorage.com \
  --region auto \
  --var BETTER_AUTH_SECRET="$BETTER_AUTH_SECRET" \
  --celld /nix/store/...-celld-0.6.2/bin/celld
```

Después del primer deploy: `celld d1 migrations apply default <stage>` (la flota
debe estar corriendo).

## Bindings: los 12 de celld

Declará los bindings custom en `void.config.ts` bajo `cloudflare`; Void los
pasa al config generado.

| Servicio | Clave | Regla |
|---|---|---|
| Workers | `main` | entry SSR (`dist/ssr/index.js`) |
| Static assets | `assets` | `dist/client`; `run_worker_first: ["/**"]` |
| D1 | `d1_databases` | `binding` + `database_name`; `migrations_dir` se descarta |
| KV | `kv_namespaces` | `binding` + `id` (o `preview_id`) |
| R2 | `r2_buckets` | `binding` + `bucket_name`; escribir bajo `app/` |
| Queues | `queues` | `producers`/`consumers`; el consumer va en el Worker |
| Cron | `triggers.crons` | handler `scheduled` |
| DO/Cells | `durable_objects` + `migrations` | toda clase en `migrations` debe estar bindeada |
| Facets | igual que DO | la clase **extiende `DurableObject`**; usar `ctx.exports.Class()` |
| Workflows | `workflows` | `name`/`binding`/`class_name`; **sin `schedules`** |
| Dynamic Workers | `worker_loaders` | solo `binding`; `LOADER.load({compatibilityDate, mainModule, modules})` |
| Containers | `containers` | Docker/Podman en cada nodo; `container/Dockerfile`; experimental, código propio |

### Cobertura real de Void

- **Nativo en Void:** Workers, assets, D1, KV, R2, Queues, Cron y DO/Cells
  (`durable-objects/`). Verificado en `apps/list`.
- **Workflows, Facets y Dynamic Workers:** no son nativos, pero **sí se
  soportan dentro del proyecto Void**. Poné las clases en `worker-exports.ts`
  (self-contained, importá `cloudflare:workers`) y declaralas en `cloudflare`.
  El adapter detecta el archivo y genera `entry.js`, que reexporta el entry de
  Void + tus clases. No hay fork.
  - Facets: usá `ctx.exports.FacetChild()` (handle registrado), no la clase
    local.
  - Workflows: `this.env` está disponible; sin `schedules`.
  - Dynamic Workers: `c.env.LOADER.load(...)` desde una ruta.
- **Wasm:** importá `./add.wasm` desde `worker-exports.ts`; el adapter copia
  los `.wasm` y celld los bundlea. Para Void, `no_bundle: false` (no `rules`).
- **Containers:** `container/Dockerfile` + `@cloudflare/containers`; el adapter
  copia `container/` y reescribe `image`. Cada nodo que sirva la clase necesita
  Docker/Podman. Experimental y para código propio; `enableInternet = false`.

## Reglas duras

- **No `rules` ESModule**: celld las rechaza; el adapter las filtra. Para apps
  Void, `no_bundle: false`: esbuild bundlea y sube el wasm importado. Para
  Workers prebuilt, `no_bundle: true` con los `.wasm` junto al entry.
- **Workflows no agenda**: `schedules` se elimina. El scheduling va por
  `triggers.crons` o por `create()` desde Worker/DO/Queue.
- `WorkflowEntrypoint` se **importa** de `cloudflare:workers`.
- `env.WF.get(id)` es **async**: `const inst = await env.WF.get(id)` antes de
  `status()`/`sendEvent()`.
- Facets: la clase debe extender `DurableObject`; si no, no existe en
  `ctx.exports` y `FacetStartupOptions.class` falla.
- Dynamic Workers: los módulos van como strings en `modules`; `getEntrypoint().fetch`.
- R2 de la app: prefijo `app/`. **Nunca** escribir `probe/`, `cells/`, `nodes/`,
  `node-cells/`, `fleet/`, `deploy/`, `deploy-blobs/`, `log/`, `wake/`,
  `telemetry/`.
- Workflows/Facets/Dynamic Workers: clases en `worker-exports.ts`; el adapter
  genera `entry.js` y setea `main`. No declararlos solo en `cloudflare`.
- `worker-exports.ts` es self-contained: no importa módulos virtuales de Void;
  usá los bindings crudos (`this.env`, `c.env`).
- **R2: un token por flota**, scoped a su bucket. No usar claves de cuenta.
- **Idempotency keys** en requests con efectos; el takeover no debe replayar.
- No usar servicios que celld no tiene: Workers AI, Browser Rendering, Email,
  Hyperdrive, Vectorize, etc. El adapter falla si están no vacíos.
- Containers: no meter código de tenant; no es frontera de seguridad.

## Checklist para una app nueva

1. `apps/<app>` con `void.config.ts` y `cloudflare` bindings.
2. D1: schema/migraciones; tenant por sesión.
3. R2: bucket propio + token scoped; prefijo `app/`.
4. Auth + `tenant_id`; nunca derivar identidad del `Host`.
5. Idempotency keys en mutaciones.
6. `pnpm build` y `celld-void` a la flota (`us.celld.fleets.<app>`).
7. Ruta `<app>.example.com` en `tenants.caddy`; 404 fail-closed.
8. Tests: health, auth, CRUD, aislamiento de tenant, takeover.

## Referencias

- `docs/MAPPING.md` — matriz Void↔celld.
- `docs/LAB.md` — suite y evidencia en celld.
- `examples/raw-lab` — ejemplos ejecutables de los 12 servicios.
- `docs/adr/ADR-001-security.md`, `ADR-002-durability.md`, `ADR-003-wasm.md`.
