import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireSuperadmin } from "@/lib/server/superadmin";
import { ApiError } from "@/lib/server/http";
import { evidenceUrl, deploymentLabel } from "@/lib/sistema/registro";
import styles from "../sistema.module.css";

export const dynamic = "force-dynamic";
export const metadata = { title: "Visita 360 · tecnología · PLANO", robots: { index: false, follow: false } };

/** Qué se usa en cada paso de la visita 360, qué se probó y cómo evolucionarlo. Revisado el 5 de noviembre de 2026. */
const pasos = [
  { nombre: "Foto 360", detalle: "Foto equirectangular (el doble de ancha que de alta), una por estancia. Las de ejemplo son de Poly Haven (CC0); las del proyecto se suben como documento «360 · Estancia» y se reducen a 4096 px. Sirve una cámara 360 o un móvil; no hace falta una app propia." },
  { nombre: "Visor", detalle: "three.js dibuja la foto en una esfera: arrastrar, ampliar y tocar. Las marcas de cada artículo se colocan en el punto tocado. No se pinta nada sobre la foto." },
  { nombre: "Medidas", detalle: "Se toman con un medidor láser y se dicen o escriben: «la cocina mide 4 por 3 y 2,6 de alto», «tiene una puerta y dos ventanas», o en el formulario «Medidas». Se aceptan decimales con coma, palabras («dos sesenta») y centímetros." },
  { nombre: "Cantidades", detalle: "Suelo y techo = largo × ancho. Paredes = perímetro × alto, menos 1,64 m² por puerta (0,80 × 2,05) y 1,44 m² por ventana (1,20 × 1,20). Rodapiés y molduras = perímetro menos 0,80 m por puerta. Si cambian las medidas, se recalcula lo que dependía de ellas. Sin medidas, la cantidad queda provisional (≈)." },
  { nombre: "Órdenes", detalle: "Dictado del navegador (Web Speech API, es-ES) u orden escrita. Un intérprete propio busca artículo, cantidad y estancia en el catálogo. No hay modelo de lenguaje: nada se inventa." },
  { nombre: "Guardado", detalle: "Marcas y medidas se guardan en el navegador hasta «Pasar al presupuesto», que crea las partidas en el borrador con los comandos de siempre. Aún no hay tabla de visitas en el servidor." }
];

const piezas = [
  { pieza: "three.js 0.186", uso: "Visor 360", licencia: "MIT", coste: "Gratis" },
  { pieza: "Intérprete de órdenes y medidas", uso: "Voz y texto a partidas y medidas", licencia: "Código propio", coste: "Gratis" },
  { pieza: "Web Speech API", uso: "Dictado", licencia: "Del navegador", coste: "Gratis. Chrome envía el audio a sus servidores para transcribirlo." },
  { pieza: "Medidor láser", uso: "Medidas de cada estancia", licencia: "—", coste: "Un medidor básico; sin app ni suscripción" }
];

const descartado = [
  { nombre: "Medir y pintar desde la foto (4 y 5 nov 2026)", detalle: "Se probó a detectar suelo, paredes y techo en la foto: primero marcando esquinas (PR 91), después con detección propia por color y con SAM 2.1 en el navegador (PR 92). Las medidas dependían de suponer la altura de la cámara y los bordes salían en escalones al pintar los materiales. Se retiró: las medidas salen del láser y la foto queda para situarse. El código sigue en el historial de git (PR 91 y 92)." },
  { nombre: "SAM 3 y 3.1 (Meta)", detalle: "Acceso restringido y aprobado a mano por Meta; licencia propia con uso comercial y exclusiones. Recorta mejor, pero no resuelve la medida ni la calidad del pintado." },
  { nombre: "Modelos de planta desde una foto 360 (HorizonNet y similares)", detalle: "Los pesos publicados se entrenaron con datos de uso académico (Zillow indica que ZInD no se licencia para fines comerciales)." }
];

const evolucion = [
  { nombre: "Simular la vista con IA", detalle: "Botón «Simular esta vista»: un modelo de edición de imagen (Gemini 3.1 Flash Image o Nano Banana 2.1, de pago: unos 3–7 céntimos por imagen) devuelve la foto con el material del catálogo. Es una simulación orientativa, no sirve para medir. La API de imagen de Gemini no tiene nivel gratuito; la de pago no usa los datos para mejorar sus productos. Necesita una ruta de servidor con la clave (área de backend)." },
  { nombre: "Guardar la visita en el servidor", detalle: "Tabla de visitas con fotos, medidas, marcas y procedencia de cada partida. Es trabajo de backend (Codex) con migración." },
  { nombre: "Escaneo LiDAR (opcional)", detalle: "Apple RoomPlan en iPhone o iPad Pro da paredes, puertas y ventanas con medidas. Exige una app nativa y un dispositivo con LiDAR (iPhone 17 Pro desde 1.319 €). Antes, comparar un escaneo con el metro en una obra real: Apple no publica la precisión." },
  { nombre: "Matterport con cámara 360 (opcional)", detalle: "Admite cámaras como Insta360 X5 o Ricoh Theta y da medidas automáticas con su propia app. Tiene plan gratuito; precisión y precios de pago por comprobar." }
];

