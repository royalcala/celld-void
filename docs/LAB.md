# Lab — Void sobre celld

Estado: 2026-10-21. La matriz de servicios y la evidencia funcional están en
[`MAPPING.md`](./MAPPING.md); este archivo cubre la suite local y el smoke
manual.

## Suite local (sin celld)

```sh
cd celld-void
node --test
```

Cubre:

- traducción del `wrangler.json` generado por Void (`rules`, assets, D1, KV,
  R2, queues, cron, DO/Cells, workflows, loaders, containers),
- rechazo de servicios que celld no soporta y de claves desconocidas,
- staging de `dist/ssr`, `dist/client`, migraciones, wasm y container,
- `setup`: AGENTS.md nuevo/existente/idempotente, detección de agentes,
  instalación de la skill, placeholders, `--yes` y conflictos con backup.

## check-local en una app

`celld-void setup` crea `scripts/check-local.sh` y el script `check` de
`package.json` (solo si faltan):

```sh
pnpm run check
```

El script corre `typecheck`, `test` y `build` cuando esos scripts existen. No
toca `.github/` ni CI.

## Smoke manual en el lab

1. `pnpm exec void init` y `pnpm exec celld-void setup`.
2. `pnpm run check`.
3. `pnpm build`.
4. Deploy con `celld-void deploy --bucket ... --endpoint ...` a la flota
   `us.celld.fleets.<app>`.
5. `celld d1 migrations apply default <stage>` si hay D1.
6. Verificar: `/` y login (200/redirect), CRUD autenticado, aislamiento entre
   dos sesiones (`tenant_id`), idempotencia de mutaciones, y los endpoints de
   DO/KV/R2/queues/cron que use la app.
7. Si la app usa workflows, facets, dynamic workers o wasm, verificar sus
   rutas (`/api/workflow`, `/api/facet`, `/api/dynamic`, `/api/wasm`).

El `Host` solo elige el upstream en Caddy; no autoriza. Los tests de
aislamiento se hacen por sesión, no cambiando el Host.

## Pendientes

- Port completo del lab crudo (Worker) a Void: los 12 servicios ya están
  verificados, pero la app de referencia del lab sigue siendo Worker crudo.
- Workflows, facets y dynamic workers no son nativos de Void; se validan vía
  `worker-exports.ts` + el `entry.js` que genera el adapter.
- Containers: requieren Docker/Podman en cada nodo y son experimentales; solo
  código propio/confiable.
