"use client";
import { useEffect, useState, type FormEvent } from "react";
import { useWorkspace } from "@/components/workspace-provider";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { AlmacenArticulo } from "@/components/catalog/almacen-articulo";
import { can, type Article } from "@/lib/domain";
import { cantidadStock, estadoStock } from "@/lib/stock";

const numero = (t: string) => { const n = Number(t.trim().replace(",", ".")); return t.trim() !== "" && Number.isFinite(n) && n >= 0 ? n : null; };

/** Se puede llevar stock de un artículo y mover existencias. */
export const puedeLlevarStock = (role: Parameters<typeof can>[0]) => can(role, "article.update") && can(role, "stock.move");

/**
 * Stock de un artículo desde la tarjeta del catálogo, sin abrir la ficha. Si ya lleva stock: cifras, entrada, salida, recuento e historial.
 * Si no: empezar a llevarlo diciendo cuánto hay ahora en la nave (se marca «se guarda en almacén» y se apunta un recuento).
 */
export function StockRapido({ article, onClose }: { article: Article | null; onClose: () => void }) {
  const { data, send, notify, busy } = useWorkspace();
  const actual = article ? data.articles.find(a => a.id === article.id) ?? article : null;
  const [hay, setHay] = useState(""), [minimo, setMinimo] = useState(""), [donde, setDonde] = useState("");
  const [pendiente, setPendiente] = useState(false), [fallo, setFallo] = useState("");
  useEffect(() => { setHay(""); setMinimo(""); setDonde(""); setFallo(""); }, [article?.id]);

  async function empezar(e: FormEvent) {
    e.preventDefault();
    if (!actual || pendiente || busy) return;
    const q = numero(hay), m = minimo.trim() === "" ? null : numero(minimo);
    if (q === null) { setFallo("Escribe cuánto hay ahora, aunque sea 0."); return; }
    if (minimo.trim() !== "" && m === null) { setFallo("El mínimo tiene que ser un número."); return; }
    setPendiente(true); setFallo("");
    try {
      await send({ type: "article.update", id: actual.id, stocked: true, stock_min: m, stock_location: donde.trim() });
      await send({ type: "stock.move", article_id: actual.id, kind: "recuento", quantity: q, note: "Primer recuento" });
      notify(`${actual.name}: ${cantidadStock(q, actual.unit)} en almacén`);
    } catch (err) { setFallo(err instanceof Error ? err.message : "No se ha podido guardar el stock."); }
    finally { setPendiente(false); }
  }

  const e = actual?.stocked ? estadoStock(actual, data.purchases) : null;
  return <Modal open={Boolean(actual)} onClose={onClose} title={actual ? actual.name : ""} kicker={actual ? `Stock · ${actual.code}` : undefined}
    footer={actual?.stocked ? <Button variant="primary" onClick={onClose}>Hecho</Button> : <>
      <Button variant="secondary" onClick={onClose} disabled={pendiente}>Cancelar</Button>
      <Button variant="primary" type="submit" form="stock-rapido" disabled={pendiente || busy || hay.trim() === ""}>{pendiente ? "Guardando…" : "Empezar a llevar stock"}</Button>
    </>}>
    {actual?.stocked && e && <AlmacenArticulo article={actual} />}
    {actual && !actual.stocked && <form id="stock-rapido" className="form" onSubmit={empezar} style={{ maxWidth: "none" }}>
      <p className="muted text-sm" style={{ margin: 0 }}>Para material que se compra y se guarda en la nave. Desde ahora, recibir un pedido ligado a este artículo suma y llevarlo a obra resta.</p>
      <label className="field"><span>¿Cuánto hay ahora en la nave?</span><span className="unit-input"><input type="text" inputMode="decimal" value={hay} onChange={ev => setHay(ev.target.value)} placeholder="0" autoFocus required /><span>{actual.unit}</span></span></label>
      <div className="line-grid">
        <label className="field"><span>Avisar por debajo de</span><span className="unit-input"><input type="text" inputMode="decimal" value={minimo} onChange={ev => setMinimo(ev.target.value)} placeholder="Sin mínimo" /><span>{actual.unit}</span></span></label>
        <label className="field"><span>Dónde está</span><input type="text" value={donde} onChange={ev => setDonde(ev.target.value)} placeholder="Nave · estantería B" maxLength={120} /></label>
      </div>
      {fallo && <p role="alert" className="auth-error">{fallo}</p>}
    </form>}
  </Modal>;
}
