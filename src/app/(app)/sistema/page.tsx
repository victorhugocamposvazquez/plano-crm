import Link from "next/link";
import { requireSuperadmin } from "@/lib/server/superadmin";
import { ApiError } from "@/lib/server/http";
import { capabilities, commitUrl, deploymentLabel, documentationDate, evidenceUrl, productChanges, pullRequestUrl, statusLabels, supervisionSteps } from "@/lib/sistema/registro";
import styles from "./sistema.module.css";

export const dynamic = "force-dynamic";
export const metadata = { title: "Supervisión del sistema · PLANO", robots: { index: false, follow: false } };

export default async function SystemPage() {
  try {
    await requireSuperadmin();
  } catch (error) {
    if (!(error instanceof ApiError)) throw error;
    return <div className={`page ${styles.root}`}>
      <h1 className="h1">Supervisión del sistema</h1>
      <section className={styles.panel}>
        <h2 className="h2">Acceso reservado</h2>
        <p>Esta documentación solo está disponible para las cuentas autorizadas para supervisar PLANO. Administrar una empresa no concede este acceso.</p>
        <Link className={styles.link} href={error.status === 401 ? "/login" : "/mas"} prefetch={false}>{error.status === 401 ? "Iniciar sesión" : "Volver a Más"}</Link>
      </section>
    </div>;
  }

  const deployment = deploymentLabel(process.env);
  return <div className={`page ${styles.root}`}>
    <header>
      <div className="eyebrow">Superadministración</div>
      <h1 className="h1">Supervisión del sistema</h1>
      <p className="subtitle">Qué está listo, qué falta y cómo mejorar PLANO con control.</p>
    </header>

    <nav className={styles.navigation} aria-label="Documentación del sistema">
      <a href="#capacidades">Estado del producto</a>
      <a href="#cambios">Registro de cambios</a>
      <a href="#supervision">Correcciones supervisadas</a>
    </nav>

    <section className={styles.deployment} aria-label="Versión de este entorno">
      <strong>{deployment.environment}</strong>
      {deployment.commit ? <span>Código de este despliegue: <a href={commitUrl(deployment.commit)} target="_blank" rel="noreferrer"><code>{deployment.commit.slice(0, 8)}</code></a></span> : <span>Versión del despliegue no disponible.</span>}
      <span className="muted">Documentación revisada el {new Intl.DateTimeFormat("es-ES", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${documentationDate}T12:00:00Z`))}.</span>
    </section>

    <section id="capacidades" className={styles.section} aria-labelledby="capabilities-title">
      <div>
        <h2 id="capabilities-title" className="h2">Estado del producto</h2>
        <p className="muted">Estado documentado del código de esta entrega. No es una comprobación de producción ni de los servicios en tiempo real.</p>
        {!deployment.commit && <p className="muted">En local, los enlaces de fuentes apuntan a la rama de trabajo. Estarán disponibles en GitHub cuando se publique esa rama.</p>}
      </div>
      <div className={styles.capabilities}>
        {capabilities.map(capability => <details key={capability.id} className={styles.capability}>
          <summary>
            <span><strong>{capability.name}</strong><span className={styles.description}>{capability.summary}</span></span>
            <span className={styles.badge}>{statusLabels[capability.status]}</span>
          </summary>
          <div className={styles.capabilityBody}>
            <h3 className={styles.smallTitle}>Ya existe</h3>
            <ul>{capability.available.map(text => <li key={text}>{text}</li>)}</ul>
            <h3 className={styles.smallTitle}>Para completar o mejorar</h3>
            <ul>{capability.pending.map(text => <li key={text}>{text}</li>)}</ul>
            <div className={styles.sources}><span>Fuentes:</span>{capability.evidence.map(source => <a key={source.path} href={evidenceUrl(source.path, deployment.commit)} target="_blank" rel="noreferrer">{source.label} ↗</a>)}</div>
          </div>
        </details>)}
      </div>
    </section>

    <section id="cambios" className={styles.section} aria-labelledby="changes-title">
      <div>
        <h2 id="changes-title" className="h2">Registro de cambios</h2>
        <p className="muted">Cambios de software con su revisión y propuesta de integración. Su presencia aquí no confirma que una PR esté fusionada o publicada.</p>
      </div>
      <div className={styles.changes}>
        {productChanges.map(change => <article key={change.id} className={styles.change}>
          <time dateTime={change.date}>{change.date.split("-").reverse().join("/")}</time>
          <div>
            <h3>{change.title}</h3>
            <p>{change.impact}</p>
            <p className="muted">{change.limitation}</p>
            <div className={styles.changeLinks}>
              <a href={pullRequestUrl(change.pullRequest)} target="_blank" rel="noreferrer">Ver entrega #{change.pullRequest} ↗</a>
              <a href={commitUrl(change.commit)} target="_blank" rel="noreferrer">Revisión <code>{change.commit}</code> ↗</a>
            </div>
          </div>
        </article>)}
      </div>
      <p className="muted">Este registro describe el producto. Los cambios de presupuestos, tareas y documentos pertenecen a la actividad de cada proyecto.</p>
    </section>

    <section id="supervision" className={styles.section} aria-labelledby="supervision-title">
      <div>
        <h2 id="supervision-title" className="h2">Correcciones supervisadas</h2>
        <p>La IA podrá ayudar a diagnosticar y preparar mejoras. Una persona debe revisar y autorizar su publicación.</p>
      </div>
      <div className={styles.panel}>
        <strong>Estado actual: procedimiento definido, automatización pendiente.</strong>
        <p className="muted">Esta pantalla no detecta incidencias automáticamente, no las guarda ni ejecuta correcciones. Tampoco hay publicación automática por fallos.</p>
        <ol className={styles.steps}>{supervisionSteps.map(step => <li key={step.name}><strong>{step.name}</strong><p>{step.detail}</p></li>)}</ol>
      </div>
      <details className={styles.capability}>
        <summary><strong>Qué debe incluir una incidencia</strong></summary>
        <div className={styles.capabilityBody}>
          <ul>
            <li>Pantalla y pasos concretos para repetir el fallo.</li>
            <li>Resultado esperado y lo que ocurrió realmente.</li>
            <li>Fecha, dispositivo y versión del despliegue si está disponible.</li>
            <li>Impacto: bloqueo, cálculo, permisos o dificultad de uso.</li>
            <li>Responsable de revisión, prueba de aceptación y enlace al cambio.</li>
            <li>Resultado de la verificación y forma de revertir la corrección.</li>
          </ul>
          <p className="muted">Usar datos sintéticos para reproducirlo. Los archivos de clientes y los secretos no se adjuntan a incidencias públicas.</p>
        </div>
      </details>
    </section>
  </div>;
}
