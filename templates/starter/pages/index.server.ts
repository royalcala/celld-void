import { defineHandler } from "void";
import type { InferProps } from "void";
import { getUser } from "void/auth";

export const loader = defineHandler(() => ({
  email: getUser()?.email ?? null,
}));

export type Props = InferProps<typeof loader>;
