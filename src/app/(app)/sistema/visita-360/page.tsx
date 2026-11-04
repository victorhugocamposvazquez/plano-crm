import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireSuperadmin } from "@/lib/server/superadmin";
import { ApiError } from "@/lib/server/http";
import { evidenceUrl, deploymentLabel } from "@/lib/sistema/registro";
import styles from "../sistema.module.css";

export const dynamic = "force-dynamic";
export const metadata = { title: "Visita 360 · tecnología · PLANO", robots: { index: false, follow: false } };

/** Qué se usa en cada paso de la visita 360, para poder evolucionarlo. Revisado el 5 de noviembre de 2026. */
const pasos = [
  { nombre: "Foto 360", detalle: "Foto equirectangular (el doble de ancha que de alta). Las de ejemplo son de Poly Haven (CC0); las del proyecto se suben como documento «360 · Estancia» y se reducen a 4096 px." },
  { nombre: "Visor", detalle: "three.js dibuja la foto en una esfera. Las superficies nuevas se pintan con un shader que multiplica el material por la luz desenfocada de la foto, para que conserve sombras y reflejos." },
  { nombre: "Detección por color (propia)", detalle: "Sin modelos: la foto pasa a color Lab y suelo, paredes y techo crecen a la vez desde puntos seguros, parando en los bordes. El rodapié y la moldura se buscan por programación dinámica. Tarda alrededor de un segundo y es el respaldo si SAM no está disponible." },
  { nombre: "SAM 2.1 en el navegador", detalle: "La panorámica se corta en seis vistas planas que se solapan. SAM codifica cada vista y recorta un segmento por cada punto de una rejilla de 8 × 8. Cada segmento toma la etiqueta que la detección por color da a la mayoría de sus píxeles; sin mayoría clara (un mueble, una ventana) se queda fuera. Las vistas se juntan y un filtro de mayoría limpia los bordes." },
  { nombre: "Toques", detalle: "Tocar una pared la recorta SAM con ese único punto, en la vista que mejor la ve («esta pared»). Tocar el suelo o el techo coge su parte conectada entera. En el retoque, un toque añade o quita lo tocado y se puede deshacer." },
  { nombre: "Medición", detalle: "Supone la cámara a 1,5 m del suelo. Suelo y techo: cada píxel se proyecta al plano. Paredes: distancia a la pared por el rodapié en cada columna y altura del techo estimada por la moldura. Las cantidades se marcan con ≈ y se revisan en el presupuesto." },
  { nombre: "Órdenes", detalle: "Dictado del navegador (Web Speech API, es-ES) u orden escrita. Un intérprete propio busca artículo, cantidad y estancia en el catálogo. No hay modelo de lenguaje: nada se inventa." },
  { nombre: "Guardado", detalle: "Las zonas se guardan comprimidas en el navegador hasta «Pasar al presupuesto», que crea las partidas en el borrador con los comandos de siempre. Aún no hay tabla de visitas en el servidor." }
];

const piezas = [
  { pieza: "SAM 2.1 hiera tiny (Meta)", uso: "Recortar superficies y toques", licencia: "Apache 2.0", coste: "Gratis. Se ejecuta en el navegador de quien usa Plano." },
  { pieza: "Modelo ONNX onnx-community/sam2.1-hiera-tiny-ONNX", uso: "SAM listo para el navegador", licencia: "Apache 2.0", coste: "Unos 77 MB con WebGPU (fp16). Se descarga de Hugging Face una vez y queda en caché." },
  { pieza: "transformers.js 4.3.2 y onnxruntime-web", uso: "Ejecutar el modelo con WebGPU o, si no hay, en el procesador", licencia: "Apache 2.0 y MIT", coste: "Gratis" },
  { pieza: "three.js 0.186", uso: "Visor 360 y pintado de materiales", licencia: "MIT", coste: "Gratis" },
  { pieza: "Detección por color y medición", uso: "Etiquetas, encuentros, medidas y respaldo", licencia: "Código propio", coste: "Gratis" },
  { pieza: "Web Speech API", uso: "Dictado de órdenes", licencia: "Del navegador", coste: "Gratis. Chrome envía el audio a sus servidores para transcribirlo." }
];

const rendimiento = [
  { caso: "Mac con Chrome y WebGPU (medido)", valor: "Unos 8 s por foto la primera vez; después, al instante" },
  { caso: "Detección por color sola (medido)", valor: "Alrededor de 1 s" },
  { caso: "Sin WebGPU (procesador)", valor: "Sin medir; previsiblemente bastante más lento" },
  { caso: "Móvil", valor: "Sin medir" }
];

