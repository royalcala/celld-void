import { sql } from "void/db";
import { index, integer, sqliteTable, text } from "void/schema-d1";

export const item = sqliteTable(
  "item",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id").notNull(),
    title: text("title").notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .notNull(),
  },
  (table) => [index("item_tenant_idx").on(table.tenantId)],
);

export const idempotency = sqliteTable("idempotency", {
  id: text("id").primaryKey(),
  tenantId: text("tenant_id").notNull(),
  response: text("response").notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
    .notNull(),
});
