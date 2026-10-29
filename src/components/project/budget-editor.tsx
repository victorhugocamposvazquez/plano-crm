"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { Plus, Trash2, ChevronUp, ChevronDown, Search, X, ListChecks, Check, PenLine } from "lucide-react";
import { Drawer } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { useWorkspace } from "@/components/workspace-provider";
import { money, lineTotal, type BudgetItem, type BudgetVersion, type Project } from "@/lib/domain";
import { buscarArticulos, capitulos } from "@/lib/catalogo";
import { partidaDesdeArticulo, partidaLibre, actualizarPartida, quitarPartida, moverPartida, validarPartidas, partidasPorCapitulo, totalCapitulo, guiaPorTipo, progresoGuia, resumen, unidadesPartida } from "@/lib/presupuesto";

type Inclusion = BudgetItem["inclusion"];
const inclusionOptions: { value: Inclusion; label: string; hint?: string }[] = [
  { value: "included", label: "Incluida" }, { value: "optional", label: "Alternativa", hint: "Se muestra, no suma" }, { value: "excluded", label: "Excluida", hint: "Queda fuera del precio" }
];
const unidadOptions = unidadesPartida.map(u => ({ value: u, label: u }));

/**
 * Editor manual de la revisión en borrador: partidas desde el catálogo o libres, cantidades, precios,
 * ajustes e inclusión, con una guía por capítulos que se puede saltar. Guarda con `budget.save`
 * (revisión esperada incluida: si alguien guardó antes, el dominio lo rechaza y se avisa).
 */
