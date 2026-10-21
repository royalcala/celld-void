import { defineHandler } from "void";
import { kv } from "void/kv";

export const GET = defineHandler(async () => ({
  last: await kv.get<{ action: string; at: number }>("audit:last"),
}));
