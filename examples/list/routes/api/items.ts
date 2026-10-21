import { defineHandler } from "void";
import { and, asc, db, eq } from "void/db";
import { getUser } from "void/auth";
import { item, idempotency } from "@schema";
import { crearItemSchema } from "../../src/item";

export const GET = defineHandler(async (c) => {
  const user = getUser();
  if (!user) return c.json({ error: "unauthorized" }, 401);
  const items = await db
    .select()
    .from(item)
    .where(eq(item.tenantId, user.id))
    .orderBy(asc(item.createdAt));
  return { items };
});

export const POST = defineHandler.withValidator({ body: crearItemSchema })(
  async (c, { body }) => {
    const user = getUser();
    if (!user) return c.json({ error: "unauthorized" }, 401);

    const key = c.req.header("idempotency-key");
    const idemId = key ? `${user.id}:${key}` : null;
    if (idemId) {
      const [existing] = await db
        .select()
        .from(idempotency)
        .where(eq(idempotency.id, idemId))
        .limit(1);
      if (existing) {
        return c.json(JSON.parse(existing.response), 200);
      }
    }

    const row = {
      id: crypto.randomUUID(),
      tenantId: user.id,
      title: body.title,
    };
    await db.insert(item).values(row);
    const response = { ok: true, item: row };
    if (idemId) {
      await db.insert(idempotency).values({
        id: idemId,
        tenantId: user.id,
        response: JSON.stringify(response),
      });
    }
    return response;
  },
);

export const DELETE = defineHandler(async (c) => {
  const user = getUser();
  if (!user) return c.json({ error: "unauthorized" }, 401);
  const id = c.req.query("id");
  if (!id) return c.json({ error: "missing id" }, 400);
  await db
    .delete(item)
    .where(and(eq(item.id, id), eq(item.tenantId, user.id)));
  return { ok: true };
});
