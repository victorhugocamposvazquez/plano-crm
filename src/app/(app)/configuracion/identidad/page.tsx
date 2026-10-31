"use client";
import { useEffect, useState, type ChangeEvent } from "react";
import Link from "next/link";
import { Palette, Upload, X, Check, ArrowUpRight } from "lucide-react";
import { useWorkspace } from "@/components/workspace-provider";
import { Button } from "@/components/ui/button";
import { useBranding } from "@/lib/use-branding";
import { brandingPorDefecto, paletaSugerida, normalizarHex, validarBranding, textoSobre, lineasLegales, type Branding } from "@/lib/branding";
import { DocBrand, estiloDocumento } from "@/components/documents/budget-document";

const tiposLogo = ["image/png", "image/svg+xml", "image/jpeg", "image/webp"];

function leerComoDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => { const r = new FileReader(); r.onload = () => resolve(String(r.result)); r.onerror = () => reject(new Error("No se ha podido leer el archivo.")); r.readAsDataURL(file); });
}

/**
 * Identidad de la empresa: lo que ve el cliente en presupuestos y demás documentos.
 * Plano es SaaS: cada organización trae su logo, colores, portada y datos legales; GARAL es la primera.
 */
export default function IdentidadPage() {
  const { data, actor, notify } = useWorkspace();
  const [guardado, guardar, ready] = useBranding();
  const [form, setForm] = useState<Branding>(guardado);
  const [hex, setHex] = useState({ primary: guardado.primary_color, accent: guardado.accent_color });
  const puedeEditar = actor.role === "admin" || actor.role === "office";
  useEffect(() => { if (ready) { setForm(guardado); setHex({ primary: guardado.primary_color, accent: guardado.accent_color }); } }, [ready, guardado]);

  const errores = validarBranding(form);
  const dirty = JSON.stringify(form) !== JSON.stringify(guardado);
  const set = <K extends keyof Branding>(k: K, v: Branding[K]) => setForm(f => ({ ...f, [k]: v }));
  function color(k: "primary_color" | "accent_color", value: string) {
    setHex(h => ({ ...h, [k === "primary_color" ? "primary" : "accent"]: value }));
    const n = normalizarHex(value); if (n) set(k, n);
  }

  async function cargarImagen(event: ChangeEvent<HTMLInputElement>, k: "logo_data_url" | "cover_image_data_url") {
    const file = event.target.files?.[0]; event.target.value = "";
    if (!file) return;
    if (!tiposLogo.includes(file.type)) { notify("Usa PNG, SVG, JPG o WebP."); return; }
    const max = k === "logo_data_url" ? 300 * 1024 : 2 * 1024 * 1024;
    if (file.size > max) { notify(k === "logo_data_url" ? "El logo debe pesar menos de 300 KB." : "La portada debe pesar menos de 2 MB."); return; }
    try { set(k, await leerComoDataUrl(file)); } catch (e) { notify(e instanceof Error ? e.message : "No se ha podido leer la imagen."); }
  }

  function guardarTodo() {
    if (errores.length || !puedeEditar) return;
    guardar(form);
    notify("Identidad guardada · se aplica a los documentos nuevos y a los ya emitidos");
  }

  return (
    <div className="page">
      <div>
        <div className="page-head">
          <h1 className="pl-title">Identidad de la empresa</h1>
          {puedeEditar && <Button variant="primary" className="btn-new" onClick={guardarTodo} disabled={!dirty || errores.length > 0}><Check size={17} strokeWidth={1.8} aria-hidden="true" />Guardar</Button>}
        </div>
        <p className="subtitle">Logo, colores, portada y datos legales que salen en los presupuestos y documentos de {data.organization_name || "tu empresa"}. {puedeEditar ? "" : "Tu perfil puede consultarla; la edita oficina o administración."}</p>
      </div>

      <div className="detail brand-layout">
        <div className="form" style={{ maxWidth: "none" }}>
          <fieldset className="brand-section" disabled={!puedeEditar}>
            <legend>Empresa</legend>
            <label className="field"><span>Nombre comercial <small className="muted">· encabeza los documentos</small></span><input type="text" value={form.trade_name} onChange={e => set("trade_name", e.target.value)} placeholder="GARAL Reformas" maxLength={120} /></label>
            <div className="line-grid">
              <label className="field"><span>Razón social</span><input type="text" value={form.legal_name} onChange={e => set("legal_name", e.target.value)} placeholder="Garal Reformas, S.L." maxLength={200} /></label>
              <label className="field"><span>CIF / NIF</span><input type="text" value={form.tax_id} onChange={e => set("tax_id", e.target.value)} placeholder="B15000000" maxLength={20} /></label>
            </div>
            <label className="field"><span>Dirección fiscal</span><input type="text" value={form.address} onChange={e => set("address", e.target.value)} placeholder="Rúa Real 1, 15001 A Coruña" maxLength={300} /></label>
            <div className="line-grid">
              <label className="field"><span>Teléfono</span><input type="tel" value={form.phone} onChange={e => set("phone", e.target.value)} placeholder="981 000 000" maxLength={40} /></label>
              <label className="field"><span>Correo</span><input type="email" value={form.email} onChange={e => set("email", e.target.value)} placeholder="obras@garal.es" maxLength={120} /></label>
              <label className="field"><span>Web</span><input type="text" value={form.website} onChange={e => set("website", e.target.value)} placeholder="garal.es" maxLength={120} /></label>
            </div>
          </fieldset>

          <fieldset className="brand-section" disabled={!puedeEditar}>
            <legend>Logo</legend>
            <div className="brand-logo-row">
              <div className="brand-logo-box" style={estiloDocumento(form)}><DocBrand branding={form} /></div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <label className="btn btn-secondary" style={{ cursor: "pointer" }}><Upload size={16} strokeWidth={1.7} aria-hidden="true" />{form.logo_data_url ? "Cambiar logo" : "Subir logo"}<input type="file" accept={tiposLogo.join(",")} onChange={e => cargarImagen(e, "logo_data_url")} style={{ position: "absolute", width: 1, height: 1, opacity: 0 }} /></label>
                {form.logo_data_url && <Button variant="ghost" onClick={() => set("logo_data_url", "")}><X size={15} strokeWidth={1.8} aria-hidden="true" />Quitar</Button>}
              </div>
            </div>
            <p className="muted text-xs">PNG o SVG con fondo transparente, menos de 300 KB. Sin logo, el nombre comercial hace de marca.</p>
          </fieldset>

          <fieldset className="brand-section" disabled={!puedeEditar}>
            <legend>Colores</legend>
            <div className="line-grid">
              {(["primary_color", "accent_color"] as const).map(k => (
                <div key={k} className="field">
                  <span>{k === "primary_color" ? "Principal · cabeceras y filetes" : "Acento · detalles"}</span>
                  <div className="swatches">
                    {paletaSugerida.map(c => <button key={c} type="button" className="swatch" style={{ background: c, color: textoSobre(c) }} aria-label={c} aria-pressed={form[k] === c} onClick={() => color(k, c)}>{form[k] === c ? <Check size={14} strokeWidth={2.4} aria-hidden="true" /> : null}</button>)}
                    <label className="swatch swatch-custom" style={{ background: form[k], color: textoSobre(form[k]) }} title="Elegir otro color"><input type="color" value={form[k]} onChange={e => color(k, e.target.value)} aria-label="Elegir otro color" />+</label>
                  </div>
                  <span className="unit-input" style={{ maxWidth: 160 }}><input type="text" value={k === "primary_color" ? hex.primary : hex.accent} onChange={e => color(k, e.target.value)} aria-label={`${k === "primary_color" ? "Color principal" : "Color de acento"} en hex`} maxLength={7} className="pl-mono" /><span>hex</span></span>
                </div>
              ))}
            </div>
          </fieldset>

          <fieldset className="brand-section" disabled={!puedeEditar}>
            <legend>Portada de los presupuestos</legend>
            <label className="check-row"><input type="checkbox" checked={form.cover_enabled} onChange={e => set("cover_enabled", e.target.checked)} /><span>Añadir portada por defecto</span><small className="muted">· se puede quitar en cada impresión</small></label>
            <label className="field"><span>Frase de portada</span><input type="text" value={form.cover_claim} onChange={e => set("cover_claim", e.target.value)} placeholder="Reformas que se entregan a tiempo." maxLength={120} /></label>
            <div className="brand-logo-row">
              <div className="brand-cover-thumb" style={{ ...estiloDocumento(form), backgroundImage: form.cover_image_data_url ? `url(${form.cover_image_data_url})` : undefined }} aria-hidden="true" />
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <label className="btn btn-secondary" style={{ cursor: "pointer" }}><Upload size={16} strokeWidth={1.7} aria-hidden="true" />{form.cover_image_data_url ? "Cambiar imagen" : "Imagen de fondo"}<input type="file" accept="image/png,image/jpeg,image/webp" onChange={e => cargarImagen(e, "cover_image_data_url")} style={{ position: "absolute", width: 1, height: 1, opacity: 0 }} /></label>
                {form.cover_image_data_url && <Button variant="ghost" onClick={() => set("cover_image_data_url", "")}><X size={15} strokeWidth={1.8} aria-hidden="true" />Quitar</Button>}
              </div>
            </div>
            <p className="muted text-xs">Sin imagen, la portada usa el color principal. Una foto de obra terminada funciona bien; menos de 2 MB.</p>
          </fieldset>

          <fieldset className="brand-section" disabled={!puedeEditar}>
            <legend>Textos fijos</legend>
            <label className="field"><span>Condiciones generales <small className="muted">· van en todos los presupuestos</small></span><textarea rows={4} value={form.default_terms} onChange={e => set("default_terms", e.target.value)} maxLength={3000} style={{ minHeight: 96 }} /></label>
            <label className="field"><span>Línea del pie <small className="muted">· registro mercantil, seguro, licencia…</small></span><input type="text" value={form.footer_note} onChange={e => set("footer_note", e.target.value)} placeholder="Inscrita en el Registro Mercantil de A Coruña · Seguro RC nº 000" maxLength={300} /></label>
          </fieldset>

          {errores.length > 0 && <ul className="text-sm" role="alert" style={{ color: "var(--pl-danger)", paddingLeft: 18 }}>{errores.map(e => <li key={e}>{e}</li>)}</ul>}
          {puedeEditar && (
            <div className="form-actions">
              <Button variant="ghost" onClick={() => { setForm({ ...brandingPorDefecto, trade_name: data.organization_name }); setHex({ primary: brandingPorDefecto.primary_color, accent: brandingPorDefecto.accent_color }); }}>Restablecer</Button>
              <Button variant="primary" onClick={guardarTodo} disabled={!dirty || errores.length > 0}>Guardar identidad</Button>
            </div>
          )}
        </div>

        <aside className="zone brand-preview">
          <div className="section-label" style={{ marginTop: 0 }}><span><Palette size={13} strokeWidth={1.8} aria-hidden="true" /> Así se verá</span><Link href="/presupuestos" className="muted text-xs" style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>Abrir un presupuesto<ArrowUpRight size={12} strokeWidth={1.8} aria-hidden="true" /></Link></div>
          <div className="brand-sheet" style={estiloDocumento(form)}>
            <div className="brand-sheet-head">
              <div><DocBrand branding={form} />{(form.phone || form.email) && <small>{[form.phone, form.email].filter(Boolean).join(" · ")}</small>}</div>
              <span className="pl-mono">PL-001 · V2</span>
            </div>
            <strong className="brand-sheet-title">Presupuesto de reforma</strong>
            <div className="brand-sheet-chapter"><span>Demoliciones</span><span className="pl-mono">1352,40 €</span></div>
            <div className="brand-sheet-row"><span>Demolición de tabiquería interior</span><span className="pl-mono">1352,40 €</span></div>
            <div className="brand-sheet-row"><span>Retirada de escombros</span><span className="pl-mono">480,00 €</span></div>
            <div className="brand-sheet-total"><span>Total</span><span className="pl-mono">2217,20 €</span></div>
            <div className="brand-sheet-foot">{lineasLegales(form)[0] || "Razón social · CIF · dirección"}</div>
          </div>
          {form.cover_enabled && (
            <div className="brand-sheet brand-sheet-cover" style={{ ...estiloDocumento(form), backgroundImage: form.cover_image_data_url ? `url(${form.cover_image_data_url})` : undefined }}>
              <DocBrand branding={form} />
              <div><strong>Presupuesto de reforma</strong><span>Cliente de ejemplo</span></div>
              <small>{form.cover_claim}</small>
            </div>
          )}
          <p className="muted text-xs">Hoy la identidad se guarda en este navegador por organización. Cuando el espacio compartido la guarde, la verá todo el equipo.</p>
        </aside>
      </div>
    </div>
  );
}
