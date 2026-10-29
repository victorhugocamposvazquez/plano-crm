"use client";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useQueryState } from "@/lib/use-query-state";
import { Search, X, Plus, BookOpen, Upload, Download, ChevronRight, FolderPlus, Trash2 } from "lucide-react";
import { ImportDialog } from "@/components/catalog/import-dialog";
import { aCSV } from "@/lib/importar-catalogo";
import { useWorkspace } from "@/components/workspace-provider";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Modal } from "@/components/ui/modal";
import { can, money, type Article } from "@/lib/domain";
import { unidades, unidadNombres, eurosACentimos, codigoSugerido, buscarArticulos, agruparPorCapitulo, capitulos, type Unidad } from "@/lib/catalogo";

const NUEVA = "__nueva__";
type Form = { chapter: string; name: string; code: string; unit: Unidad; price: string; vat: string };
const vacio = (chapter = "", unit: Unidad = "m²", vat = "21"): Form => ({ chapter, name: "", code: "", unit, price: "", vat });
const desdeArticulo = (a: Article): Form => ({ chapter: a.chapter, name: a.name, code: a.code, unit: (unidades as readonly string[]).includes(a.unit) ? (a.unit as Unidad) : "ud", price: (a.unit_price / 100).toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 }), vat: String(a.vat_rate) });

/**
 * Categoría del artículo: las categorías del catálogo son las de sus artículos, así que se elige una existente
 * o se escribe una nueva aquí mismo. `nueva` fuerza el campo de texto (botón «Nueva categoría» o catálogo vacío).
 */
function CampoCategoria({ value, onChange, chapters, nueva, onNueva }: { value: string; onChange: (v: string) => void; chapters: string[]; nueva: boolean; onNueva: (v: boolean) => void }) {
  const existente = chapters.includes(value);
  if (!chapters.length || nueva || (value && !existente)) {
    return (
      <div className="field">
        <span>Categoría nueva</span>
        <input type="text" aria-label="Categoría nueva" value={value} onChange={e => onChange(e.target.value)} placeholder="Pintura, Fontanería…" required maxLength={120} autoFocus={nueva} />
        {chapters.length > 0 && <button type="button" className="link-button text-xs" style={{ alignSelf: "flex-start", marginTop: 4 }} onClick={() => { onNueva(false); onChange(""); }}>Elegir una categoría existente</button>}
      </div>
    );
  }
  return (
    <div className="field"><span>Categoría</span>
      <Select label="Categoría" value={existente ? value : ""} placeholder="Elegir categoría…" onChange={v => { if (v === NUEVA) { onChange(""); onNueva(true); } else onChange(v); }} options={[...chapters.map(c => ({ value: c, label: c })), { value: NUEVA, label: "Nueva categoría…", hint: "Se crea con este artículo" }]} />
    </div>
  );
}

function CamposArticulo({ form, setForm, chapters, nueva, setNueva, suggested, cents, idPrefix }: { form: Form; setForm: (f: Form) => void; chapters: string[]; nueva: boolean; setNueva: (v: boolean) => void; suggested: string; cents: number | null; idPrefix: string }) {
  return (
    <>
      <div className="line-grid">
        <CampoCategoria value={form.chapter} onChange={chapter => setForm({ ...form, chapter })} chapters={chapters} nueva={nueva} onNueva={setNueva} />
        <label className="field"><span>Código</span><input id={`${idPrefix}-codigo`} type="text" value={form.code} onChange={e => setForm({ ...form, code: e.target.value })} placeholder={suggested || "PIN-001"} maxLength={40} /></label>
      </div>
      <label className="field"><span>Descripción del artículo</span><input type="text" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Preparación y pintura plástica lisa de paramentos" required maxLength={500} /></label>
      <div className="line-grid">
        <div className="field"><span>Unidad</span><Select label="Unidad" value={form.unit} onChange={u => setForm({ ...form, unit: u })} options={unidades.map(u => ({ value: u, label: unidadNombres[u] }))} /></div>
        <label className="field"><span>Precio sin IVA</span><span className="unit-input"><input type="text" inputMode="decimal" value={form.price} onChange={e => setForm({ ...form, price: e.target.value })} placeholder="49,50" required aria-invalid={form.price !== "" && cents === null ? true : undefined} /><span>€ / {form.unit}</span></span></label>
        <div className="field"><span>IVA</span><Select label="IVA" value={form.vat} onChange={v => setForm({ ...form, vat: v })} options={[{ value: "21", label: "21 %" }, { value: "10", label: "10 %", hint: "Vivienda con requisitos" }, { value: "0", label: "0 %" }]} /></div>
      </div>
    </>
  );
}

