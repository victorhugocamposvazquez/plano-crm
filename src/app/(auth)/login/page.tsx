"use client";
import { useState, type FormEvent } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Brand } from "@/components/ui/brand";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ui/theme-toggle";
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
      window.location.assign(typeof result.redirect === "string" ? result.redirect : "/proyectos");
    } catch {
      setError("Sin conexión con el servidor. Comprueba la red e inténtalo de nuevo.");
    } finally {
      setBusy(false);
    }
  }

  const fieldError = (name: string) => fields.find(f => f.path === name)?.message;

  return (
    <main className="auth-shell">
      {/* Banda de marca: papel de plano (retícula fina) sobre la superficie de zona. */}
      <aside className="auth-brand" aria-hidden="true">
        <Brand className="auth-logo" />
        <p className="auth-claim">Cada obra, bajo control.</p>
        <div className="auth-cota"><span /><small className="pl-mono">CRM de proyectos de obra y reforma</small><span /></div>
      </aside>

      <section className="auth-card">
        <div className="page-head"><h1 className="h1">Entrar.</h1><ThemeToggle /></div>

        {!configured ? (
          <div className="empty">
            <strong>Este entorno usa datos de demostración</strong>
            <span className="muted text-sm">No hay cuentas: lo que cambies se guarda solo en este navegador.</span>
            <Link href="/proyectos" className="btn btn-primary">Ir a los proyectos</Link>
          </div>
        ) : (
          <form onSubmit={submit} className="auth-form" noValidate>
            <label className="field">
              <span>Correo electrónico</span>
              <input type="email" name="email" value={email} onChange={e => setEmail(e.target.value)} autoComplete="username" inputMode="email" required autoFocus aria-invalid={Boolean(fieldError("email")) || undefined} aria-describedby={fieldError("email") ? "error-email" : undefined} />
              {fieldError("email") && <small id="error-email" className="warning">{fieldError("email")}</small>}
            </label>
            <label className="field">
              <span>Contraseña</span>
              <input type="password" name="password" value={password} onChange={e => setPassword(e.target.value)} autoComplete="current-password" required aria-invalid={Boolean(fieldError("password")) || undefined} aria-describedby={fieldError("password") ? "error-password" : undefined} />
              {fieldError("password") && <small id="error-password" className="warning">{fieldError("password")}</small>}
            </label>
            {error && <p role="alert" className="auth-error">{error}</p>}
            <Button type="submit" variant="primary" disabled={busy || !email || !password} className="auth-submit">{busy ? "Entrando…" : "Entrar"}{!busy && <ArrowRight size={17} strokeWidth={1.8} aria-hidden="true" />}</Button>
            <p className="muted text-xs">Acceso solo para cuentas dadas de alta por administración. Si no recuerdas la contraseña, pide que la restablezcan.</p>
          </form>
        )}
      </section>
    </main>
  );
}
