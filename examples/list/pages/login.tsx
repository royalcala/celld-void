import { useState } from "react";
import { auth } from "void/client";

const input = { display: "block", width: "100%", padding: 8, marginTop: 4, marginBottom: 12 } as const;

export default function Login() {
  const [modo, setModo] = useState<"entrar" | "registrar">("entrar");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setEnviando(true);
    try {
      if (modo === "entrar") {
        await auth.signIn.email({ email, password });
      } else {
        await auth.signUp.email({ email, password, name: email });
      }
      window.location.href = "/items";
    } catch {
      setError("No se pudo autenticar. Revisá los datos.");
      setEnviando(false);
    }
  }

  return (
    <main style={{ fontFamily: "system-ui, sans-serif", padding: 24, maxWidth: 380, margin: "10vh auto" }}>
      <h1>{modo === "entrar" ? "Entrar" : "Crear cuenta"}</h1>
      <form onSubmit={enviar}>
        <label>
          Email
          <input style={input} type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </label>
        <label>
          Contraseña
          <input style={input} type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} />
        </label>
        {error && <p style={{ color: "#b00020" }}>{error}</p>}
        <button disabled={enviando}>{enviando ? "…" : modo === "entrar" ? "Entrar" : "Registrarme"}</button>
      </form>
      <p style={{ marginTop: 16 }}>
        <button onClick={() => setModo(modo === "entrar" ? "registrar" : "entrar")} style={{ background: "none", border: "none", color: "#06c", cursor: "pointer", padding: 0 }}>
          {modo === "entrar" ? "Crear una cuenta" : "Ya tengo cuenta"}
        </button>
      </p>
    </main>
  );
}
