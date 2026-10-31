import type { CSSProperties } from "react";
import { money, totals, lineTotal, kindNames, type Budget, type BudgetVersion, type Project } from "@/lib/domain";
import { capitulosDocumento, alternativas, excluidas, numeroDocumento, desgloseIva, estadoDocumento, fechaDocumento, unidadLarga } from "@/lib/documento-presupuesto";
import { lineasLegales, textoSobre, type Branding } from "@/lib/branding";
import { presentacionVacia, type Presentacion } from "@/lib/presentacion";

/** Variables de color del documento a partir de la identidad de la organización. */
export function estiloDocumento(branding: Branding): CSSProperties {
  return { "--doc-primary": branding.primary_color, "--doc-accent": branding.accent_color, "--doc-on-primary": textoSobre(branding.primary_color) } as CSSProperties;
}

/** Cabecera de marca: logo si lo hay, si no el nombre comercial como marca tipográfica. */
export function DocBrand({ branding, size = "md" }: { branding: Branding; size?: "md" | "lg" }) {
  if (branding.logo_data_url) return <img src={branding.logo_data_url} alt={branding.trade_name} className="doc-logo" data-size={size} />;
  return <strong className="doc-issuer" data-size={size}>{branding.trade_name || "Tu empresa"}</strong>;
}

const dos = (n: number) => String(n).padStart(2, "0");

/**
 * Presupuesto tal y como se entrega al cliente, con la identidad de la organización y la presentación
 * propia de este presupuesto (logo del cliente, portada, carta). Portada opcional, cabecera con logo y
 * contacto, carta de presentación, resumen por capítulos, partidas numeradas, alternativas y exclusiones
 * aparte, totales con desglose de IVA, condiciones, aceptación, firmas y pie legal. Pensado para A4.
 */
