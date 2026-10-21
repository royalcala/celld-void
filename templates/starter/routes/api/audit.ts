import { defineHandler } from "void";
import { queues } from "void/queues";

export const POST = defineHandler(async () => {
  await queues.audit.send({ action: "probe", at: Date.now() });
  return { ok: true };
});
