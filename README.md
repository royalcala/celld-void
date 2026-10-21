# celld-void

Adapter mínimo para desplegar apps **Void** en **celld**.

## Qué hace

1. Corre `pnpm build` (opcional con `--skip-build`).
2. Lee `dist/ssr/wrangler.json` (el config Cloudflare que genera Void).
3. Lo traduce a un config que celld acepta:
   - elimina `rules` ESModule,
   - reescribe `assets.directory` a `./client`,
   - quita `workflows[].schedules` y `script_name`,
   - normaliza D1/KV/R2/Queues/Workflows/Worker Loaders,
   - agrega a `durable_objects.bindings` las clases de `migrations`,
   - falla si hay servicios que celld no soporta y están no vacíos.
4. Stagea `dist/ssr` + `dist/client` y ejecuta `celld deploy`.

## Uso

```bash
pnpm build
pnpm exec celld-void deploy \
  --project apps/list \
  --name list \
  --bucket s3://<bucket> \
  --endpoint https://<account>.r2.cloudflarestorage.com \
  --region auto \
  --var BETTER_AUTH_SECRET="$BETTER_AUTH_SECRET" \
  --celld /nix/store/...-celld-0.6.2/bin/celld
```

`--skip-build` usa el `dist/` existente. El staging por defecto va a
`<project>/.celld-void`. `--var K=V` (repetible) inyecta variables en `vars`
del config traducido.

Migrations: si el proyecto tiene `migrations/` o `db/migrations/`, el staging
las copia y escribe `migrations_dir: "./migrations"`. Después del primer
deploy:

```bash
celld d1 migrations apply default <stage> \
  --bucket "$BUCKET" --endpoint "$ENDPOINT" --region auto
```

## Workflows, Facets y Dynamic Workers

Void no los expone de forma nativa, pero el adapter los soporta con un entry
wrapper:

- Poné las clases en `worker-exports.ts` (o `.js`), self-contained, importando
  `cloudflare:workers`.
- El adapter detecta el archivo (o `--exports FILE`) y genera `entry.js`:
  ```js
  export { default } from "./index.js";
  export * from "./index.js";
  export * from "./worker-exports.ts";
  ```
  y setea `main: "entry.js"`.
- Facets: usá `ctx.exports.FacetChild()` (handle registrado), no la clase local.
- Workflows: `this.env`; sin `schedules`.
- Dynamic Workers: `c.env.LOADER.load(...)`.
- Wasm: importá `./add.wasm`; el adapter copia los `.wasm` y celld los bundlea.
  Para apps Void, `no_bundle` queda en `false`.
- Containers: `container/Dockerfile` + `@cloudflare/containers`; el adapter
  copia `container/` y reescribe `image` al path del staging. Cada nodo que
  sirva la clase necesita Docker/Podman; son experimentales y para código
  propio (`enableInternet = false` en el ejemplo).

## Tests

```bash
cd celld-void
node --test
```

Cubren la traducción del config real de Void (`rules`, assets, D1,
workflows, migraciones, loaders), el rechazo de servicios no soportados y el
staging.

## Reglas

Ver `SKILL.md`. Lo esencial: wasm importado y bundleado (`no_bundle: false`),
workflows sin `schedules` (usar Cron), facets con `DurableObject` +
`ctx.exports.Class()`, containers con Docker/Podman, R2 bajo `app/`, un token R2
por flota, tenant por sesión/`tenant_id`.
