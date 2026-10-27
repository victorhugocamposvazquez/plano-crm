import { type Project, type Purchase } from "@/lib/domain";
import { lineasLegales, type Branding } from "@/lib/branding";
import { fechaDocumento } from "@/lib/documento-presupuesto";
import { estadoLinea, numeroHoja } from "@/lib/hoja-pedido";
import { DocBrand, estiloDocumento } from "@/components/documents/budget-document";

/**
 * Hoja de pedido para un proveedor: quién pide, para qué obra y dónde se entrega, las líneas con cantidad
 * y unidad, hueco para plazo y observaciones, y firma. Misma identidad que el presupuesto. A4.
 */
export function PurchaseOrderDocument({ branding, project, supplier, slug, items, fecha = new Date() }: { branding: Branding; project: Project; supplier: string; slug: string; items: Purchase[]; fecha?: Date }) {
  const contacto = [branding.phone, branding.email, branding.website].filter(Boolean).join(" · ");
  const legales = lineasLegales(branding);
  const nuevos = items.filter(i => i.status === "planned").length;
  const reclamados = items.length - nuevos;

  return (
    <div className="doc-pages" style={estiloDocumento(branding)}>
      <article className="doc">
        <header className="doc-head">
          <div style={{ minWidth: 0 }}>
            <DocBrand branding={branding} />
            {contacto && <span className="doc-contact">{contacto}</span>}
            <span className="doc-kicker">Hoja de pedido</span>
          </div>
          <div className="doc-number">
            <span className="pl-mono">{numeroHoja(project, slug, fecha)}</span>
            <small>{fechaDocumento(fecha.toISOString())}</small>
          </div>
        </header>

        <h1 className="doc-title">Pedido a {supplier}</h1>
        <dl className="doc-meta">
          <div><dt>Proveedor</dt><dd>{supplier}</dd></div>
          <div><dt>Obra</dt><dd>{project.name} · {project.code}</dd></div>
          <div><dt>Entregar en</dt><dd>{project.location || "Dirección de la obra pendiente de confirmar"}</dd></div>
          <div><dt>Contacto en obra</dt><dd>{branding.phone || branding.trade_name}</dd></div>
        </dl>

        <table className="doc-table">
          <thead>
            <tr><th style={{ width: 28 }}>#</th><th>Material</th><th className="num">Cantidad</th><th>Estado</th><th style={{ width: "22%" }}>Plazo / observaciones</th></tr>
          </thead>
          <tbody>
            {items.map((p, i) => (
              <tr key={p.id}>
                <td className="pl-mono">{i + 1}</td>
                <td>{p.name}</td>
                <td className="num pl-mono">{p.quantity} {p.unit}</td>
                <td><small style={{ display: "inline", color: p.status === "planned" ? "#111" : "#666" }}>{estadoLinea[p.status]}{p.status === "ordered" && p.received_quantity > 0 ? ` · recibido ${p.received_quantity}` : ""}</small></td>
                <td className="doc-blank" aria-hidden="true" />
              </tr>
            ))}
          </tbody>
        </table>
        <p className="doc-note">{items.length} líneas{reclamados ? ` · ${nuevos} nuevas y ${reclamados} ya pedidas, pendientes de recibir` : ""}. Precios según tarifa o presupuesto del proveedor; confirmad plazo de entrega y disponibilidad por línea.</p>

        <section className="doc-aside">
          <h2>Instrucciones de entrega</h2>
          <div className="doc-lines" aria-hidden="true"><span /><span /><span /></div>
        </section>

        <div className="doc-sign">
          <div><span>Pedido por {branding.trade_name}</span><small>Nombre, fecha y firma</small></div>
          <div><span>Confirmación del proveedor</span><small>Plazo de entrega y firma</small></div>
        </div>

        <footer className="doc-foot">
          <div className="doc-legal">
            {legales.map((l, i) => <span key={i}>{l}</span>)}
            <span>{project.code} · hoja de pedido · {supplier}</span>
          </div>
          <span className="doc-madewith">Hecho con <span className="pl-brand doc-brand" aria-label="Plano"><span className="pl-brand-text">PLANO</span></span></span>
        </footer>
      </article>
    </div>
  );
}