const archivos = [
  { label: "Documento técnico", path: "docs/captura/visita-360.md" },
  { label: "Medidas y superficies", path: "src/lib/medidas.ts" },
  { label: "Órdenes y partidas", path: "src/lib/visita360.ts" },
  { label: "Visor", path: "src/lib/visor360.ts" },
  { label: "Pantalla", path: "src/components/capture/visita-360.tsx" }
];

export default async function Visita360Tecnica() {
  try {
    await requireSuperadmin();
  } catch (error) {
    if (!(error instanceof ApiError)) throw error;
    return <div className={`page ${styles.root}`}>
      <h1 className="h1">Visita 360 · tecnología</h1>
      <section className={styles.panel}>
        <h2 className="h2">Acceso reservado</h2>
        <p>Esta documentación solo está disponible para las cuentas autorizadas para supervisar PLANO.</p>
        <Link className={styles.link} href={error.status === 401 ? "/login" : "/mas"} prefetch={false}>{error.status === 401 ? "Iniciar sesión" : "Volver a Más"}</Link>
      </section>
    </div>;
  }
  const { commit } = deploymentLabel(process.env);
  return <div className={`page ${styles.root}`}>
    <header>
      <Link className={styles.link} href="/sistema" prefetch={false}><ArrowLeft size={15} strokeWidth={1.55} aria-hidden="true" />Supervisión del sistema</Link>
      <div className="eyebrow">Superadministración · documentación técnica</div>
      <h1 className="h1">Visita 360 · qué se usa y cómo evolucionarlo</h1>
      <p className="subtitle">Foto 360 para situarse, medidas con láser y partidas del catálogo. Revisado el 5 de noviembre de 2026.</p>
    </header>

    <nav className={styles.navigation} aria-label="Apartados">
      <a href="#cadena">Cómo funciona</a>
      <a href="#piezas">Piezas, licencias y coste</a>
      <a href="#descartado">Qué se probó y se descartó</a>
      <a href="#evolucion">Cómo evolucionarlo</a>
      <a href="#depurar">Revisar y depurar</a>
    </nav>

    <section id="cadena" className={styles.section} aria-labelledby="cadena-t">
      <h2 id="cadena-t" className="h2">Cómo funciona</h2>
      <ol className={styles.steps}>{pasos.map(p => <li key={p.nombre}><strong>{p.nombre}</strong><p>{p.detalle}</p></li>)}</ol>
    </section>

    <section id="piezas" className={styles.section} aria-labelledby="piezas-t">
      <h2 id="piezas-t" className="h2">Piezas, licencias y coste</h2>
      <div className={styles.capabilities}>
        {piezas.map(p => <div key={p.pieza} className={styles.panel}>
          <strong>{p.pieza}</strong>
          <p className="muted">{p.uso}</p>
          <p><span className={styles.badge}>{p.licencia}</span> {p.coste}</p>
        </div>)}
      </div>
    </section>

    <section id="descartado" className={styles.section} aria-labelledby="descartado-t">
      <h2 id="descartado-t" className="h2">Qué se probó y se descartó</h2>
      <ol className={styles.steps}>{descartado.map(p => <li key={p.nombre}><strong>{p.nombre}</strong><p>{p.detalle}</p></li>)}</ol>
    </section>

    <section id="evolucion" className={styles.section} aria-labelledby="evolucion-t">
      <h2 id="evolucion-t" className="h2">Cómo evolucionarlo</h2>
      <p className="muted">Por orden de lo que más mejora frente a lo que cuesta. El presupuesto siempre sale del catálogo y las medidas, de medir; la IA, si se usa, solo enseña.</p>
      <ol className={styles.steps}>{evolucion.map(p => <li key={p.nombre}><strong>{p.nombre}</strong><p>{p.detalle}</p></li>)}</ol>
    </section>

    <section id="depurar" className={styles.section} aria-labelledby="depurar-t">
      <h2 id="depurar-t" className="h2">Revisar y depurar</h2>
      <div className={styles.panel}>
        <ul>
          <li>Marcas y medidas de cada proyecto están en el navegador, en <code>localStorage</code>: <code>plano.visita360.&lt;proyecto&gt;</code> y <code>plano.visita360.&lt;proyecto&gt;.medidas</code>.</li>
          <li>Pruebas automáticas: <code>tests/medidas.test.ts</code> (frases y superficies) y <code>tests/visita360.test.ts</code> (órdenes y ticket).</li>
        </ul>
      </div>
      <div className={styles.sources}><span>Fuentes:</span>{archivos.map(a => <a key={a.path} href={evidenceUrl(a.path, commit)} target="_blank" rel="noreferrer">{a.label} ↗</a>)}</div>
    </section>
  </div>;
}
