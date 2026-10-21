import { DurableObject, WorkflowEntrypoint } from "cloudflare:workers";
import { Container } from "@cloudflare/containers";
import addModule from "./add.wasm";

export class ListContainer extends Container {
  defaultPort = 8080;
  sleepAfter = "2m";
  enableInternet = false;
  envVars = { MESSAGE: "list container" };
}

export class WasmCell extends DurableObject {
  async fetch(): Promise<Response> {
    const instance = new WebAssembly.Instance(addModule as any);
    return Response.json({ add: (instance.exports as any).add(2, 3) });
  }
}

export class FacetParent extends DurableObject {
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const name = url.searchParams.get("name") ?? "facet";
    const facet = (this.ctx as any).facets.get(name, () => ({
      class: (this.ctx as any).exports.FacetChild(),
    }));
    const count = await facet.inc();
    return Response.json({ name, count });
  }
}

export class FacetChild extends DurableObject {
  async inc(): Promise<number> {
    const current = ((await this.ctx.storage.get<number>("count")) ?? 0) + 1;
    await this.ctx.storage.put("count", current);
    return current;
  }
}

export class ListWorkflow extends WorkflowEntrypoint {
  async run(event: any, step: any): Promise<{ ok: boolean; id: string }> {
    const id = event?.payload?.id ?? event?.id ?? "anon";
    const env = (this as any).env;
    await step.do("first", async () => {
      await env.KV.put(`wf:${id}:first`, "ok");
    });
    await step.do("second", async () => {
      await env.KV.put(`wf:${id}:second`, "ok");
    });
    return { ok: true, id };
  }
}
