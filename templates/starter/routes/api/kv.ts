import { defineHandler } from "void";
import { kv } from "void/kv";

export const GET = defineHandler(async () => ({
  value: await kv.get<{ at: number }>("probe"),
}));

export const POST = defineHandler(async () => {
  const at = Date.now();
  await kv.put("probe", { at });
  return { at };
});
