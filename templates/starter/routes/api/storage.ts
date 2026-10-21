import { defineHandler } from "void";
import { storage } from "void/storage";

const key = "app/list/probe.txt";

export const GET = defineHandler(async () => {
  const object = await storage.get(key);
  return { key, text: object ? await object.text() : null };
});

export const POST = defineHandler(async () => {
  const at = new Date().toISOString();
  await storage.put(key, at);
  return { key, at };
});
