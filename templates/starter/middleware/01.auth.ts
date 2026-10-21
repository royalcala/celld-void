import { defineMiddleware } from "void";
import { getUser } from "void/auth";

export default defineMiddleware(async (c, next) => {
  const { pathname } = new URL(c.req.url);
  const protegida = pathname === "/items" || pathname.startsWith("/items/");
  if (protegida && !getUser()) {
    return c.redirect("/login");
  }
  await next();
});