export default function CatalogoPage() {
  const { data, actor, busy, loading, send, notify } = useWorkspace();
  const allowed = can(actor.role, "article.create");
  const [queryParam, setQueryParam] = useQueryState<string>("q", "");
  const [chapterParam, setChapterParam] = useQueryState<string>("c", "");
  const [query, setQuery] = useState(queryParam);
  useEffect(() => { const t = setTimeout(() => { if (query !== queryParam) setQueryParam(query); }, 300); return () => clearTimeout(t); }, [query, queryParam, setQueryParam]);
  const [adding, setAdding] = useState(false);
  const [nuevaCat, setNuevaCat] = useState(false);
  const [importParam, setImportParam] = useQueryState<"1" | "">("importar", "");
  function exportar() {
    const blob = new Blob([aCSV(data.articles)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = `catalogo-${(data.organization_name || "plano").toLowerCase().replace(/[^a-z0-9]+/gi, "-")}.csv`; a.click(); URL.revokeObjectURL(url);
  }
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState<Form>(vacio());
  // Edición en diálogo sobre la lista: al cerrarlo sigues donde estabas.
  const [editando, setEditando] = useState<Article | null>(null);
  const [edit, setEdit] = useState<Form>(vacio());
  const [editNueva, setEditNueva] = useState(false);
  const [borrar, setBorrar] = useState(false);
  const [editError, setEditError] = useState("");

  const chapters = useMemo(() => capitulos(data.articles), [data.articles]);
  const found = useMemo(() => buscarArticulos(data.articles, query).filter(a => !chapterParam || a.chapter === chapterParam), [data.articles, query, chapterParam]);
  const groups = useMemo(() => agruparPorCapitulo(found), [found]);
  const cents = eurosACentimos(form.price);
  const suggested = form.chapter.trim() ? codigoSugerido(form.chapter.trim(), data.articles) : "";
  const editCents = eurosACentimos(edit.price);

  function abrirAlta(nueva = false) { setAdding(true); setNuevaCat(nueva); if (nueva) setForm(f => ({ ...f, chapter: "" })); }
  function abrirEdicion(a: Article) { setEditando(a); setEdit(desdeArticulo(a)); setEditNueva(false); setBorrar(false); setEditError(""); }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (saving || busy) return;
    if (cents === null) { setError("Escribe el precio en euros, por ejemplo 49,50."); return; }
    setSaving(true); setError("");
    try {
      await send({ type: "article.create", code: (form.code.trim() || suggested).toUpperCase(), name: form.name.trim(), chapter: form.chapter.trim(), unit: form.unit, unit_price: cents, vat_rate: Number(form.vat) });
      notify(`Artículo añadido: ${form.name.trim()}`);
      setForm(vacio(form.chapter, form.unit, form.vat)); setNuevaCat(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se ha podido guardar el artículo.");
    } finally {
      setSaving(false);
    }
  }

  async function guardarEdicion(event: FormEvent) {
    event.preventDefault();
    if (!editando || saving || busy) return;
    if (editCents === null) { setEditError("Escribe el precio en euros, por ejemplo 49,50."); return; }
    setSaving(true); setEditError("");
    try {
      await send({ type: "article.update", id: editando.id, code: (edit.code.trim() || editando.code).toUpperCase(), name: edit.name.trim(), chapter: edit.chapter.trim(), unit: edit.unit, unit_price: editCents, vat_rate: Number(edit.vat) });
      notify(`Artículo guardado: ${edit.name.trim()}`);
      setEditando(null);
    } catch (e) {
      setEditError(e instanceof Error ? e.message : "No se ha podido guardar el artículo.");
    } finally {
      setSaving(false);
    }
  }

  async function eliminar() {
    if (!editando || saving || busy) return;
    setSaving(true); setEditError("");
    try {
      await send({ type: "article.delete", id: editando.id });
      notify(`Artículo eliminado: ${editando.name}`);
      setEditando(null);
    } catch (e) {
      setEditError(e instanceof Error ? e.message : "No se ha podido eliminar el artículo.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="page">
      <div>
        <div className="eyebrow"><BookOpen size={13} strokeWidth={1.8} aria-hidden="true" /><span>{data.organization_name || "Espacio de trabajo"}</span></div>
        <div className="page-head">
          <h1 className="h1">Catálogo.</h1>
          {allowed && <Button variant={adding ? "secondary" : "primary"} className="btn-new" aria-expanded={adding} onClick={() => { if (adding) { setAdding(false); setNuevaCat(false); } else abrirAlta(false); }}>{adding ? <X size={17} strokeWidth={1.8} aria-hidden="true" /> : <Plus size={17} strokeWidth={1.8} aria-hidden="true" />}{adding ? "Cerrar" : "Nuevo artículo"}</Button>}
        </div>
        <p className="subtitle">{loading ? "Cargando el catálogo…" : `${data.articles.length} artículos en ${chapters.length} categorías · precios sin IVA que alimentan estimaciones y presupuestos`}</p>
      </div>

      {(allowed || data.articles.length > 0) && (
        <div className="catalog-tools">
          {allowed && <Button variant="secondary" onClick={() => abrirAlta(true)} aria-expanded={adding && nuevaCat}><FolderPlus size={16} strokeWidth={1.7} aria-hidden="true" />Nueva categoría</Button>}
          {allowed && <Button variant="secondary" onClick={() => setImportParam("1")}><Upload size={16} strokeWidth={1.7} aria-hidden="true" />Importar CSV</Button>}
          {data.articles.length > 0 && <Button variant="ghost" onClick={exportar}><Download size={15} strokeWidth={1.7} aria-hidden="true" />Exportar CSV</Button>}
          {allowed && data.articles.length === 0 && <span className="muted text-xs">Trae el tarifario de una vez: Excel → Guardar como CSV → Importar.</span>}
        </div>
      )}

      {adding && allowed && (
        <form className="form line" onSubmit={submit} style={{ maxWidth: "none" }}>
          {nuevaCat && <p className="muted text-sm">Una categoría existe en cuanto tiene su primer artículo: ponle nombre y añade el primero.</p>}
          <CamposArticulo form={form} setForm={setForm} chapters={chapters} nueva={nuevaCat} setNueva={setNuevaCat} suggested={suggested} cents={cents} idPrefix="alta" />
          {error && <p role="alert" className="auth-error">{error}</p>}
          <div className="form-actions">
            <span className="muted text-xs" style={{ alignSelf: "center" }}>Los precios copiados a un presupuesto no cambian al editar el catálogo.</span>
            <Button type="submit" variant="primary" disabled={saving || busy || !form.name.trim() || !form.chapter.trim() || cents === null}>{saving ? "Guardando…" : `Añadir artículo${cents !== null ? ` · ${money(cents)}` : ""}`}</Button>
          </div>
        </form>
      )}

      {chapters.length > 0 && (
        <div className="chips chips-scroll" role="group" aria-label="Categorías">
          <button type="button" className="chip" aria-pressed={!chapterParam} onClick={() => setChapterParam("")}>Todas <span className="pl-mono muted">{data.articles.length}</span></button>
          {chapters.map(c => <button key={c} type="button" className="chip" aria-pressed={chapterParam === c} onClick={() => setChapterParam(chapterParam === c ? "" : c)}>{c} <span className="pl-mono muted">{data.articles.filter(a => a.chapter === c).length}</span></button>)}
        </div>
      )}

      <label className="search">
        <Search size={16} strokeWidth={1.8} aria-hidden="true" />
        <input type="search" className="search-input" value={query} onChange={e => setQuery(e.target.value)} placeholder="Buscar por código, descripción o categoría…" aria-label="Buscar artículos" autoComplete="off" />
        {query && <button type="button" className="search-clear" aria-label="Borrar búsqueda" onClick={() => setQuery("")}><X size={15} strokeWidth={1.8} aria-hidden="true" /></button>}
      </label>

      {!loading && found.length === 0 && <div className="empty"><strong>{query ? `Nada coincide con «${query}»` : "El catálogo está vacío"}</strong><span className="muted text-sm">{query ? "Prueba con parte de la descripción o el capítulo." : "Los artículos con su precio son la base de estimaciones y presupuestos."}</span>{!query && allowed && <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}><Button variant="primary" onClick={() => abrirAlta(false)}>Añadir el primer artículo</Button><Button variant="secondary" onClick={() => setImportParam("1")}>Importar CSV</Button></div>}</div>}

      {[...groups.entries()].map(([chapter, list]) => (
        <div key={chapter}>
          <div className="section-label"><span>{chapter}</span><span className="pl-mono">{list.length}</span></div>
          <div style={{ borderTop: "var(--pl-hairline) solid var(--pl-line)" }}>
            {list.map(article => allowed ? (
              <button key={article.id} type="button" className="row-item" style={{ gridTemplateColumns: "minmax(0, 1fr) auto auto" }} onClick={() => abrirEdicion(article)} aria-haspopup="dialog" title="Editar artículo">
                <span style={{ minWidth: 0 }}><strong>{article.name}</strong><small><span className="pl-mono">{article.code}</span> · {article.unit} · IVA {article.vat_rate} %</small></span>
                <span className="pl-mono" style={{ textAlign: "right" }}>{money(article.unit_price)}<small className="muted" style={{ display: "block", fontSize: "var(--pl-text-xs)" }}>por {article.unit}</small></span>
                <ChevronRight size={16} strokeWidth={1.7} aria-hidden="true" className="row-item-go" />
              </button>
            ) : (
              <div key={article.id} className="row-item" style={{ gridTemplateColumns: "minmax(0, 1fr) auto" }}>
                <span style={{ minWidth: 0 }}><strong>{article.name}</strong><small><span className="pl-mono">{article.code}</span> · {article.unit} · IVA {article.vat_rate} %</small></span>
                <span className="pl-mono" style={{ textAlign: "right" }}>{money(article.unit_price)}<small className="muted" style={{ display: "block", fontSize: "var(--pl-text-xs)" }}>por {article.unit}</small></span>
              </div>
            ))}
          </div>
        </div>
      ))}

      {!allowed && <p className="muted text-xs">Tu perfil puede consultar el catálogo pero no modificarlo.</p>}
      {allowed && data.articles.length > 0 && <p className="muted text-xs">Toca un artículo para editarlo o darlo de baja. Los precios copiados a un presupuesto no cambian.</p>}

      <Modal open={Boolean(editando)} onClose={() => setEditando(null)} title={editando ? `Editar · ${editando.code}` : "Editar artículo"} footer={<>
        {borrar
          ? <span className="catalog-danger"><span className="text-sm">¿Dar de baja «{editando?.name}»?</span><Button variant="ghost" className="danger" onClick={eliminar} disabled={saving || busy}>{saving ? "Eliminando…" : "Sí, eliminar"}</Button><Button variant="ghost" onClick={() => setBorrar(false)} disabled={saving}>No</Button></span>
          : <Button variant="ghost" className="danger catalog-danger" onClick={() => setBorrar(true)} disabled={saving || busy}><Trash2 size={15} strokeWidth={1.7} aria-hidden="true" />Dar de baja</Button>}
        <Button variant="ghost" onClick={() => setEditando(null)} disabled={saving}>Cancelar</Button>
        <Button variant="primary" type="submit" form="editar-articulo" disabled={saving || busy || !edit.name.trim() || !edit.chapter.trim() || editCents === null}>{saving && !borrar ? "Guardando…" : "Guardar"}</Button>
      </>}>
        <form id="editar-articulo" className="form" onSubmit={guardarEdicion} style={{ maxWidth: "none" }}>
          <CamposArticulo form={edit} setForm={setEdit} chapters={chapters} nueva={editNueva} setNueva={setEditNueva} suggested={editando?.code ?? ""} cents={editCents} idPrefix="edicion" />
          {editError && <p role="alert" className="auth-error">{editError}</p>}
          <p className="muted text-xs">Los presupuestos que ya copiaron este artículo conservan su precio y su texto.</p>
        </form>
      </Modal>
      <ImportDialog open={importParam === "1"} onClose={() => setImportParam("")} />
    </div>
  );
}
