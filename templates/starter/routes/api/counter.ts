import { defineHandler } from "void";
import { Counter } from "../../durable-objects/counter";

export const GET = defineHandler(async () => ({
  count: await Counter.get("global").read(),
}));

export const POST = defineHandler(async () => ({
  count: await Counter.get("global").increment(1),
}));
