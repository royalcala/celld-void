import { defineAuth } from "void/auth";

const ITERATIONS = 100_000;

function toB64(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
}

function fromB64(value: string): Uint8Array {
  const raw = atob(value);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

async function pbkdf2(password: string, salt: Uint8Array, iterations: number): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt, iterations, hash: "SHA-256" },
    key,
    256,
  );
  return new Uint8Array(bits);
}

export default defineAuth(({ defaults }) => ({
  ...defaults,
  emailAndPassword: {
    ...defaults.emailAndPassword,
    enabled: true,
    password: {
      hash: async (password: string) => {
        const salt = crypto.getRandomValues(new Uint8Array(16));
        const derived = await pbkdf2(password, salt, ITERATIONS);
        return `pbkdf2:sha256:${ITERATIONS}:${toB64(salt)}:${toB64(derived)}`;
      },
      verify: async ({ password, hash }: { password: string; hash: string }) => {
        const [scheme, , iterS, saltB64, hashB64] = hash.split(":");
        if (scheme !== "pbkdf2" || !iterS || !saltB64 || !hashB64) return false;
        const derived = await pbkdf2(password, fromB64(saltB64), Number(iterS));
        const expected = fromB64(hashB64);
        if (derived.length !== expected.length) return false;
        let diff = 0;
        for (let i = 0; i < derived.length; i++) diff |= derived[i]! ^ expected[i]!;
        return diff === 0;
      },
    },
  },
}));
