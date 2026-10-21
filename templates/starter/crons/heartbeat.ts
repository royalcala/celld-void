import { defineScheduled } from "void";

export const cron = "* * * * *";

export default defineScheduled(async (controller, env) => {
  await env.KV.put("cron:last", controller.scheduledTime.toString());
});