export function BudgetDocument({ branding, project, budget, version, ambito, cover, presentacion = presentacionVacia }: { branding: Branding; project: Project; budget: Budget; version: BudgetVersion; ambito?: number; cover?: boolean; presentacion?: Presentacion }) {
  const capitulos = capitulosDocumento(version.items);
  const opcionales = alternativas(version.items);
  const fuera = excluidas(version.items);
  const t = totals(version.items);
  const iva = desgloseIva(version.items);
  const borrador = version.status === "draft";
  const fecha = fechaDocumento(version.status === "approved" && version.approved_at ? version.approved_at : version.updated_at);
  const contacto = [branding.phone, branding.email, branding.website].filter(Boolean).join(" · ");
  const legales = lineasLegales(branding);
  const numero = numeroDocumento(project, version, ambito);
  const portadaImagen = presentacion.cover_image_data_url || branding.cover_image_data_url;
  const tituloPortada = presentacion.cover_title.trim() || budget.title;
  const mayor = Math.max(1, ...capitulos.map(c => c.subtotal));

  return (
    <div className="doc-pages" style={estiloDocumento(branding)}>
      {cover && (
        <section className="doc doc-cover" data-image={Boolean(portadaImagen)} style={portadaImagen ? { backgroundImage: `url(${portadaImagen})` } : undefined}>
          <div className="doc-cover-top">
            <DocBrand branding={branding} size="lg" />
            {presentacion.client_logo_data_url && <span className="doc-cover-for"><small>para</small><img src={presentacion.client_logo_data_url} alt={project.client_name} className="doc-client-logo" data-size="lg" /></span>}
          </div>
          <div className="doc-cover-body">
            <span className="doc-cover-kicker">{estadoDocumento(version)}</span>
            <h1>{tituloPortada}</h1>
            <p className="doc-cover-client">{project.client_name}</p>
            <p>{project.name}{project.location ? ` · ${project.location}` : ""}</p>
          </div>
          <div className="doc-cover-foot">
            <span className="pl-mono">{numero} · {fecha}</span>
            {branding.cover_claim && <span className="doc-cover-claim">{branding.cover_claim}</span>}
          </div>
        </section>
      )}

      <article className="doc" data-draft={borrador}>
        <header className="doc-head">
          <div style={{ minWidth: 0 }}>
            <DocBrand branding={branding} />
            {contacto && <span className="doc-contact">{contacto}</span>}
            <span className="doc-kicker">{estadoDocumento(version)}</span>
          </div>
          <div className="doc-number">
            <span className="pl-mono">{numero}</span>
            <small>{fecha}</small>
          </div>
        </header>

        <h1 className="doc-title">{budget.title}</h1>
        <dl className="doc-meta" data-client-logo={Boolean(presentacion.client_logo_data_url)}>
          <div><dt>Cliente</dt><dd>{project.client_name}</dd></div>
          <div><dt>Obra</dt><dd>{project.name}{project.location ? ` · ${project.location}` : ""}</dd></div>
          <div><dt>Tipo</dt><dd>{kindNames[project.kind]}</dd></div>
          <div><dt>Versión</dt><dd>V{version.number} · {version.change_reason}</dd></div>
          {presentacion.client_logo_data_url && <div className="doc-meta-logo"><img src={presentacion.client_logo_data_url} alt="" className="doc-client-logo" /></div>}
        </dl>

        {presentacion.intro.trim() && (
          <section className="doc-intro">
            <p>{presentacion.intro.trim()}</p>
            <span className="doc-intro-sign">{branding.trade_name}</span>
          </section>
        )}

        {capitulos.length > 1 && (
          <section className="doc-summary">
            <h2>Resumen por capítulos</h2>
            <ol>
              {capitulos.map((c, i) => (
                <li key={c.chapter}>
                  <span className="pl-mono doc-chapter-no">{dos(i + 1)}</span>
                  <span className="doc-summary-name">{c.chapter}</span>
                  <span className="doc-summary-bar" aria-hidden="true"><i style={{ width: `${Math.round((c.subtotal / mayor) * 100)}%` }} /></span>
                  <span className="pl-mono num">{money(c.subtotal)}</span>
                </li>
              ))}
            </ol>
            <div className="doc-summary-total"><span>Base imponible</span><strong className="pl-mono">{money(t.base)}</strong></div>
          </section>
        )}

        <table className="doc-table">
          <thead>
            <tr><th>Partida</th><th className="num">Cantidad</th><th className="num">Precio</th><th className="num">Importe</th></tr>
          </thead>
          {capitulos.map((c, i) => (
            <tbody key={c.chapter}>
              <tr className="doc-chapter"><th colSpan={3}><span className="pl-mono doc-chapter-no">{dos(i + 1)}</span>{c.chapter}</th><td className="num pl-mono">{money(c.subtotal)}</td></tr>
              {c.items.map((item, j) => (
                <tr key={item.id}>
                  <td><span className="pl-mono doc-item-no">{dos(i + 1)}.{dos(j + 1)}</span>{item.description}{item.adjustment_percent ? <small> · ajuste {item.adjustment_percent > 0 ? "+" : ""}{item.adjustment_percent} %</small> : null}</td>
                  <td className="num pl-mono">{item.quantity} {unidadLarga[item.unit]}</td>
                  <td className="num pl-mono">{money(item.unit_price)}</td>
                  <td className="num pl-mono">{money(lineTotal(item))}</td>
                </tr>
              ))}
            </tbody>
          ))}
        </table>

        <div className="doc-totals">
          <div><span>Base imponible</span><strong className="pl-mono">{money(t.base)}</strong></div>
          {iva.map(x => <div key={x.rate}><span>IVA {x.rate} % sobre {money(x.base)}</span><strong className="pl-mono">{money(x.cuota)}</strong></div>)}
          <div className="doc-total"><span>Total</span><strong className="pl-mono">{money(t.total)}</strong></div>
        </div>

        {opcionales.length > 0 && (
          <section className="doc-aside">
            <h2>Alternativas <small>· no incluidas en el total, a elección del cliente</small></h2>
            <table className="doc-table doc-table-compact"><tbody>
              {opcionales.map(item => <tr key={item.id}><td>{item.description}<small> · {item.chapter}</small></td><td className="num pl-mono">{item.quantity} {unidadLarga[item.unit]}</td><td className="num pl-mono">{money(item.unit_price)}</td><td className="num pl-mono">{money(lineTotal(item))}</td></tr>)}
            </tbody></table>
          </section>
        )}

        {fuera.length > 0 && (
          <section className="doc-aside">
            <h2>Queda fuera de este presupuesto</h2>
            <ul>{fuera.map(item => <li key={item.id}>{item.description}</li>)}</ul>
          </section>
        )}

        {version.notes && (
          <section className="doc-aside">
            <h2>Notas y condiciones de este presupuesto</h2>
            <p>{version.notes}</p>
          </section>
        )}

        {branding.default_terms && (
          <section className="doc-aside doc-terms">
            <h2>Condiciones generales</h2>
            <p>{branding.default_terms}</p>
          </section>
        )}

        {version.status === "approved" && version.approval_reference && (
          <section className="doc-aside">
            <h2>Aceptación</h2>
            <p>Aceptado el {fechaDocumento(version.approved_at ?? version.updated_at)} · {version.approval_reference}</p>
          </section>
        )}

        {!borrador && (
          <div className="doc-sign">
            <div><span>Por {branding.trade_name}</span></div>
            <div><span>Conforme, el cliente</span><small>Nombre, fecha y firma</small></div>
          </div>
        )}

        <footer className="doc-foot">
          <div className="doc-legal">
            {legales.map((l, i) => <span key={i}>{l}</span>)}
            <span>{project.code} · V{version.number}{borrador ? " · borrador de trabajo, sin validez como oferta" : ""}</span>
          </div>
          <span className="doc-madewith">Hecho con <span className="pl-brand doc-brand" aria-label="Plano"><span className="pl-brand-text">PLANO</span></span></span>
        </footer>
      </article>
    </div>
  );
}