const limites = [
  "Mide lo que se ve: el suelo que tapa un mueble no cuenta.",
  "Supone la cámara a 1,5 m. Si la foto se hizo a otra altura, las medidas se desvían en proporción.",
  "La etiqueta de cada segmento sale de la detección por color: si esta confunde una mesa con el suelo, SAM afina el borde pero no corrige el significado.",
  "Los azulejos de una pared cuentan como pared. Espejos, cristales y techos inclinados no están resueltos.",
  "Depende de que Hugging Face sirva el modelo la primera vez. Si falla, se usa la detección por color.",
  "Las zonas viven en el navegador hasta pasarlas al presupuesto."
];

const evolucion = [
  { nombre: "Alojar el modelo nosotros", detalle: "Copiar los archivos de SAM a nuestro almacenamiento para no depender de Hugging Face. Cambio pequeño en src/lib/sam.ts." },
  { nombre: "SAM 3.1 con texto", detalle: "Entiende «suelo», «ventana» o «puerta» sin depender de la detección por color. Licencia SAM de Meta: permite uso comercial con exclusiones; revisar el texto. Necesita tarjeta gráfica: servidor por segundos de uso (céntimos por foto, sin medir)." },
  { nombre: "Distribución de la estancia", detalle: "Un modelo de planta desde una foto 360 (HorizonNet u otro) mediría lo que tapan los muebles con paredes rectas. Comprobar antes la licencia de los pesos: varios se entrenaron con datos solo para investigación." },
  { nombre: "Guardar la visita en el servidor", detalle: "Tabla de visitas con foto, zonas y orígenes de cada partida. Es trabajo de backend (Codex) con migración." },
  { nombre: "Modelo de lenguaje para interpretar", detalle: "Para órdenes libres o leer la foto. Solo elige partidas del catálogo; medir y poner precio sigue siendo determinista." }
];

const archivos = [
  { label: "Documento técnico", path: "docs/captura/visita-360.md" },
  { label: "SAM en el navegador", path: "src/lib/sam.ts" },
  { label: "SAM sobre la foto 360", path: "src/lib/sam360.ts" },
  { label: "Vistas planas", path: "src/lib/vistas360.ts" },
  { label: "Detección por color y medición", path: "src/lib/autodeteccion.ts" },
  { label: "Visor", path: "src/lib/visor360.ts" },
  { label: "Órdenes y partidas", path: "src/lib/visita360.ts" },
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
      <p className="subtitle">Detección de suelo, paredes y techo en fotos 360, medición y materiales. Revisado el 5 de noviembre de 2026.</p>
    </header>

    <nav className={styles.navigation} aria-label="Apartados">
      <a href="#cadena">Cómo funciona</a>
      <a href="#piezas">Piezas, licencias y coste</a>
      <a href="#limites">Límites</a>
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
      <div className={styles.panel}>
        <strong>Rendimiento</strong>
        <ul>{rendimiento.map(r => <li key={r.caso}>{r.caso}: {r.valor}.</li>)}</ul>
      </div>
    </section>

    <section id="limites" className={styles.section} aria-labelledby="limites-t">
      <h2 id="limites-t" className="h2">Límites conocidos</h2>
      <div className={styles.panel}><ul>{limites.map(l => <li key={l}>{l}</li>)}</ul></div>
    </section>

    <section id="evolucion" className={styles.section} aria-labelledby="evolucion-t">
      <h2 id="evolucion-t" className="h2">Cómo evolucionarlo</h2>
      <p className="muted">Por orden de lo que más mejora frente a lo que cuesta. El presupuesto siempre sale del catálogo; los modelos solo detectan y recortan.</p>
      <ol className={styles.steps}>{evolucion.map(p => <li key={p.nombre}><strong>{p.nombre}</strong><p>{p.detalle}</p></li>)}</ol>
    </section>

    <section id="depurar" className={styles.section} aria-labelledby="depurar-t">
      <h2 id="depurar-t" className="h2">Revisar y depurar</h2>
      <div className={styles.panel}>
        <ul>
          <li>La escena de la visita lleva el atributo <code>data-deteccion</code> con el método usado y el tiempo: <code>sam-webgpu 8059ms</code> o <code>color …</code>.</li>
          <li>Si SAM no se usa, la consola del navegador dice por qué («Visita 360: …»).</li>
          <li>Con <code>?depurar</code> en la dirección de la visita, la consola tiene <code>window.__v360</code>: la foto, la segmentación por color, la de SAM, el modelo y las vistas.</li>
          <li>Pruebas automáticas: <code>tests/autodeteccion.test.ts</code>, <code>tests/sam360.test.ts</code> y <code>tests/visita360.test.ts</code>.</li>
        </ul>
      </div>
      <div className={styles.sources}><span>Fuentes:</span>{archivos.map(a => <a key={a.path} href={evidenceUrl(a.path, commit)} target="_blank" rel="noreferrer">{a.label} ↗</a>)}</div>
    </section>
  </div>;
}
