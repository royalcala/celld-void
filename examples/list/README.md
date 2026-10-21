# List — template vivo Void + celld

App de lista con **auth**, **D1**, **tenant por sesión**, **idempotencia**,
**DO/Cells**, **KV**, **R2**, **Queues** y **Cron**. El molde reusable vive en
`celld-void/templates/starter`.

## Modelo

- `tenant_id = user.id`: cada usuario es un tenant. Los items se filtran
  siempre por la sesión; el `Host` **no** autoriza.
- `POST /api/items` acepta `Idempotency-Key`; el segundo request con la misma
  key devuelve la respuesta guardada, sin crear otro item.
- Una flota = una app. Esta app va a `us.celld.fleets.list` (8096/8097) y
  `app.example.com`.

## Ejemplos nativos de Void

- `durable-objects/counter.ts` → `GET/POST /api/counter`.
- `queues/audit.ts` → `POST /api/audit`, estado en `/api/audit/state`.
- `crons/heartbeat.ts` → `GET /api/heartbeat` cada minuto.
- `routes/api/kv.ts` → KV put/get.
- `routes/api/storage.ts` → R2 bajo `app/list/...`.
- `worker-exports.ts` → Workflow (`/api/workflow`), Facets (`/api/facet`) y
  Dynamic Worker (`/api/dynamic`).
- `add.wasm` + `WasmCell` → `/api/wasm`.
- `container/` + `ListContainer` → `/api/container` (Docker/Podman).

## Local

```sh
pnpm install
python3 -c 'import secrets; print("BETTER_AUTH_SECRET=" + secrets.token_hex(32))' > .env
pnpm exec void db generate
pnpm dev
```

Flujo: `/login` → registro → `/items` (crear/listar/borrar).

## Deploy a celld

```sh
pnpm build
BETTER_AUTH_SECRET=... node ../../bin/deploy.js \
  --project . --name list \
  --bucket s3://<bucket> \
  --endpoint https://<account>.r2.cloudflarestorage.com \
  --region auto \
  --var BETTER_AUTH_SECRET="$BETTER_AUTH_SECRET" \
  --celld /nix/store/...-celld-0.6.2/bin/celld
```

`--var` inyecta el secreto en `vars` del config traducido (no se commitea).

## Pruebas

- `/login` y `/items` sin sesión → redirect a `/login`.
- Dos usuarios: cada uno ve solo sus items.
- `POST /api/items` dos veces con la misma `Idempotency-Key` → un solo item.
- `DELETE /api/items?id=...` de otro tenant → no borra.
- `/api/counter`, `/api/kv`, `/api/storage`, `/api/audit/state`,
  `/api/heartbeat`, `/api/workflow`, `/api/facet`, `/api/dynamic`,
  `/api/wasm` y `/api/container` responden.

## Limitaciones

- **Workflows, Facets y Dynamic Workers no son nativos de Void**, pero se
  soportan dentro del proyecto con `worker-exports.ts` y el `entry.js` que
  genera el adapter.
- Containers: requieren Docker/Podman en cada nodo; son experimentales y para
  código nuestro. `enableInternet = false` en el ejemplo.
- `BETTER_AUTH_SECRET` viaja como `vars` (celld no tiene secret binding
  separado en este adapter). Rotarlo requiere redeploy.
