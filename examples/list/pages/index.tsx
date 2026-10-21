import type { Props } from "./index.server";

export default function Home({ email }: Props) {
  return (
    <main style={{ fontFamily: "system-ui, sans-serif", padding: 24, maxWidth: 640, margin: "0 auto" }}>
      <h1>List</h1>
      <p>Template mínimo: auth + D1 + tenant + idempotencia.</p>
      {email ? (
        <p>
          Sesión: <strong>{email}</strong> · <a href="/items">Ir a la lista</a>
        </p>
      ) : (
        <p>
          <a href="/login">Entrar</a> para ver tu lista.
        </p>
      )}
      <p style={{ color: "#666", fontSize: 13 }}>
        Cada usuario es un tenant (<code>tenant_id = user.id</code>). Los items
        nunca se cruzan entre sesiones.
      </p>
    </main>
  );
}