export function BudgetEditor({ open, onClose, project, version, guiaInicial }: { open: boolean; onClose: () => void; project: Project; version: BudgetVersion; guiaInicial: boolean }) {
  const { data, busy, send, notify } = useWorkspace();
  const [items, setItems] = useState<BudgetItem[]>(version.items);
  const [notes, setNotes] = useState(version.notes);
  const [saving, setSaving] = useState(false);
  const [guia, setGuia] = useState(false);
  const [openChapters, setOpenChapters] = useState<Set<string>>(() => new Set());
  const [query, setQuery] = useState("");
  const [capitulo, setCapitulo] = useState("");
  const [confirmClose, setConfirmClose] = useState(false);
  const catalogo = useRef<HTMLDivElement>(null);

  // Al abrir, o si la revisión cambia por debajo (otro guardado), se parte de lo que hay en el dominio.
  // Los capítulos nacen abiertos: revisar una partida no debe exigir abrir, leer y cerrar cada uno.
  useEffect(() => { if (open) { setItems(version.items); setNotes(version.notes); setGuia(false); setOpenChapters(new Set(version.items.map(i => i.chapter))); setConfirmClose(false); } }, [open, version.id, version.draft_revision]); // eslint-disable-line react-hooks/exhaustive-deps

  const dirty = JSON.stringify(items) !== JSON.stringify(version.items) || notes !== version.notes;
  const original = useMemo(() => new Map(version.items.map(i => [i.id, JSON.stringify(i)])), [version.items]);
  const cambiada = (item: BudgetItem) => original.get(item.id) !== JSON.stringify(item);
  const cambios = items.filter(cambiada).length + version.items.filter(i => !items.some(x => x.id === i.id)).length + (notes !== version.notes ? 1 : 0);
  const textoCambios = cambios === 0 ? "" : `${cambios} ${cambios === 1 ? "cambio" : "cambios"} sin guardar`;
  const errores = useMemo(() => validarPartidas(items), [items]);
  const errorDe = (id: string) => errores.find(e => e.id === id)?.message;
  const grupos = useMemo(() => partidasPorCapitulo(items), [items]);
  const pasos = useMemo(() => progresoGuia(guiaPorTipo(project.kind), items), [project.kind, items]);
  const chapters = useMemo(() => capitulos(data.articles), [data.articles]);
  const encontrados = useMemo(() => buscarArticulos(data.articles, query).filter(a => !capitulo || a.chapter === capitulo).slice(0, 40), [data.articles, query, capitulo]);
  const total = resumen(items);

  const update = (id: string, patch: Partial<BudgetItem>) => { if (patch.chapter) setOpenChapters(prev => new Set(prev).add(patch.chapter!)); setItems(prev => actualizarPartida(prev, id, patch)); };
  function addArticulo(articleId: string) {
    const article = data.articles.find(a => a.id === articleId);
    if (!article) return;
    const item = partidaDesdeArticulo(article); setItems(prev => [...prev, item]); setOpenChapters(prev => new Set(prev).add(item.chapter));
  }
  function addLibre() { const item = partidaLibre(capitulo || "Varios"); setItems(prev => [...prev, item]); setOpenChapters(prev => new Set(prev).add(item.chapter)); }
  function irA(chapter: string) { setCapitulo(chapter); setQuery(""); catalogo.current?.scrollIntoView({ behavior: "smooth", block: "start" }); }

  function intentarCerrar() { if (dirty) setConfirmClose(true); else onClose(); }

  async function guardar() {
    if (saving || busy || errores.length) return;
    setSaving(true);
    try {
      await send({ type: "budget.save", version_id: version.id, expected_revision: version.draft_revision, items: items.map(i => ({ ...i, description: i.description.trim(), chapter: i.chapter.trim() || "Varios" })), notes });
      notify(`V${version.number} guardada · ${money(total.base)} sin IVA`);
      onClose();
    } catch (e) {
      notify(e instanceof Error ? e.message : "No se ha podido guardar la revisión.");
    } finally {
      setSaving(false);
    }
  }

  const footer = confirmClose ? (
    <div className="editor-foot">
      <span className="text-sm"><strong>Cambios sin guardar.</strong> <span className="muted">Si cierras, la V{version.number} se queda como estaba.</span></span>
      <div style={{ display: "flex", gap: 8 }}>
        <Button variant="secondary" onClick={() => { setConfirmClose(false); onClose(); }}>Descartar</Button>
        <Button variant="primary" onClick={() => setConfirmClose(false)}>Seguir editando</Button>
      </div>
    </div>
  ) : (
    <div className="editor-foot">
      <span className="editor-sum"><small>Base</small><strong className="pl-mono">{money(total.base)}</strong><small>IVA</small><strong className="pl-mono">{money(total.tax)}</strong><small>Total</small><strong className="pl-mono">{money(total.total)}</strong></span>
      <div style={{ display: "flex", gap: 8 }}>
        <Button variant="secondary" onClick={intentarCerrar}>{dirty ? "Descartar" : "Cerrar"}</Button>
        <Button variant="primary" onClick={guardar} disabled={!dirty || saving || busy || errores.length > 0} title={errores.length ? "Hay partidas incompletas" : undefined}>{saving ? "Guardando…" : cambios ? `Guardar V${version.number} · ${cambios}` : `Guardar V${version.number}`}</Button>
      </div>
    </div>
  );

  return (
    <Drawer open={open} onClose={intentarCerrar} size="wide" title={`Editar V${version.number} · partidas`} subtitle={[project.name, `${items.length} ${items.length === 1 ? "partida" : "partidas"}`, textoCambios].filter(Boolean).join(" · ")} footer={footer}>
      <div className="editor">
        {guia ? (
          <section className="guide zone">
            <div className="guide-head">
              <span><ListChecks size={16} strokeWidth={1.7} aria-hidden="true" /><strong>Guía por capítulos</strong><small className="muted"> · el orden natural de una {project.kind === "carpentry" ? "carpintería" : "reforma"}</small></span>
              <button type="button" className="btn btn-ghost" onClick={() => setGuia(false)}>Ir al grano</button>
            </div>
            <ol className="guide-steps">
              {pasos.map((p, i) => (
                <li key={p.chapter}>
                  <button type="button" className="guide-step" data-done={p.count > 0} aria-pressed={capitulo === p.chapter} onClick={() => irA(p.chapter)}>
                    <span className="guide-mark">{p.count > 0 ? <Check size={13} strokeWidth={2.2} aria-hidden="true" /> : <span className="pl-mono">{i + 1}</span>}</span>
                    <span style={{ minWidth: 0 }}><strong>{p.label}</strong><small className="muted">{p.count > 0 ? `${p.count} partida${p.count === 1 ? "" : "s"}` : p.hint}</small></span>
                  </button>
                </li>
              ))}
            </ol>
          </section>
        ) : (
          <button type="button" className="guide-reopen" onClick={() => setGuia(true)}><ListChecks size={15} strokeWidth={1.7} aria-hidden="true" />Ver la guía por capítulos · {pasos.filter(p => p.count > 0).length} de {pasos.length} cubiertos</button>
        )}

        <section>
          <div className="section-label" style={{ marginTop: 0 }}><span>Partidas</span><span className="pl-mono">{items.length}</span></div>
          {items.length === 0 && <div className="empty" style={{ padding: "22px 16px" }}><strong>Todavía no hay partidas</strong><span className="muted text-sm">Añádelas del catálogo más abajo o escribe una libre. El precio del catálogo se copia al añadir; luego puedes ajustarlo aquí.</span></div>}
          {[...grupos.entries()].map(([chapter, list]) => (
            <details key={chapter} className="editor-chapter editor-chapter-fold" open={openChapters.has(chapter)} onToggle={e => { const opened = e.currentTarget.open; setOpenChapters(prev => { if (prev.has(chapter) === opened) return prev; const next = new Set(prev); if (opened) next.add(chapter); else next.delete(chapter); return next; }); }}>
              <summary className="editor-chapter-head"><span>{chapter} · {list.length} {list.length === 1 ? "partida" : "partidas"}</span><span className="pl-mono">{money(totalCapitulo(list))}</span></summary>
              {list.map(item => {
                const error = errorDe(item.id);
                return (
                  <article key={item.id} className="editor-item" data-excluded={item.inclusion !== "included"} data-error={Boolean(error)} data-changed={cambiada(item) || undefined}>
                    <div className="editor-item-head">
                      <span className="editor-changed" aria-hidden="true" title="Cambiada en esta sesión" />
                      <input type="text" className="editor-desc" value={item.description} onChange={e => update(item.id, { description: e.target.value })} placeholder="Descripción de la partida" aria-label="Descripción" aria-invalid={error ? true : undefined} maxLength={2000} />
                      <div className="editor-item-tools">


                        <button type="button" className="search-clear" aria-label={`Quitar ${item.description || "partida"}`} onClick={() => setItems(prev => quitarPartida(prev, item.id))}><Trash2 size={14} strokeWidth={1.8} aria-hidden="true" /></button>
                      </div>
                    </div>
                    <div className="editor-grid editor-grid-primary">
                      <label className="field"><span>Cantidad</span><span className="unit-input"><input type="number" inputMode="decimal" min={0} step={item.unit === "ud" ? 1 : 0.1} value={item.quantity} onChange={e => update(item.id, { quantity: Number(e.target.value) || 0 })} aria-label="Cantidad" /><span>{item.unit}</span></span></label>
                      <label className="field"><span>Precio sin IVA</span><span className="unit-input"><input type="number" inputMode="decimal" min={0} step={0.01} value={item.unit_price / 100} onChange={e => update(item.id, { unit_price: Math.round((Number(e.target.value) || 0) * 100) })} aria-label="Precio unitario en euros" /><span>€</span></span></label>
                      <div className="field editor-amount"><span>Importe sin IVA</span><strong className="pl-mono">{money(lineTotal(item))}</strong>{item.adjustment_percent !== 0 && <small className="muted">Ajuste {item.adjustment_percent}% aplicado</small>}{item.inclusion !== "included" && <small className="muted">{item.inclusion === "optional" ? "Alternativa" : "Excluida"} · no suma</small>}</div>
                    </div>
                    <details className="editor-advanced">
                      <summary>Ajustes y opciones</summary>
                      <div className="editor-grid">
                        <div className="field"><span>Unidad</span><Select size="sm" label="Unidad" value={item.unit} onChange={u => update(item.id, { unit: u })} options={unidadOptions} /></div>
                        <label className="field"><span>Ajuste de precio</span><span className="unit-input"><input type="number" inputMode="numeric" min={-50} max={100} step={1} value={item.adjustment_percent} onChange={e => update(item.id, { adjustment_percent: Number(e.target.value) || 0 })} aria-label="Ajuste en porcentaje" /><span>%</span></span></label>
                        <div className="field"><span>Inclusión</span><Select size="sm" label="Inclusión" value={item.inclusion} onChange={v => update(item.id, { inclusion: v })} options={inclusionOptions} /></div>
                      </div>
                      <label className="field"><span>Capítulo</span><input type="text" list="capitulos-editor" defaultValue={item.chapter} onBlur={e => update(item.id, { chapter: e.target.value.trim() || "Varios" })} aria-label="Capítulo" maxLength={120} /></label>
                      <div className="editor-item-tools"><Button variant="ghost" aria-label="Subir partida" onClick={() => setItems(prev => moverPartida(prev, item.id, -1))}><ChevronUp size={14} aria-hidden="true"/>Subir</Button><Button variant="ghost" aria-label="Bajar partida" onClick={() => setItems(prev => moverPartida(prev, item.id, 1))}><ChevronDown size={14} aria-hidden="true"/>Bajar</Button></div>
                    </details>
                    {error && <p className="text-xs danger">{error}</p>}
                  </article>
                );
              })}
              <button type="button" className="editor-add-row" onClick={() => irA(chapter)}><Plus size={15} strokeWidth={1.8} aria-hidden="true" />Añadir en {chapter}</button>
            </details>
          ))}
          <datalist id="capitulos-editor">{[...new Set([...chapters, ...pasos.map(p => p.chapter)])].map(c => <option key={c} value={c} />)}</datalist>
        </section>

        <section ref={catalogo} className="catalog-pick">
          <div className="section-label"><span>Añadir del catálogo</span><button type="button" className="btn btn-ghost" onClick={addLibre}><PenLine size={14} strokeWidth={1.8} aria-hidden="true" />Partida libre</button></div>
          <label className="search">
            <Search size={16} strokeWidth={1.8} aria-hidden="true" />
            <input type="search" className="search-input" value={query} onChange={e => setQuery(e.target.value)} placeholder="Buscar artículo por nombre, código o capítulo…" aria-label="Buscar en el catálogo" autoComplete="off" />
            {query && <button type="button" className="search-clear" aria-label="Borrar búsqueda" onClick={() => setQuery("")}><X size={15} strokeWidth={1.8} aria-hidden="true" /></button>}
          </label>
          <div className="chips chips-compact" role="group" aria-label="Capítulos del catálogo">
            <button type="button" className="chip" aria-pressed={capitulo === ""} onClick={() => setCapitulo("")}>Todos</button>
            {chapters.map(c => <button key={c} type="button" className="chip" aria-pressed={capitulo === c} onClick={() => setCapitulo(c)}>{c}</button>)}
          </div>
          <div className="pick-list">
            {encontrados.length === 0 && <p className="muted text-sm" style={{ padding: "10px 0" }}>{data.articles.length ? "Nada coincide. Puedes escribir una partida libre." : "El catálogo está vacío: añade artículos en Catálogo o escribe partidas libres."}</p>}
            {encontrados.map(a => (
              <button key={a.id} type="button" className="pick-row" onClick={() => addArticulo(a.id)}>
                <span style={{ minWidth: 0 }}><strong>{a.name}</strong><small className="muted">{a.chapter} · <span className="pl-mono">{a.code}</span></small></span>
                <span className="pl-mono text-sm">{money(a.unit_price)}<small className="muted"> / {a.unit}</small></span>
                <Plus size={16} strokeWidth={1.8} aria-hidden="true" />
              </button>
            ))}
          </div>
        </section>

        <section>
          <label className="field"><span>Notas y condiciones de la V{version.number}</span><textarea rows={4} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Plazos, exclusiones, forma de pago, lo que no se ha podido medir…" maxLength={5000} style={{ minHeight: 96 }} /></label>
        </section>
      </div>
    </Drawer>
  );
}
