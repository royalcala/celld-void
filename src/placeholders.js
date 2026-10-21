export function buildWorkerExports() {
  return `import { DurableObject, WorkflowEntrypoint } from "cloudflare:workers";

// Workflows, facets and containers are not native to Void. Classes exported
// here are re-exported by the entry wrapper that celld-void generates on deploy.
export class AppWorkflow extends WorkflowEntrypoint {
  async run(event: any, step: any): Promise<{ ok: true }> {
    await step.do("noop", async () => {});
    return { ok: true };
  }
}

export class FacetParent extends DurableObject {
  async fetch(request: Request): Promise<Response> {
    const name = new URL(request.url).searchParams.get("name") ?? "facet";
    const facet = (this.ctx as any).facets.get(name, () => ({
      class: (this.ctx as any).exports.FacetChild(),
    }));
    return Response.json({ name, count: await facet.inc() });
  }
}

export class FacetChild extends DurableObject {
  async inc(): Promise<number> {
    const next = ((await this.ctx.storage.get<number>("count")) ?? 0) + 1;
    await this.ctx.storage.put("count", next);
    return next;
  }
}

// Containers: install @cloudflare/containers, add container/Dockerfile, then
// export a class from this file:
//
// import { Container } from "@cloudflare/containers";
//
// export class AppContainer extends Container {
//   defaultPort = 8080;
//   sleepAfter = "2m";
//   enableInternet = false;
// }
`;
}

export function buildWasmReadme() {
  return `# wasm

Put your \`.wasm\` modules here and import them from \`worker-exports.ts\`:

\`\`\`ts
import addModule from "../wasm/add.wasm";
\`\`\`

For Void apps celld-void keeps \`no_bundle: false\`, so the imported module is
bundled by esbuild and uploaded next to the entry. Do not add ESModule
\`rules\`: celld rejects them.

Files at the project root ending in \`.wasm\` are staged too.
`;
}

export function buildWasmTypes() {
  return `declare module "*.wasm" {
  const module: WebAssembly.Module;
  export default module;
}
`;
}

export function buildContainerReadme() {
  return `# container

Containers are for our own trusted code only, never tenant code.

To enable one:

1. Install \`@cloudflare/containers\`.
2. Add \`container/Dockerfile\` (and the server code it copies).
3. Export a class extending \`Container\` from \`worker-exports.ts\`.
4. Declare the class in \`void.config.ts\` under \`cloudflare.containers\` and
   \`cloudflare.durable_objects.bindings\`.

Every node that serves the class needs Docker or Podman. Containers are
experimental in celld; keep \`enableInternet = false\` unless you know why you
need it.
`;
}

export function buildManifest(appId) {
  return `${JSON.stringify(
    {
      id: appId,
      capabilities: [],
      events: [],
      gatekeepers: [],
      blueprints: [],
    },
    null,
    2,
  )}\n`;
}

export function buildCheckScript() {
  return `#!/bin/sh
set -eu

cd "$(dirname "$0")/.."

[ -f package.json ] || {
  echo "check-local: package.json not found" >&2
  exit 1
}

has_script() {
  node -e "const fs=require('fs');const p=JSON.parse(fs.readFileSync('package.json','utf8'));process.exit(p.scripts&&p.scripts['$1']?0:1)"
}

if command -v pnpm >/dev/null 2>&1; then
  PM=pnpm
elif command -v npm >/dev/null 2>&1; then
  PM=npm
else
  echo "check-local: pnpm or npm required" >&2
  exit 1
fi

for script in typecheck test build; do
  if has_script "$script"; then
    echo "==> $PM run $script"
    "$PM" run "$script"
  fi
done
`;
}
