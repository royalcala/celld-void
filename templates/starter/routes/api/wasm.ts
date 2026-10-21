import { defineHandler } from "void";

export const GET = defineHandler(async (c) => {
  const env = c.env as any;
  const id = env.WASM_CELL.idFromName("probe");
  const response = await env.WASM_CELL.get(id).fetch("https://wasm/");
  return c.json(await response.json());
});
