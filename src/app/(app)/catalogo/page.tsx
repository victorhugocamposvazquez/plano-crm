"use client";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useQueryState } from "@/lib/use-query-state";
import { ChevronDown, Copy, Download, Plus, Trash2, Upload } from "lucide-react";
import { ImportDialog } from "@/components/catalog/import-dialog";
import { aCSV } from "@/lib/importar-catalogo";
import { useWorkspace } from "@/components/workspace-provider";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Modal } from "@/components/ui/modal";
import { Popover } from "@/components/ui/popover";
import { SearchBox } from "@/components/ui/search-box";
import { buscarTolerante, leerConsulta } from "@/lib/busqueda";
import { can, money, type Article } from "@/lib/domain";
import { unidades, unidadNombres, eurosACentimos, codigoSugerido, agruparPorCapitulo, capitulos, type Unidad } from "@/lib/catalogo";

const NUEVA = "__nueva__";
type Form = { chapter: string; name: string; code: string; unit: Unidad; price: string; vat: string };
const vacio = (chapter = "", unit: Unidad = "m²", vat = "21"): Form => ({ chapter, name: "", code: "", unit, price: "", vat });
const desdeArticulo = (a: Article): Form => ({ chapter: a.chapter, name: a.name, code: a.code, unit: (unidades as readonly string[]).includes(a.unit) ? (a.unit as Unidad) : "ud", price: (a.unit_price / 100).toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 }), vat: String(a.vat_rate) });

