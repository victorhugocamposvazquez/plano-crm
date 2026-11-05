"use client";
import { useState, type FormEvent } from "react";
import { useWorkspace } from "@/components/workspace-provider";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { can, dateLabel, type Article } from "@/lib/domain";
import { cantidadStock, estadoStock, movimientosDe, nombreMovimiento } from "@/lib/stock";

type Tipo = "entrada" | "salida" | "recuento";
const titulos: Record<Tipo, { boton: string; ayuda: string }> = {
  entrada: { boton: "Entrada", ayuda: "Lo que llega a la nave sin pedido de obra: compra para almacén, devolución…" },
  salida: { boton: "Salida", ayuda: "Lo que sale de la nave: a una obra, roto, devuelto al proveedor…" },
  recuento: { boton: "Recuento", ayuda: "Lo que hay de verdad al contarlo. Plano apunta la diferencia." }
};

/**
 * Existencias de un artículo de almacén en su ficha: cuánto hay, cuánto está reservado para obras, cuánto queda libre,
 * movimientos a mano (entrada, salida, recuento) y el historial. Lo de los pedidos de Materiales se apunta solo.
 */
export function AlmacenArticulo({ article }: { article: Article }) {
  const { data, actor, send, notify, busy } = useWorkspace();
  const puede = can(actor.role, "stock.move");
  const e = estadoStock(article, data.purchases);
  const movimientos = movimientosDe(article.id, data).slice(0, 8);
  const [tipo, setTipo] = useState<Tipo | null>(null);
  const [cantidad, setCantidad] = useState("");
  const [nota, setNota] = useState("");
  const [obra, setObra] = useState("");
  const [pending, setPending] = useState(false);
  const proyecto = (id: string | null) => (id ? data.projects.find(p => p.id === id)?.name : undefined);

  function abrir(t: Tipo) { setTipo(t); setCantidad(t === "recuento" ? String(e.enAlmacen).replace(".", ",") : ""); setNota(""); setObra(""); }
  async function mover(ev: FormEvent) {
    ev.preventDefault();
    if (!tipo || pending || busy) return;
    const q = Number(cantidad.replace(",", "."));
    if (!Number.isFinite(q) || q < 0) { notify("Indica una cantidad válida."); return; }
    setPending(true);
    try {
      await send({ type: "stock.move", article_id: article.id, kind: tipo, quantity: q, ...(nota.trim() ? { note: nota.trim() } : {}), ...(obra ? { project_id: obra } : {}) });
      notify(tipo === "recuento" ? `Recuento: ${cantidadStock(q, article.unit)} de ${article.name}` : `${titulos[tipo].boton} de ${cantidadStock(q, article.unit)}: ${article.name}`);
      setTipo(null);
    } catch (err) { notify(err instanceof Error ? err.message : "No se ha podido apuntar el movimiento."); }
    finally { setPending(false); }
  }

  return <section className="almacen" aria-label="Existencias en almacén">
    <dl className="almacen-cifras">
      <div><dt>En almacén</dt><dd className="pl-mono">{cantidadStock(e.enAlmacen, article.unit)}</dd></div>
      <div><dt>Reservado para obras</dt><dd className="pl-mono">{cantidadStock(e.reservado, article.unit)}</dd></div>
      <div data-tone={e.agotado ? "danger" : e.bajoMinimo ? "warning" : undefined}><dt>Libre</dt><dd className="pl-mono">{cantidadStock(e.libre, article.unit)}</dd></div>
    </dl>
    {(e.bajoMinimo || e.agotado) && <p className="almacen-aviso" role="status">{e.agotado ? "No queda libre." : `Por debajo del mínimo (${cantidadStock(e.minimo!, article.unit)}).`} Conviene pedir.</p>}
    {article.stock_location && <p className="muted text-sm" style={{ margin: 0 }}>Está en: {article.stock_location}</p>}

    {puede && !tipo && <div className="almacen-acciones">{(Object.keys(titulos) as Tipo[]).map(t => <Button key={t} onClick={() => abrir(t)} disabled={busy}>{titulos[t].boton}</Button>)}</div>}
    {puede && tipo && <form className="almacen-form" onSubmit={mover}>
      <p className="muted text-sm" style={{ margin: 0 }}>{titulos[tipo].ayuda}</p>
      <div className="line-grid">
        <label className="field"><span>{tipo === "recuento" ? "Hay ahora" : "Cantidad"}</span><span className="unit-input"><input type="text" inputMode="decimal" value={cantidad} onChange={ev => setCantidad(ev.target.value)} placeholder="0" required autoFocus /><span>{article.unit}</span></span></label>
        {tipo === "salida" && <div className="field"><span>Para la obra</span><Select label="Obra" value={obra} onChange={setObra} options={[{ value: "", label: "Ninguna" }, ...data.projects.filter(p => p.status !== "completed").map(p => ({ value: p.id, label: p.name }))]} placeholder="Ninguna" /></div>}
      </div>
      <label className="field"><span>Nota</span><input type="text" value={nota} onChange={ev => setNota(ev.target.value)} maxLength={300} placeholder={tipo === "recuento" ? "Inventario de fin de mes" : "Opcional"} /></label>
      <div className="almacen-acciones"><Button variant="secondary" onClick={() => setTipo(null)} disabled={pending}>Cancelar</Button><Button type="submit" variant="primary" disabled={pending || busy || cantidad.trim() === ""}>{pending ? "Guardando…" : `Apuntar ${titulos[tipo].boton.toLocaleLowerCase()}`}</Button></div>
    </form>}

    <div>
      <h3 className="almacen-titulo">Últimos movimientos</h3>
      {movimientos.length === 0 && <p className="muted text-sm" style={{ margin: 0 }}>Todavía no hay movimientos. Empieza con un recuento de lo que hay en la nave.</p>}
      {movimientos.length > 0 && <ul className="almacen-movimientos">{movimientos.map(m => <li key={m.id}>
        <span><strong>{nombreMovimiento[m.kind]}</strong><small className="muted">{dateLabel(m.created_at)} · {m.actor_name}{proyecto(m.project_id) ? ` · ${proyecto(m.project_id)}` : ""}{m.note ? ` · ${m.note}` : ""}</small></span>
        <span className="pl-mono" data-signo={m.quantity >= 0 ? "mas" : "menos"}>{m.quantity >= 0 ? "+" : "−"}{cantidadStock(Math.abs(m.quantity), article.unit)}</span>
        <span className="pl-mono muted">{cantidadStock(m.stock_after, article.unit)}</span>
      </li>)}</ul>}
    </div>
  </section>;
}
