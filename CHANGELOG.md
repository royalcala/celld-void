# Changelog

## 0.1.1

- `celld-void setup`: sección idempotente en `AGENTS.md`, instalación de la
  skill por agente (`.agents/`, `.claude/`, `.commandcode/`) y placeholders
  (`worker-exports.ts`, `wasm/`, `wasm.d.ts`, `container/`,
  `app.manifest.json`, `scripts/check-local.sh`). `--yes` regenera contenido
  editado con backup. No agrega CI.
- `celld-void create <dir>`: `pnpm create void` + `setup`, sin GitHub Actions.
- Tests de setup (AGENTS.md, detección de agentes, skills, placeholders,
  `--yes`, no sobreescritura).
- `docs/LAB.md` con la suite local y el smoke manual.

## 0.1.0

- Initial public release.
- Void build translation: assets, D1, KV, R2, queues, cron, durable objects,
  facets, workflows, dynamic workers, wasm and containers.
- `celld-void` CLI with `--var`, `--exports`, migrations and container staging.
- Starter template, `examples/list` and the `celld-void` AI skill.
