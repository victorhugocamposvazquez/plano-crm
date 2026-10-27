"use client";
import { useEffect, useState, type ChangeEvent } from "react";
import { Upload, X } from "lucide-react";
import { Drawer } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { useWorkspace } from "@/components/workspace-provider";
import { cargarPresentacion, guardarPresentacion, validarPresentacion, presentacionVacia, type Presentacion } from "@/lib/presentacion";

const tipos = ["image/png", "image/svg+xml", "image/jpeg", "image/webp"];
const leer = (file: File) => new Promise<string>((resolve, reject) => { const r = new FileReader(); r.onload = () => resolve(String(r.result)); r.onerror = () => reject(new Error("No se ha podido leer el archivo.")); r.readAsDataURL(file); });

/** Logo del cliente, imagen y título de portada y carta de presentación de este presupuesto; se guardan al instante en el documento. */
export function PresentationDrawer({ open, onClose, budgetId, budgetTitle, value, onChange }: { open: boolean; onClose: () => void; budgetId: string; budgetTitle: string; value: Presentacion; onChange: (p: Presentacion) => void }) {
  const { notify } = useWorkspace();
  const [form, setForm] = useState<Presentacion>(value);
  useEffect(() => { if (open) setForm(value); }, [open, value]);
  const errores = validarPresentacion(form);
  const set = <K extends keyof Presentacion>(k: K, v: Presentacion[K]) => setForm(f => ({ ...f, [k]: v }));

  async function imagen(event: ChangeEvent<HTMLInputElement>, k: "client_logo_data_url" | "cover_image_data_url") {
    const file = event.target.files?.[0]; event.target.value = "";
    if (!file) return;
    if (!tipos.includes(file.type)) { notify("Usa PNG, SVG, JPG o WebP."); return; }
    if (file.size > (k === "client_logo_data_url" ? 300 * 1024 : 2 * 1024 * 1024)) { notify(k === "client_logo_data_url" ? "El logo debe pesar menos de 300 KB." : "La imagen debe pesar menos de 2 MB."); return; }
    try { set(k, await leer(file)); } catch (e) { notify(e instanceof Error ? e.message : "No se ha podido leer la imagen."); }
  }

  function aplicar() {
    if (errores.length) return;
    guardarPresentacion(budgetId, form); onChange(form); onClose();
    notify("Presentación guardada para este presupuesto");
  }

  return (
    <Drawer open={open} onClose={onClose} title="Presentación de este presupuesto" subtitle={`${budgetTitle} · logo del cliente, portada y carta`} footer={<><Button variant="ghost" onClick={() => setForm({ ...presentacionVacia })}>Quitar todo</Button><Button variant="secondary" onClick={onClose}>Cancelar</Button><Button variant="primary" onClick={aplicar} disabled={errores.length > 0}>Aplicar</Button></>}>
      <div className="form" style={{ maxWidth: "none" }}>
        <div className="field">
          <span>Logo del cliente <small className="muted">· sale en la portada y junto a sus datos</small></span>
          <div className="brand-logo-row">
            <div className="brand-logo-box">{form.client_logo_data_url ? <img src={form.client_logo_data_url} alt="Logo del cliente" style={{ maxHeight: 44, maxWidth: 160 }} /> : <span className="muted text-sm">Sin logo</span>}</div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <label className="btn btn-secondary" style={{ cursor: "pointer" }}><Upload size={16} strokeWidth={1.7} aria-hidden="true" />{form.client_logo_data_url ? "Cambiar" : "Subir logo"}<input type="file" accept={tipos.join(",")} onChange={e => imagen(e, "client_logo_data_url")} style={{ position: "absolute", width: 1, height: 1, opacity: 0 }} /></label>
              {form.client_logo_data_url && <Button variant="ghost" onClick={() => set("client_logo_data_url", "")}><X size={15} strokeWidth={1.8} aria-hidden="true" />Quitar</Button>}
            </div>
          </div>
        </div>
        <div className="field">
          <span>Imagen de portada <small className="muted">· sustituye a la de la empresa solo en este presupuesto</small></span>
          <div className="brand-logo-row">
            <div className="brand-cover-thumb" style={{ backgroundColor: "var(--pl-raised)", backgroundImage: form.cover_image_data_url ? `url(${form.cover_image_data_url})` : undefined }} aria-hidden="true" />
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <label className="btn btn-secondary" style={{ cursor: "pointer" }}><Upload size={16} strokeWidth={1.7} aria-hidden="true" />{form.cover_image_data_url ? "Cambiar imagen" : "Subir imagen"}<input type="file" accept="image/png,image/jpeg,image/webp" onChange={e => imagen(e, "cover_image_data_url")} style={{ position: "absolute", width: 1, height: 1, opacity: 0 }} /></label>
              {form.cover_image_data_url && <Button variant="ghost" onClick={() => set("cover_image_data_url", "")}><X size={15} strokeWidth={1.8} aria-hidden="true" />Quitar</Button>}
            </div>
          </div>
          <span className="muted text-xs">Una foto del propio piso o local, o un render de la propuesta, funciona muy bien. Menos de 2 MB.</span>
        </div>
        <label className="field"><span>Título de portada <small className="muted">· si se deja vacío, el nombre del presupuesto</small></span><input type="text" value={form.cover_title} onChange={e => set("cover_title", e.target.value)} placeholder={budgetTitle} maxLength={120} /></label>
        <label className="field"><span>Carta de presentación <small className="muted">· primera página, antes de las partidas</small></span><textarea rows={6} value={form.intro} onChange={e => set("intro", e.target.value)} placeholder="Gracias por contar con nosotros. Este presupuesto recoge la reforma completa del piso tal y como la hablamos en la visita del día 12…" maxLength={1200} style={{ minHeight: 120 }} /></label>
        {errores.length > 0 && <ul className="text-sm" role="alert" style={{ color: "var(--pl-danger)", paddingLeft: 18 }}>{errores.map(e => <li key={e}>{e}</li>)}</ul>}
        <p className="muted text-xs">Se guarda en este navegador para este presupuesto. Cuando el espacio compartido lo guarde, lo verá todo el equipo.</p>
      </div>
    </Drawer>
  );
}
