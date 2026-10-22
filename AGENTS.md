# AGENTS — celld-void

Este repo es **celld-void**, la herramienta/adapter. No es una app de producto.
Si sos una sesión nueva, leé esto antes de actuar.

## Mapa del ecosistema

- `1us-v4` — plataforma: infra, flotas, Tailscale, R2, secrets, docs.
- `celld` — runtime (DO/Workers, SQLite, hibernación).
- `celld-os` — OS/Workshop portado a celld; gatekeepers/gadgets.
- `1us-contracts` — app de contratos; manager en este repo.
- `1us-databases` — app de DBs por tenant; manager en este repo.

## Roles

- Manager de contracts: `docs/agents/contracts-manager.md`
- Manager de databases: `docs/agents/databases-manager.md`
- Los agentes de producto viven en el repo de su app, no acá.

## Reglas

- No tocar `1us-v4/infra`, `1us-secrets` ni flotas desde este repo.
- Un manager por producto; no mezclar contracts y databases.
- Cambios al paquete: branch/PR y coordinación con el manager actual.
- Skill del paquete: `skills/celld-void/SKILL.md`.
- Docs: `docs/MAPPING.md`, `docs/LAB.md`, `README.md`.
- Apps consumen `celld-void` como dependencia publicada, no como submódulo.
- Sin código de tenant en la flota compartida.

## Comandos

- Tests del paquete: `npm test`
- Instalar/actualizar en apps: `pnpm add -D celld-void@^0.1.1`
- Setup en app: `pnpm exec celld-void setup --yes`
- Deploy de app: `pnpm exec celld-void deploy ...`

## Arranque de sesión

Abrí con mensaje inicial, por ejemplo:

```bash
npx cmd -n databases-manager --yolo "Leé AGENTS.md y docs/agents/databases-manager.md. Sos el manager de 1us-databases; no toques contracts ni infra."
```
