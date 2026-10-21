import { defineHandler } from "void";

export const GET = defineHandler(async (c) => {
  const name = c.req.query("name") ?? "facet";
  const env = c.env as any;
  const id = env.FACET_PARENT.idFromName("parent");
  const response = await env.FACET_PARENT.get(id).fetch(
    `https://facet/?name=${encodeURIComponent(name)}`,
  );
  return c.json(await response.json());
});