/**
 * Categoría del artículo: las categorías del catálogo son las de sus artículos, así que se elige una existente
 * o se escribe una nueva aquí mismo.
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

/** Lo que falta en el dominio (foto, proveedor, stock, compra) está en docs/PREGUNTAS.md: aquí solo lo que se guarda de verdad. */
export default function CatalogoPage() {
  const { data, actor, busy, loading, send, notify } = useWorkspace();
  const allowed = can(actor.role, "article.create");
  const [queryParam, setQueryParam] = useQueryState<string>("q", "");
  const [categoria, setCategoria] = useQueryState<string>("c", "");
  const [query, setQuery] = useState(queryParam);
  useEffect(() => { const t = setTimeout(() => { if (query !== queryParam) setQueryParam(query); }, 300); return () => clearTimeout(t); }, [query, queryParam, setQueryParam]);
  const [nuevoParam, setNuevoParam] = useQueryState<"1" | "">("nuevo", "");
  const [importParam, setImportParam] = useQueryState<"1" | "">("importar", "");
  const [filtroAbierto, setFiltroAbierto] = useState(false);
  const [hojaFiltro, setHojaFiltro] = useState(false);
  const [cerradas, setCerradas] = useState<Set<string>>(new Set());
  const [ficha, setFicha] = useState<{ article: Article | null } | null>(null);
  const [form, setForm] = useState<Form>(vacio());
  const [catNueva, setCatNueva] = useState(false);
  const [borrar, setBorrar] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [fallo, setFallo] = useState("");
  useEffect(() => { if (nuevoParam === "1" && allowed) { abrirNuevo(); setNuevoParam(""); } }, [nuevoParam]); // eslint-disable-line react-hooks/exhaustive-deps

  const chapters = useMemo(() => capitulos(data.articles), [data.articles]);
  const encontrados = useMemo(() => buscarTolerante(data.articles, query, a => `${a.code} ${a.name} ${a.chapter} ${a.unit}`).filter(a => !categoria || a.chapter === categoria), [data.articles, query, categoria]);
  const grupos = useMemo(() => agruparPorCapitulo(encontrados), [encontrados]);
  const vocabulario = useMemo(() => data.articles.flatMap(a => [a.name, a.chapter]), [data.articles]);
  const terminos = useMemo(() => leerConsulta(query).terminos, [query]);
  const cents = eurosACentimos(form.price);
  const sugerido = form.chapter.trim() ? codigoSugerido(form.chapter.trim(), data.articles) : "";
  const todasCerradas = grupos.size > 0 && [...grupos.keys()].every(c => cerradas.has(c));

  function exportar() {
    const blob = new Blob([aCSV(data.articles)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = `catalogo-${(data.organization_name || "plano").toLowerCase().replace(/[^a-z0-9]+/gi, "-")}.csv`; a.click(); URL.revokeObjectURL(url);
  }
  function abrirNuevo() { setFicha({ article: null }); setForm(vacio(categoria)); setCatNueva(false); setBorrar(false); setFallo(""); }
  function abrirArticulo(a: Article) { setFicha({ article: a }); setForm(desdeArticulo(a)); setCatNueva(false); setBorrar(false); setFallo(""); }

  async function guardar(event: FormEvent) {
    event.preventDefault();
    if (guardando || busy || !ficha) return;
    if (cents === null) { setFallo("Escribe el precio en euros, por ejemplo 49,50."); return; }
    setGuardando(true); setFallo("");
    try {
      if (ficha.article) await send({ type: "article.update", id: ficha.article.id, code: (form.code.trim() || ficha.article.code).toUpperCase(), name: form.name.trim(), chapter: form.chapter.trim(), unit: form.unit, unit_price: cents, vat_rate: Number(form.vat) });
      else await send({ type: "article.create", code: (form.code.trim() || sugerido).toUpperCase(), name: form.name.trim(), chapter: form.chapter.trim(), unit: form.unit, unit_price: cents, vat_rate: Number(form.vat) });
      notify(`Artículo guardado: ${form.name.trim()}`);
      setFicha(null);
    } catch (e) { setFallo(e instanceof Error ? e.message : "No se ha podido guardar el artículo."); }
    finally { setGuardando(false); }
  }
  async function duplicar() {
    if (!ficha?.article || guardando || busy || cents === null) return;
    setGuardando(true); setFallo("");
    try {
      await send({ type: "article.create", code: codigoSugerido(form.chapter.trim(), data.articles), name: `${form.name.trim()} (copia)`, chapter: form.chapter.trim(), unit: form.unit, unit_price: cents, vat_rate: Number(form.vat) });
      notify(`Artículo duplicado: ${form.name.trim()}`);
      setFicha(null);
    } catch (e) { setFallo(e instanceof Error ? e.message : "No se ha podido duplicar el artículo."); }
    finally { setGuardando(false); }
  }
  async function eliminar() {
    if (!ficha?.article || guardando || busy) return;
    setGuardando(true); setFallo("");
    try { await send({ type: "article.delete", id: ficha.article.id }); notify(`Artículo eliminado: ${ficha.article.name}`); setFicha(null); }
    catch (e) { setFallo(e instanceof Error ? e.message : "No se ha podido eliminar el artículo."); }
    finally { setGuardando(false); }
  }
  const puedeGuardar = form.name.trim() && form.chapter.trim() && cents !== null;

  return (
    <div className="page">
      <div className="pl-head">
        <div><h1 className="pl-title">Catálogo</h1><p className="pl-sub">Todo lo que se puede poner en un presupuesto. Toca un artículo para editarlo. Al presupuesto se añaden desde el propio presupuesto.</p></div>
        {allowed && <div className="pl-head-actions"><Button onClick={() => setImportParam("1")}><Upload size={16} strokeWidth={1.7} aria-hidden="true" />Subir tarifa de proveedor</Button><Button variant="primary" onClick={abrirNuevo}><Plus size={17} strokeWidth={1.8} aria-hidden="true" />Nuevo artículo</Button></div>}
      </div>
      <SearchBox seccion="catalogo" value={query} onChange={setQuery} label="Buscar artículos" placeholder="Busca lo que sea: material, medida, categoría, código…" count={loading ? undefined : `${encontrados.length} ${encontrados.length === 1 ? "artículo" : "artículos"}`} vocabulario={vocabulario} />
      {chapters.length > 0 && <div className="filter-row">
        <span className="muted text-sm">Filtrar por</span>
        <Popover open={filtroAbierto} onClose={() => setFiltroAbierto(false)} panelClassName="filter-panel" trigger={
          <button type="button" className="filter-button" data-active={categoria ? true : undefined} aria-expanded={filtroAbierto} onClick={() => { if (window.matchMedia("(max-width: 767px)").matches) setHojaFiltro(true); else setFiltroAbierto(v => !v); }}><span>Categoría:</span><strong>{categoria || "Todas"}</strong><ChevronDown size={15} strokeWidth={1.8} aria-hidden="true" /></button>
        }>
          <button type="button" className="filter-option" data-on={!categoria || undefined} onClick={() => { setCategoria(""); setFiltroAbierto(false); }}>Todas las categorías<span className="pl-mono">{data.articles.length}</span></button>
          {chapters.map(c => <button key={c} type="button" className="filter-option" data-on={categoria === c || undefined} onClick={() => { setCategoria(c); setFiltroAbierto(false); }}>{c}<span className="pl-mono">{data.articles.filter(a => a.chapter === c).length}</span></button>)}
        </Popover>
        {categoria && <button type="button" className="link-inline" onClick={() => setCategoria("")}>Quitar filtros</button>}
      </div>}
      {encontrados.length > 0 && <div className="catalog-summary"><strong>{categoria || "Todo el catálogo"} · {encontrados.length} {encontrados.length === 1 ? "artículo" : "artículos"}</strong><span><button type="button" className="link-inline" onClick={() => setCerradas(todasCerradas ? new Set() : new Set(grupos.keys()))}>{todasCerradas ? "Abrir todo" : "Cerrar todo"}</button><button type="button" className="link-inline" onClick={exportar}><Download size={14} strokeWidth={1.7} aria-hidden="true" style={{ verticalAlign: "-2px", marginRight: 4 }} />Exportar</button></span></div>}
      {!loading && encontrados.length === 0 && <div className="empty"><strong>{query ? `Nada coincide con «${query}»` : "El catálogo está vacío"}</strong><span className="muted text-sm">{query ? "Prueba con otra palabra o quita la categoría." : "Los artículos con su precio son la base de estimaciones y presupuestos."}</span>{!query && allowed && <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}><Button variant="primary" onClick={abrirNuevo}>Añadir el primer artículo</Button><Button onClick={() => setImportParam("1")}>Subir tarifa</Button></div>}</div>}
      <div className="catalog-groups">
        {[...grupos.entries()].map(([chapter, list]) => {
          const abierta = !cerradas.has(chapter);
          return (
            <section key={chapter} className="pl-card catalog-group" aria-label={chapter}>
              <button type="button" className="catalog-group-head" aria-expanded={abierta} onClick={() => setCerradas(prev => { const next = new Set(prev); if (abierta) next.add(chapter); else next.delete(chapter); return next; })}>
                <span className="catalog-round" data-open={abierta} aria-hidden="true"><ChevronDown size={15} strokeWidth={1.8} /></span>
                <strong>{chapter}</strong>
                <span className="muted text-sm catalog-group-count">{list.length} {list.length === 1 ? "artículo" : "artículos"}</span>
                <span className="catalog-pill">{abierta ? "Ocultar" : "Mostrar"}</span>
              </button>
              {abierta && <div className="article-grid">
                {list.map(a => {
                  const contenido = <>
                    <span className="article-price pl-mono">{money(a.unit_price)}<small>/{a.unit}</small></span>
                    <strong>{a.name}</strong>
                    <small className="article-code pl-mono">{a.code}</small>
                    <span className="article-tags"><span className="items-tag">IVA {a.vat_rate} %</span>{terminos.length > 0 && <span className="items-tag">{a.chapter}</span>}</span>
                  </>;
                  return allowed
                    ? <button key={a.id} type="button" className="article-card" onClick={() => abrirArticulo(a)} aria-haspopup="dialog">{contenido}</button>
                    : <div key={a.id} className="article-card">{contenido}</div>;
                })}
              </div>}
            </section>
          );
        })}
      </div>
      {!allowed && <p className="muted text-xs">Tu perfil puede consultar el catálogo pero no modificarlo.</p>}

      <Modal open={Boolean(ficha)} onClose={() => setFicha(null)} panel="wide" kicker={ficha?.article ? ficha.article.code : "Nuevo"} title={ficha?.article ? ficha.article.name : "Artículo"} footer={<>
        {ficha?.article && (borrar
          ? <span className="catalog-danger"><span className="text-sm">¿Dar de baja?</span><Button variant="ghost" className="danger" onClick={eliminar} disabled={guardando || busy}>Sí</Button><Button variant="ghost" onClick={() => setBorrar(false)} disabled={guardando}>No</Button></span>
          : <Button variant="ghost" className="danger catalog-danger" onClick={() => setBorrar(true)} disabled={guardando || busy}><Trash2 size={15} strokeWidth={1.7} aria-hidden="true" />Dar de baja</Button>)}
        {ficha?.article && <Button onClick={duplicar} disabled={guardando || busy || !puedeGuardar}><Copy size={15} strokeWidth={1.7} aria-hidden="true" />Duplicar</Button>}
        <Button variant="primary" type="submit" form="ficha-articulo" disabled={guardando || busy || !puedeGuardar}>{guardando ? "Guardando…" : "Guardar"}</Button>
      </>}>
        <form id="ficha-articulo" className="form" onSubmit={guardar} style={{ maxWidth: "none" }}>
          <label className="field"><span>Nombre</span><input type="text" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Preparación y pintura plástica lisa de paramentos" required maxLength={500} /></label>
          <div className="line-grid">
            <CampoCategoria value={form.chapter} onChange={chapter => setForm({ ...form, chapter })} chapters={chapters} nueva={catNueva} onNueva={setCatNueva} />
            <label className="field"><span>Código</span><input type="text" value={form.code} onChange={e => setForm({ ...form, code: e.target.value })} placeholder={sugerido || "PIN-001"} maxLength={40} /></label>
          </div>
          <div className="line-grid">
            <div className="field"><span>Unidad</span><Select label="Unidad" value={form.unit} onChange={u => setForm({ ...form, unit: u })} options={unidades.map(u => ({ value: u, label: unidadNombres[u] }))} /></div>
            <label className="field"><span>Precio sin IVA</span><span className="unit-input"><input type="text" inputMode="decimal" value={form.price} onChange={e => setForm({ ...form, price: e.target.value })} placeholder="49,50" required aria-invalid={form.price !== "" && cents === null ? true : undefined} /><span>€ / {form.unit}</span></span></label>
            <div className="field"><span>IVA</span><Select label="IVA" value={form.vat} onChange={v => setForm({ ...form, vat: v })} options={[{ value: "21", label: "21 %" }, { value: "10", label: "10 %", hint: "Vivienda con requisitos" }, { value: "0", label: "0 %" }]} /></div>
          </div>
          {fallo && <p role="alert" className="auth-error">{fallo}</p>}
          <p className="muted text-xs">Los presupuestos que ya copiaron este artículo conservan su precio y su texto.</p>
        </form>
      </Modal>
      <Modal open={hojaFiltro} onClose={() => setHojaFiltro(false)} title="Categoría" footer={<><Button onClick={() => { setCategoria(""); setHojaFiltro(false); }}>Quitar</Button><Button variant="primary" onClick={() => setHojaFiltro(false)}>Ver {encontrados.length} {encontrados.length === 1 ? "artículo" : "artículos"}</Button></>}>
        <div className="filter-sheet" role="radiogroup" aria-label="Categoría">
          {chapters.map(c => <button key={c} type="button" role="radio" aria-checked={categoria === c} onClick={() => setCategoria(categoria === c ? "" : c)}><i aria-hidden="true" /><strong>{c}</strong><span>{data.articles.filter(a => a.chapter === c).length}</span></button>)}
        </div>
      </Modal>
      <ImportDialog open={importParam === "1"} onClose={() => setImportParam("")} />
    </div>
  );
}
