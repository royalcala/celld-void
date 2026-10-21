import { Form, useForm, useRouter } from "@void/react";
import { useFormStatus } from "react-dom";
import type { Props } from "./index.server";

function BotonCrear() {
  const { pending } = useFormStatus();
  return <button disabled={pending}>{pending ? "Guardando…" : "Agregar"}</button>;
}

const estilos = {
  main: { fontFamily: "system-ui, sans-serif", padding: 24, maxWidth: 720, margin: "0 auto" },
  input: { display: "block", width: "100%", padding: 8, marginTop: 4, marginBottom: 8 },
  error: { color: "#b00020", fontSize: 13 },
} as const;

export default function Items({ items }: Props) {
  const router = useRouter();
  const form = useForm("/items", { title: "" });

  async function borrar(id: string) {
    await fetch(`/api/items?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    router.visit("/items");
  }

  return (
    <main style={estilos.main}>
      <h1>Items ({items.length})</h1>
      <p style={{ color: "#666", fontSize: 13 }}>
        Filtrados por <code>tenant_id</code> de la sesión. El Host no autoriza.
      </p>

      <Form form={form}>
        <label>
          Título
          <input
            style={estilos.input}
            value={form.data.title}
            onChange={(e) => form.setData("title", e.target.value)}
          />
        </label>
        {form.errors.title && <span style={estilos.error}>{form.errors.title}</span>}
        <BotonCrear />
      </Form>

      <hr />

      {items.length === 0 ? (
        <p>Todavía no hay items.</p>
      ) : (
        <ul>
          {items.map((i) => (
            <li key={i.id}>
              {i.title}{" "}
              <button
                onClick={() => borrar(i.id)}
                style={{ marginLeft: 8, background: "none", border: "none", color: "#b00020", cursor: "pointer" }}
              >
                borrar
              </button>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
