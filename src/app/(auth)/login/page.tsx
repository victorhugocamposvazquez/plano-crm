"use client";
import { useState, type FormEvent } from "react";
import Link from "next/link";
import { Brand } from "@/components/ui/brand";
import { Button } from "@/components/ui/button";
import { supabaseConfigured } from "@/lib/supabase/browser";

type Field = { path: string; message: string };

export default function LoginPage() {
  const configured = supabaseConfigured();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [fields, setFields] = useState<Field[]>([]);
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true); setError(""); setFields([]);
    try {
      // Contrato de Codex (docs/backend.md): POST /api/auth/sign-in { email, password } → { ok, redirect } o { error, fields? }.
      const response = await fetch("/api/auth/sign-in", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: email.trim(), password }) });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) { setError(result.error || "No se ha podido iniciar sesión."); setFields(Array.isArray(result.fields) ? result.fields : []); return; }
      // Navegación completa para que las cookies de sesión lleguen al proveedor del espacio.
      window.location.assign(typeof result.redirect === "string" ? result.redirect : "/obras");
    } catch {
      setError("Sin conexión con el servidor. Comprueba la red e inténtalo de nuevo.");
    } finally {
      setBusy(false);
    }
  }

  const fieldError = (name: string) => fields.find(f => f.path === name)?.message;

  return (
    <main className="auth-card">
      <Brand />
      <div>
        <h1 className="h1">Entrar.</h1>
        <p className="subtitle">Obras, presupuestos y documentos de tu empresa, en un solo sitio.</p>
      </div>

      {!configured ? (
        <div className="empty">
          <strong>Este entorno usa datos de demostración</strong>
          <span className="muted text-sm">No hay cuentas: los cambios se guardan solo en este navegador. Para trabajar con datos reales hay que configurar Supabase (ver <code>docs/despliegue.md</code>).</span>
          <Link href="/obras" className="btn btn-primary">Ir a las obras</Link>
        </div>
      ) : (
        <form onSubmit={submit} className="auth-form" noValidate>
          <label className="field">
            <span>Correo electrónico</span>
            <input type="email" name="email" value={email} onChange={e => setEmail(e.target.value)} autoComplete="username" inputMode="email" required aria-invalid={Boolean(fieldError("email")) || undefined} aria-describedby={fieldError("email") ? "error-email" : undefined} />
            {fieldError("email") && <small id="error-email" className="warning">{fieldError("email")}</small>}
          </label>
          <label className="field">
            <span>Contraseña</span>
            <input type="password" name="password" value={password} onChange={e => setPassword(e.target.value)} autoComplete="current-password" required aria-invalid={Boolean(fieldError("password")) || undefined} aria-describedby={fieldError("password") ? "error-password" : undefined} />
            {fieldError("password") && <small id="error-password" className="warning">{fieldError("password")}</small>}
          </label>
          {error && <p role="alert" className="auth-error">{error}</p>}
          <Button type="submit" variant="primary" disabled={busy || !email || !password}>{busy ? "Entrando…" : "Entrar"}</Button>
          <p className="muted text-xs">Solo pueden entrar las cuentas dadas de alta por administración. Si no recuerdas la contraseña, pide a administración que la restablezca.</p>
        </form>
      )}
    </main>
  );
}
