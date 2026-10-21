# Starter — Void + celld

Molde con **auth**, **D1**, **tenant por sesión**, **idempotencia**, **DO/Cells**,
**KV**, **R2**, **Queues** y **Cron**. Copiar a `apps/<name>` y cambiar `name`,
flota, bucket, KV id y R2 bucket.

## Copiar

```sh
cp -r celld-void/templates/starter apps/<name>
cd apps/<name>
# cambiar package.json name y void.config.ts (name, KV id, R2 bucket)
pnpm install
```

`void.lock.json` se genera al build; commitearlo cuando Void agregue recursos
(DO/migraciones).

## Ejemplos incluidos

- `durable-objects/counter.ts` → `GET/POST /api/counter` (DO/Cells).
- `queues/audit.ts` → `POST /api/audit`, estado en `/api/audit/state`.
- `crons/heartbeat.ts` → `GET /api/heartbeat` (cada minuto).
- `routes/api/kv.ts` → KV put/get.
- `routes/api/storage.ts` → R2 put/get bajo `app/<app>/...`.
- `worker-exports.ts` → Workflow (`/api/workflow`), Facets
  (`/api/facet`) y Dynamic Worker (`/api/dynamic`).
- `add.wasm` + `WasmCell` → `/api/wasm` (wasm importado y bundleado).
- `container/` + `AppContainer` → `/api/container` (Docker/Podman).
- `POST /api/items` con `Idempotency-Key` y aislamiento por `tenant_id`.

## Modelo

- `tenant_id = user.id`: cada usuario es un tenant. Los items se filtran por la
  sesión; el `Host` **no** autoriza.
- Una flota = una app. Declarar `us.celld.fleets.<name>` en `tu infra`,
  `<name>.example.com` en `tenants.caddy` y un bucket/token R2 scoped.

## Local

```sh
echo "BETTER_AUTH_SECRET=$(python3 -c 'import secrets;print(secrets.token_hex(32))')" > .env
pnpm exec void db generate   # si cambiaste el schema
pnpm dev
```

## Deploy a celld

```sh
BETTER_AUTH_SECRET=... \
CELD_APP=<name> CELD_BUCKET=s3://<bucket> \
R2_ENDPOINT=https://<account>.r2.cloudflarestorage.com \
pnpm deploy:celld
```

El script usa `../../bin/deploy.js` (este template vive dentro de
`celld-void`). Si lo copiás a `apps/<name>`, ajustá la ruta a
`../../celld-void/bin/deploy.js`.

Aplicar migraciones D1 después del primer deploy:

```sh
celld d1 migrations apply default .celld-void \
  --bucket "$CELD_BUCKET" --endpoint "$R2_ENDPOINT" --region auto
```

## Pruebas

- `/login` y `/items` sin sesión → redirect a `/login`.
- Dos usuarios: cada uno ve solo sus items.
- `POST /api/items` dos veces con la misma `Idempotency-Key` → un solo item.
- `GET/POST /api/counter` incrementa y persiste.
- `/api/kv`, `/api/storage`, `/api/audit/state` y `/api/heartbeat` responden.

## Limitaciones

- `BETTER_AUTH_SECRET` viaja como `vars` (celld no expone un secret binding
  separado). Rotarlo requiere redeploy.
- **Workflows, Facets y Dynamic Workers no son nativos de Void.** Se soportan
  dentro del proyecto con `worker-exports.ts`: el adapter detecta el archivo y
  genera `entry.js` que reexporta el entry de Void + tus clases. No hay fork.
- Facets: usar `ctx.exports.FacetChild()` (handle registrado), no la clase local.
- Wasm: se importa (`import m from "./add.wasm"`), el adapter lo copia y celld
  lo bundlea. `no_bundle` queda en `false` para apps Void.
- Containers: `container/Dockerfile` + `@cloudflare/containers`; cada nodo que
  sirva la clase necesita Docker o Podman. Son experimentales y para **código
  nuestro**, no de tenants. `enableInternet = false` por defecto en el ejemplo.
- R2 de la app: usar prefijo `app/<app>/...` para no tocar los prefijos
  reservados del store de celld.
