import { defineHandler } from "void";
import type { InferProps } from "void";
import { asc, db, eq } from "void/db";
import { getUser } from "void/auth";
import { item } from "@schema";
import { crearItemSchema } from "../../src/item";

export const loader = defineHandler(async () => {
  const user = getUser();
  if (!user) return { items: [] };
  return {
    items: await db
      .select()
      .from(item)
      .where(eq(item.tenantId, user.id))
      .orderBy(asc(item.createdAt)),
  };
});

export const action = defineHandler.withValidator({ body: crearItemSchema })(
  async (_c, { body }) => {
    const user = getUser();
    if (!user) throw new Error("unauthenticated");
    await db.insert(item).values({
      id: crypto.randomUUID(),
      tenantId: user.id,
      title: body.title,
    });
  },
);

export type Props = InferProps<typeof loader>;
