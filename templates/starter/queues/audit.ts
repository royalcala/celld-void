import { defineQueue } from "void";

interface Message {
  action: string;
  at: number;
}

export default defineQueue<Message>(async (batch, env) => {
  for (const msg of batch.messages) {
    await env.KV.put(`audit:${msg.id}`, JSON.stringify(msg.body));
    await env.KV.put("audit:last", JSON.stringify(msg.body));
    msg.ack();
  }
});
