import { defineHandler } from "void";

export const POST = defineHandler(async (c) => {
  const id = c.req.query("id") ?? `wf-${Date.now()}`;
  const env = c.env as any;
  await env.WF.create({ id, params: { id } });
  return { ok: true, id };
});

export const GET = defineHandler(async (c) => {
  const id = c.req.query("id");
  if (!id) return c.json({ error: "missing id" }, 400);
  const env = c.env as any;
  const instance = await env.WF.get(id);
  return {
    id,
    status: await instance.status(),
    kv: {
      first: await env.KV.get(`wf:${id}:first`),
      second: await env.KV.get(`wf:${id}:second`),
    },
  };
});
