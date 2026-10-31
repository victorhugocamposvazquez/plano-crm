"use client";
import { useEffect, useMemo, useState } from "react";
import { Check, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { SearchBox } from "@/components/ui/search-box";
import { useWorkspace } from "@/components/workspace-provider";
import { buscarTolerante } from "@/lib/busqueda";
import { capitulos } from "@/lib/catalogo";
import { partidaDesdeArticulo } from "@/lib/presupuesto";
import { money, type BudgetVersion, type Project } from "@/lib/domain";

const numero = (texto: string) => { const n = Number(texto.replace(",", ".")); return Number.isFinite(n) && n > 0 ? n : 0; };

/** Añadir del catálogo: buscas, marcas lo que entra y pones la cantidad. Todo acaba en el borrador abierto. */
export function CatalogPicker({ open, onClose, project, version }: { open: boolean; onClose: () => void; project: Project; version: BudgetVersion }) {
  const { data, busy, send, notify } = useWorkspace();
  const [query, setQuery] = useState("");
  const [categoria, setCategoria] = useState("");
  const [elegidos, setElegidos] = useState<Record<string, string>>({});
  const [guardando, setGuardando] = useState(false);
  useEffect(() => { if (open) { setElegidos({}); setQuery(""); setCategoria(""); } }, [open]);
  const categorias = useMemo(() => capitulos(data.articles), [data.articles]);
  const lista = useMemo(() => buscarTolerante(data.articles, query, a => `${a.code} ${a.name} ${a.chapter}`).filter(a => !categoria || a.chapter === categoria), [data.articles, query, categoria]);
  const vocabulario = useMemo(() => data.articles.flatMap(a => [a.name, a.chapter]), [data.articles]);
  const ids = Object.keys(elegidos);
  const validos = ids.filter(id => numero(elegidos[id]) > 0);
  const importe = validos.reduce((s, id) => s + Math.round((data.articles.find(a => a.id === id)?.unit_price ?? 0) * numero(elegidos[id])), 0);

  async function anadir() {
    if (guardando || busy || !validos.length) return;
    setGuardando(true);
    try {
      const nuevas = validos.flatMap(id => { const a = data.articles.find(x => x.id === id); return a ? [partidaDesdeArticulo(a, numero(elegidos[id]))] : []; });
      await send({ type: "budget.save", version_id: version.id, expected_revision: version.draft_revision, items: [...version.items, ...nuevas], notes: version.notes });
      notify(`${nuevas.length} ${nuevas.length === 1 ? "partida añadida" : "partidas añadidas"} a la V${version.number}`);
      onClose();
    } catch (e) { notify(e instanceof Error ? e.message : "No se han podido añadir las partidas."); }
    finally { setGuardando(false); }
  }

  return (
    <Modal open={open} onClose={onClose} size="wide" title="Añadir del catálogo" footer={<>
      <span className="picker-count">{ids.length ? <>{ids.length} {ids.length === 1 ? "artículo" : "artículos"} · <span className="pl-mono">{money(importe)}</span> sin IVA</> : "Marca los artículos que entran"}</span>
      <Button onClick={onClose} disabled={guardando}>Cancelar</Button>
      <Button variant="primary" onClick={anadir} disabled={!validos.length || validos.length !== ids.length || guardando || busy}>{guardando ? "Añadiendo…" : `Añadir a la V${version.number}`}</Button>
    </>}>
      <p className="muted text-sm" style={{ marginBottom: 10 }}>Al borrador V{version.number} · {project.name}</p>
      <SearchBox seccion="catalogo-presupuesto" value={query} onChange={setQuery} label="Buscar en el catálogo" placeholder="Busca lo que sea: material, medida, código…" count={`${lista.length} ${lista.length === 1 ? "artículo" : "artículos"}`} vocabulario={vocabulario} />
      <div className="picker-cats" role="group" aria-label="Categoría">
        <button type="button" className="search-chip" data-active={!categoria || undefined} onClick={() => setCategoria("")}>Todas</button>
        {categorias.map(c => <button key={c} type="button" className="search-chip" data-active={categoria === c || undefined} onClick={() => setCategoria(categoria === c ? "" : c)}>{c}</button>)}
      </div>
      {lista.length === 0 && <p className="muted text-sm" style={{ padding: "16px 0" }}>{data.articles.length ? "Nada coincide. Prueba con otra palabra o quita la categoría." : "El catálogo está vacío. Añade artículos desde Catálogo."}</p>}
      <div className="picker-grid">
        {lista.slice(0, 60).map(a => {
          const dentro = a.id in elegidos;
          return (
            <article key={a.id} className="picker-card" data-on={dentro || undefined}>
              <strong>{a.name}</strong>
              <small><span className="pl-mono">{a.code}</span> · {a.chapter}</small>
              <div className="picker-card-foot">
                <span className="pl-mono">{money(a.unit_price)}<small>/{a.unit}</small></span>
                <button type="button" className="picker-add" data-on={dentro || undefined} aria-pressed={dentro} onClick={() => setElegidos(prev => { const next = { ...prev }; if (dentro) delete next[a.id]; else next[a.id] = "1"; return next; })}>{dentro ? <Check size={14} strokeWidth={2.2} aria-hidden="true" /> : <Plus size={14} strokeWidth={2} aria-hidden="true" />}{dentro ? "Añadido" : "Añadir"}</button>
              </div>
              {dentro && <label className="picker-qty"><span>Cantidad</span><span className="unit-input"><input type="text" inputMode="decimal" value={elegidos[a.id]} onChange={e => setElegidos(prev => ({ ...prev, [a.id]: e.target.value }))} aria-label={`Cantidad de ${a.name}`} aria-invalid={numero(elegidos[a.id]) <= 0 || undefined} /><span>{a.unit}</span></span></label>}
            </article>
          );
        })}
      </div>
    </Modal>
  );
}
