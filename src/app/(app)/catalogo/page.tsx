"use client";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useQueryState } from "@/lib/use-query-state";
import { Search, X, Plus, BookOpen } from "lucide-react";
import { useWorkspace } from "@/components/workspace-provider";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { can, money } from "@/lib/domain";
import { unidades, unidadNombres, eurosACentimos, codigoSugerido, buscarArticulos, agruparPorCapitulo, capitulos, type Unidad } from "@/lib/catalogo";

export default function CatalogoPage() {
  const { data, actor, busy, loading, send, notify } = useWorkspace();
  const allowed = can(actor.role, "article.create");
  const [queryParam, setQueryParam] = useQueryState<string>("q", "");
  const [query, setQuery] = useState(queryParam);
  useEffect(() => { const t = setTimeout(() => { if (query !== queryParam) setQueryParam(query); }, 300); return () => clearTimeout(t); }, [query, queryParam, setQueryParam]);
  const [adding, setAdding] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({ chapter: "", name: "", code: "", unit: "m²" as Unidad, price: "", vat: "21" });

  const chapters = useMemo(() => capitulos(data.articles), [data.articles]);
  const found = useMemo(() => buscarArticulos(data.articles, query), [data.articles, query]);
  const groups = useMemo(() => agruparPorCapitulo(found), [found]);
  const cents = eurosACentimos(form.price);
  const suggested = form.chapter.trim() ? codigoSugerido(form.chapter.trim(), data.articles) : "";

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (saving || busy) return;
    if (cents === null) { setError("Escribe el precio en euros, por ejemplo 49,50."); return; }
    setSaving(true); setError("");
    try {
      await send({ type: "article.create", code: (form.code.trim() || suggested).toUpperCase(), name: form.name.trim(), chapter: form.chapter.trim(), unit: form.unit, unit_price: cents, vat_rate: Number(form.vat) });
      notify(`Artículo añadido: ${form.name.trim()}`);
      setForm({ chapter: form.chapter, name: "", code: "", unit: form.unit, price: "", vat: form.vat });
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se ha podido guardar el artículo.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="page">
      <div>
        <div className="eyebrow"><BookOpen size={13} strokeWidth={1.8} aria-hidden="true" /><span>{data.organization_name || "Espacio de trabajo"}</span></div>
        <div className="page-head">
          <h1 className="h1">Catálogo de precios.</h1>
          {allowed && <Button variant={adding ? "secondary" : "primary"} className="btn-new" aria-expanded={adding} onClick={() => setAdding(v => !v)}>{adding ? <X size={17} strokeWidth={1.8} aria-hidden="true" /> : <Plus size={17} strokeWidth={1.8} aria-hidden="true" />}{adding ? "Cerrar" : "Nuevo artículo"}</Button>}
        </div>
        <p className="subtitle">{loading ? "Cargando el catálogo…" : `${data.articles.length} artículos en ${chapters.length} capítulos · precios sin IVA que alimentan estimaciones y presupuestos`}</p>
      </div>

      {adding && allowed && (
        <form className="form line" onSubmit={submit} style={{ maxWidth: "none" }}>
          <div className="line-grid">
            <label className="field"><span>Capítulo</span><input list="capitulos" type="text" value={form.chapter} onChange={e => setForm({ ...form, chapter: e.target.value })} placeholder="Pintura, Fontanería…" required maxLength={120} /><datalist id="capitulos">{chapters.map(c => <option key={c} value={c} />)}</datalist></label>
            <label className="field"><span>Código</span><input type="text" value={form.code} onChange={e => setForm({ ...form, code: e.target.value })} placeholder={suggested || "PIN-001"} maxLength={40} /></label>
          </div>
          <label className="field"><span>Descripción del artículo</span><input type="text" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Preparación y pintura plástica lisa de paramentos" required maxLength={500} /></label>
          <div className="line-grid">
            <div className="field"><span>Unidad</span><Select label="Unidad" value={form.unit} onChange={u => setForm({ ...form, unit: u })} options={unidades.map(u => ({ value: u, label: unidadNombres[u] }))} /></div>
            <label className="field"><span>Precio sin IVA</span><span className="unit-input"><input type="text" inputMode="decimal" value={form.price} onChange={e => setForm({ ...form, price: e.target.value })} placeholder="49,50" required aria-invalid={form.price !== "" && cents === null ? true : undefined} /><span>€ / {form.unit}</span></span></label>
            <div className="field"><span>IVA</span><Select label="IVA" value={form.vat} onChange={v => setForm({ ...form, vat: v })} options={[{ value: "21", label: "21 %" }, { value: "10", label: "10 %", hint: "Vivienda con requisitos" }, { value: "0", label: "0 %" }]} /></div>
          </div>
          {error && <p role="alert" className="auth-error">{error}</p>}
          <div className="form-actions">
            <span className="muted text-xs" style={{ alignSelf: "center" }}>Los precios copiados a un presupuesto no cambian al editar el catálogo.</span>
            <Button type="submit" variant="primary" disabled={saving || busy || !form.name.trim() || !form.chapter.trim() || cents === null}>{saving ? "Guardando…" : `Añadir artículo${cents !== null ? ` · ${money(cents)}` : ""}`}</Button>
          </div>
        </form>
      )}

      <label className="search">
        <Search size={16} strokeWidth={1.8} aria-hidden="true" />
        <input type="search" className="search-input" value={query} onChange={e => setQuery(e.target.value)} placeholder="Buscar por código, descripción o capítulo…" aria-label="Buscar artículos" autoComplete="off" />
        {query && <button type="button" className="search-clear" aria-label="Borrar búsqueda" onClick={() => setQuery("")}><X size={15} strokeWidth={1.8} aria-hidden="true" /></button>}
      </label>

      {!loading && found.length === 0 && <div className="empty"><strong>{query ? `Nada coincide con «${query}»` : "El catálogo está vacío"}</strong><span className="muted text-sm">{query ? "Prueba con parte de la descripción o el capítulo." : "Añade los artículos con sus precios para poder estimar y presupuestar."}</span></div>}

      {[...groups.entries()].map(([chapter, list]) => (
        <div key={chapter}>
          <div className="section-label"><span>{chapter}</span><span className="pl-mono">{list.length}</span></div>
          <div style={{ borderTop: "var(--pl-hairline) solid var(--pl-line)" }}>
            {list.map(article => (
              <div key={article.id} className="row-item" style={{ gridTemplateColumns: "minmax(0, 1fr) auto" }}>
                <span style={{ minWidth: 0 }}><strong>{article.name}</strong><small><span className="pl-mono">{article.code}</span> · {article.unit} · IVA {article.vat_rate} %</small></span>
                <span className="pl-mono" style={{ textAlign: "right" }}>{money(article.unit_price)}<small className="muted" style={{ display: "block", fontSize: "var(--pl-text-xs)" }}>por {article.unit}</small></span>
              </div>
            ))}
          </div>
        </div>
      ))}

      {!allowed && <p className="muted text-xs">Tu perfil puede consultar el catálogo pero no modificarlo.</p>}
      <p className="muted text-xs">Editar o dar de baja un artículo llegará con el comando correspondiente del dominio; hoy solo se añaden.</p>
    </div>
  );
}
