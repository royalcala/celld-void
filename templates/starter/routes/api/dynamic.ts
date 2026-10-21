import { defineHandler } from "void";

export const GET = defineHandler(async (c) => {
  const value = c.req.query("value") ?? "hello";
  const env = c.env as any;
  const worker = env.LOADER.load({
    compatibilityDate: "2026-02-24",
    mainModule: "main.js",
    modules: {
      "main.js":
        'export default { async fetch(request) { const u = new URL(request.url); return new Response("dynamic:" + (u.searchParams.get("v") ?? "")); } };',
    },
  });
  const response = await worker
    .getEntrypoint()
    .fetch(`https://dynamic/?v=${encodeURIComponent(value)}`);
  return { status: response.status, body: await response.text() };
});
