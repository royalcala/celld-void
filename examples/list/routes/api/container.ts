import { defineHandler } from "void";
import { getContainer } from "@cloudflare/containers";

export const GET = defineHandler(async (c) => {
  const name = c.req.query("name") ?? "probe";
  const env = c.env as any;
  const container = getContainer(env.CONTAINER, name);
  const response = await container.fetch("https://container/");
  return c.json(await response.json());
});
