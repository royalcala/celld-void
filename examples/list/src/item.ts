import { z } from "zod";

export const crearItemSchema = z.object({
  title: z.string().trim().min(1, "El título es obligatorio").max(200),
});

export type CrearItem = z.infer<typeof crearItemSchema>;
