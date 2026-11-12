import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { coloresCircuito as colorCircuito, coloresUso as colorUso, type EscenaEquipo, type EscenaPlanta, type EscenaTubo, type RGB } from "../planta3d";

export type PlantaCommand = "left" | "right" | "closer" | "farther";
export type PlantaSeleccion = { recinto?: string; equipo?: string };

const colorEquipo: RGB = [30, 200, 60];
/** Paleta de cámara térmica para la conversión: del violeta del congelado al naranja de lo que no se enfría. Contenido de la escena, no interfaz. */
const calor: Record<string, RGB> = { congelado: [96, 60, 255], refrigerado: [0, 170, 255], atemperado: [40, 220, 130], ambiente: [255, 176, 40], servicio: [255, 84, 48] };
const haz: RGB = [255, 70, 40];
export type PasoConversion = "barrido" | "muros" | "instalacion" | "fin";
const tramo = (t: number, desde: number, dura: number) => Math.min(1, Math.max(0, (t - desde) / dura));
const suave = (t: number) => t * t * (3 - 2 * t), frena = (t: number) => 1 - (1 - t) ** 3;
const color = (rgb: RGB) => new THREE.Color().setRGB(rgb[0] / 255, rgb[1] / 255, rgb[2] / 255, THREE.SRGBColorSpace);

function liberar(root: THREE.Object3D) {
  root.traverse(o => {
    const m = o as THREE.Mesh;
    if (m.geometry) m.geometry.dispose();
    for (const mat of m.material ? (Array.isArray(m.material) ? m.material : [m.material]) : []) { const mapa = (mat as THREE.SpriteMaterial).map; if (mapa) mapa.dispose(); mat.dispose(); }
  });
}

/** Rótulo que mira siempre a la cámara: nombre del recinto y sus datos, con la tinta del tema. */
function rotulo(titulo: string, detalle: string, tinta: string, fuente: string): THREE.Sprite {
  const lienzo = document.createElement("canvas"), escala = 2, w = 320, h = 76;
  lienzo.width = w * escala; lienzo.height = h * escala;
  const c = lienzo.getContext("2d")!;
  c.scale(escala, escala); c.textAlign = "center"; c.textBaseline = "middle"; c.fillStyle = tinta;
  c.font = `600 26px ${fuente}`; c.fillText(titulo, w / 2, 24, w - 8);
  c.font = `400 19px ${fuente}`; c.fillText(detalle, w / 2, 56, w - 8);
  const mapa = new THREE.CanvasTexture(lienzo); mapa.colorSpace = THREE.SRGBColorSpace; mapa.anisotropy = 4;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: mapa, transparent: true, depthTest: false }));
  s.renderOrder = 10; s.userData.proporcion = h / w;
  return s;
}

/**
 * Planta en 3D: cada recinto levantado a su altura, con suelo del color de su uso térmico, equipos y tuberías.
 * Pinta solo cuando cambia algo (cámara, tamaño, selección o instalación). La geometría no decide cantidades ni precios.
 */
export function createPlantaViewer(container: HTMLElement, escena: EscenaPlanta, onSelect: (s: PlantaSeleccion) => void) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "low-power" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2)); renderer.outputColorSpace = THREE.SRGBColorSpace;
  const canvas = renderer.domElement;
  canvas.setAttribute("role", "img"); canvas.setAttribute("aria-label", "Planta en tres dimensiones. También puedes elegir el recinto en la lista y usar los botones de vista."); canvas.tabIndex = 0;
  container.appendChild(canvas);
  // El lienzo es siempre el blanco de documento (`--pl-document-bg`), en los dos temas: los rótulos van en tinta oscura de escena, no en la del tema.
  const tinta = "rgb(22 35 46)", fuente = getComputedStyle(container).fontFamily || "sans-serif";

  const mundo = new THREE.Scene(), cx = escena.ancho / 2, cz = escena.fondo / 2, radio = Math.hypot(escena.ancho, escena.fondo) / 2;
  const camara = new THREE.PerspectiveCamera(42, 1, 0.5, radio * 20);
  const controles = new OrbitControls(camara, canvas);
  controles.enableDamping = false; controles.minDistance = 6; controles.maxDistance = radio * 7; controles.maxPolarAngle = Math.PI * 0.48; controles.screenSpacePanning = false;
  mundo.add(new THREE.HemisphereLight(color([255, 255, 255]), color([150, 150, 150]), 2.2));
  const sol = new THREE.DirectionalLight(color([255, 250, 240]), 1.6); sol.position.set(-radio, radio * 2, radio * 0.6); mundo.add(sol);

  type Alzado = { id: string; uso: string; grupo: THREE.Group; x0: number; suelo: THREE.MeshStandardMaterial; pared: THREE.MeshStandardMaterial; borde: THREE.LineBasicMaterial };
  const alzados: Alzado[] = [];
  const suelos: THREE.Mesh[] = [], paredes = new Map<string, THREE.MeshStandardMaterial>(), aristas = new Map<string, THREE.LineBasicMaterial>(), rotulos: THREE.Sprite[] = [];
  const fijo = new THREE.Group(); mundo.add(fijo);
  for (const r of escena.recintos) {
    const forma = new THREE.Shape(r.contorno.map(([x, z]) => new THREE.Vector2(x, z)));
    const base = color(colorUso[r.uso]);
    const suelo = new THREE.Mesh(new THREE.ShapeGeometry(forma), new THREE.MeshStandardMaterial({ color: base, roughness: 0.9, side: THREE.DoubleSide }));
    suelo.rotation.x = Math.PI / 2; suelo.userData.recinto = r.id; fijo.add(suelo); suelos.push(suelo);
    const pared = new THREE.MeshStandardMaterial({ color: base, roughness: 0.8, transparent: true, opacity: 0.2, side: THREE.DoubleSide, depthWrite: false }); paredes.set(r.id, pared);
    const borde = new THREE.LineBasicMaterial({ color: base.clone().multiplyScalar(0.55) }); aristas.set(r.id, borde);
    const puntos: number[] = [], caras: number[] = [];
    r.contorno.forEach(([x0, z0], i) => {
      const [x1, z1] = r.contorno[(i + 1) % r.contorno.length];
      caras.push(x0, 0, z0, x1, 0, z1, x1, r.alto, z1, x0, 0, z0, x1, r.alto, z1, x0, r.alto, z0);
      puntos.push(x0, r.alto, z0, x1, r.alto, z1, x0, 0, z0, x0, r.alto, z0, x0, 0.02, z0, x1, 0.02, z1);
    });
    const muro = new THREE.BufferGeometry(); muro.setAttribute("position", new THREE.Float32BufferAttribute(caras, 3)); muro.computeVertexNormals();
    const alzado = new THREE.Group(); fijo.add(alzado);
    alzado.add(new THREE.Mesh(muro, pared));
    const linea = new THREE.BufferGeometry(); linea.setAttribute("position", new THREE.Float32BufferAttribute(puntos, 3));
    alzado.add(new THREE.LineSegments(linea, borde));
    const xs = r.contorno.map(p => p[0]), zs = r.contorno.map(p => p[1]);
    alzados.push({ id: r.id, uso: r.uso, grupo: alzado, x0: Math.min(...xs), suelo: suelo.material as THREE.MeshStandardMaterial, pared, borde });
    const s = rotulo(r.nombre, r.rotulo, tinta, fuente);
    s.position.set((Math.min(...xs) + Math.max(...xs)) / 2, r.alto + 1.2, (Math.min(...zs) + Math.max(...zs)) / 2);
    s.userData.ancho = Math.min(Math.max(Math.max(...xs) - Math.min(...xs), 7), 13); s.scale.set(s.userData.ancho, s.userData.ancho * s.userData.proporcion, 1);
    // Los recintos pequeños (aseos, vestíbulos) no llevan rótulo en la escena: se pisarían. Sus datos salen al tocarlos.
    if (Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...zs) - Math.min(...zs)) < 6) { liberar(s); continue; }
    fijo.add(s); rotulos.push(s);
  }

  let instalacion = new THREE.Group(); mundo.add(instalacion);
  let cajas: THREE.Mesh[] = [], actual: PlantaSeleccion = {}, convirtiendo = false, cuadro = 0;
  function pintar() { renderer.render(mundo, camara); }
  /** Un solo movimiento a la vez: la conversión o un vuelo de cámara. Fuera de eso no hay bucle de pintado. */
  function animar(ms: number, paso: (t: number) => void, fin?: () => void) {
    cancelAnimationFrame(cuadro); const t0 = performance.now();
    const tic = (ahora: number) => { const t = Math.min(1, Math.max(0, (ahora - t0) / ms)); paso(t); pintar(); if (t < 1) cuadro = requestAnimationFrame(tic); else fin?.(); };
    cuadro = requestAnimationFrame(tic);
  }
  const quieto = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  function marcar() {
    for (const [id, m] of paredes) m.opacity = actual.recinto === id ? 0.42 : 0.2;
    for (const [id, m] of aristas) m.color.copy(color(actual.recinto === id ? [20, 20, 20] : colorUso[escena.recintos.find(r => r.id === id)!.uso])).multiplyScalar(actual.recinto === id ? 1 : 0.55);
    for (const c of cajas) { const m = c.material as THREE.MeshStandardMaterial; m.emissive.copy(color(c.userData.equipo === actual.equipo ? [255, 150, 30] : [0, 0, 0])); m.emissiveIntensity = c.userData.equipo === actual.equipo ? 0.9 : 0; }
  }
  /** Equipos y tuberías: lo presupuestado, macizo; lo que marca el plano y falta, en silueta. */
  function instalar(equipos: EscenaEquipo[], tubos: EscenaTubo[]) {
    mundo.remove(instalacion); liberar(instalacion); instalacion = new THREE.Group(); cajas = [];
    for (const e of equipos) {
      const w = e.caja[2] - e.caja[0], d = e.caja[3] - e.caja[1], h = 0.9, y = Math.max(e.alto - 1.1, h / 2 + 0.2);
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshStandardMaterial({ color: color(colorEquipo), roughness: 0.5, transparent: !e.puesto, opacity: e.puesto ? 1 : 0.16, depthWrite: e.puesto }));
      m.position.set((e.caja[0] + e.caja[2]) / 2, y, (e.caja[1] + e.caja[3]) / 2); m.userData.equipo = e.id; instalacion.add(m); cajas.push(m);
      const silueta = new THREE.LineSegments(new THREE.EdgesGeometry(m.geometry), new THREE.LineBasicMaterial({ color: color(colorEquipo).multiplyScalar(e.puesto ? 0.45 : 0.8) }));
      silueta.position.copy(m.position); instalacion.add(silueta);
      // Cuelgue hasta el techo, para leer la altura a la que va.
      if (e.puesto) for (const dx of [-w / 2 + 0.15, w / 2 - 0.15]) { const t = new THREE.Mesh(new THREE.BoxGeometry(0.06, e.alto - y - h / 2, 0.06), new THREE.MeshStandardMaterial({ color: color([90, 90, 90]) })); t.position.set(m.position.x + dx, (e.alto + y + h / 2) / 2, m.position.z); instalacion.add(t); }
    }
    // Las líneas de un mismo tramo se separan para que se distingan; el grosor acompaña al diámetro.
    const porTramo = new Map<string, number>();
    for (const t of tubos) {
      const clave = JSON.stringify(t.puntos), k = porTramo.get(clave) ?? 0; porTramo.set(clave, k + 1);
      const material = new THREE.MeshStandardMaterial({ color: color(colorCircuito[t.circuito]), roughness: 0.4, transparent: !t.puesto, opacity: t.puesto ? 1 : 0.22, depthWrite: t.puesto });
      const r = t.puesto ? 0.05 + t.grueso * 0.035 : 0.04, y = t.alto - k * 0.22;
      for (let i = 1; i < t.puntos.length; i++) {
        const a = new THREE.Vector3(t.puntos[i - 1][0], y, t.puntos[i - 1][1]), b = new THREE.Vector3(t.puntos[i][0], y, t.puntos[i][1]), largo = a.distanceTo(b);
        if (largo < 0.01) continue;
        const tubo = new THREE.Mesh(new THREE.CylinderGeometry(r, r, largo + r, 8), material);
        tubo.position.copy(a).add(b).multiplyScalar(0.5); tubo.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize()); instalacion.add(tubo);
      }
    }
    instalacion.visible = !convirtiendo; mundo.add(instalacion); marcar(); pintar();
  }

  function destino(recinto?: string) {
    const r = recinto ? escena.recintos.find(x => x.id === recinto) : undefined;
    // La distancia sale del campo de visión y de la proporción del lienzo: en vertical (móvil) hay que alejarse más para que quepa.
    const lejos = (talla: number) => talla / Math.tan(THREE.MathUtils.degToRad(camara.fov / 2)) / Math.min(1, camara.aspect);
    const desde = (objetivo: THREE.Vector3, d: number) => ({ objetivo, posicion: objetivo.clone().add(new THREE.Vector3(-0.32, 0.62, 0.72).normalize().multiplyScalar(Math.min(d, controles.maxDistance))) });
    if (!r) return desde(new THREE.Vector3(cx, 0, cz), lejos(radio) * 0.92);
    const xs = r.contorno.map(p => p[0]), zs = r.contorno.map(p => p[1]), mx = (Math.min(...xs) + Math.max(...xs)) / 2, mz = (Math.min(...zs) + Math.max(...zs)) / 2;
    const talla = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...zs) - Math.min(...zs), r.alto * 1.4, 10);
    return desde(new THREE.Vector3(mx, r.alto / 2, mz), lejos(talla * 0.9));
  }
  /** Lleva la cámara a la planta entera o a un recinto. Con `vuelo`, va volando en vez de saltar. */
  function encuadrar(recinto?: string, vuelo = false) {
    if (convirtiendo) return;
    const d = destino(recinto);
    if (!vuelo || quieto()) { cancelAnimationFrame(cuadro); controles.target.copy(d.objetivo); camara.position.copy(d.posicion); controles.update(); pintar(); return; }
    const o0 = controles.target.clone(), p0 = camara.position.clone();
    animar(650, t => { const k = suave(t); controles.target.lerpVectors(o0, d.objetivo, k); camara.position.lerpVectors(p0, d.posicion, k); camara.lookAt(controles.target); }, () => { controles.update(); pintar(); });
  }

  /**
   * Conversión de 2D a 3D: la planta empieza vista desde arriba, plana y en colores de cámara térmica; un haz la recorre,
   * los muros suben a su altura mientras la cámara se inclina, bajan los equipos y la escena vuelve a sus colores.
   * Solo mueve lo que ya está en la escena (sin sombras ni postproceso) y dura lo mismo en cualquier dispositivo.
   */
  function convertir(alPaso: (p: PasoConversion) => void, alTerminar: () => void) {
    if (quieto()) { alPaso("fin"); alTerminar(); return; }
    convirtiendo = true; controles.enabled = false; instalacion.visible = false;
    const fin = destino(), esf = new THREE.Spherical().setFromVector3(fin.posicion.clone().sub(fin.objetivo));
    const orden = [...alzados].sort((a, b) => a.x0 - b.x0), turno = new Map(orden.map((a, i) => [a.id, i / Math.max(1, orden.length - 1)]));
    const base = new Map(alzados.map(a => [a.id, { suelo: a.suelo.color.clone(), borde: a.borde.color.clone() }]));
    for (const a of alzados) { a.grupo.scale.y = 0.001; a.suelo.transparent = true; a.suelo.opacity = 0; a.suelo.color.copy(color(calor[a.uso])); a.pared.color.copy(color(calor[a.uso])); a.pared.blending = THREE.AdditiveBlending; a.pared.opacity = 0.34; a.borde.color.copy(color(calor[a.uso])); a.borde.transparent = true; a.borde.opacity = 0; }
    for (const r of rotulos) r.material.opacity = 0;
    const margen = radio * 0.15, luz = new THREE.Mesh(new THREE.PlaneGeometry(escena.fondo + margen * 2, escena.alto + 4), new THREE.MeshBasicMaterial({ color: color(haz), transparent: true, opacity: 0.3, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, depthWrite: false }));
    luz.rotation.y = Math.PI / 2; luz.position.set(-margen, (escena.alto + 4) / 2 - 1, cz);
    const raya = new THREE.Mesh(new THREE.PlaneGeometry(radio * 0.035, escena.fondo + margen * 2), new THREE.MeshBasicMaterial({ color: color([255, 150, 110]), transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, depthWrite: false }));
    raya.rotation.x = -Math.PI / 2; raya.position.set(-margen, 0.06, cz);
    mundo.add(luz, raya);
    const total = 5200; let dicho: PasoConversion | null = null;
    const di = (p: PasoConversion) => { if (dicho !== p) { dicho = p; alPaso(p); } };
    animar(total, t => {
      const s = t * total, b = tramo(s, 0, 1700), x = -margen + (escena.ancho + margen * 2) * b;
      luz.position.x = raya.position.x = x; luz.visible = raya.visible = b < 1;
      const c = suave(tramo(s, 1100, 2500));
      camara.position.setFromSpherical(new THREE.Spherical(esf.radius, 0.02 + (esf.phi - 0.02) * c, esf.theta * c)).add(fin.objetivo); camara.lookAt(fin.objetivo);
      const f = suave(tramo(s, 4300, 900));
      for (const a of alzados) {
        const visto = tramo(x - a.x0, 0, escena.ancho * 0.06), k = turno.get(a.id) ?? 0, ini = base.get(a.id)!;
        a.suelo.opacity = visto * (0.55 + 0.45 * f); a.borde.opacity = visto;
        a.grupo.scale.y = Math.max(0.001, frena(tramo(s, 1300 + k * 1100, 900)));
        a.suelo.color.copy(color(calor[a.uso])).lerp(ini.suelo, f); a.borde.color.copy(color(calor[a.uso])).lerp(ini.borde, f); a.pared.color.copy(color(calor[a.uso])).lerp(ini.suelo, f);
        a.pared.blending = f < 0.5 ? THREE.AdditiveBlending : THREE.NormalBlending; a.pared.opacity = 0.34 + (0.2 - 0.34) * f;
      }
      const cae = tramo(s, 3300, 900); instalacion.visible = cae > 0; instalacion.position.y = (1 - frena(cae)) * escena.alto * 0.7;
      for (const r of rotulos) r.material.opacity = f;
      di(s < 1300 ? "barrido" : s < 3300 ? "muros" : s < 4300 ? "instalacion" : "fin");
    }, () => {
      mundo.remove(luz, raya); liberar(luz); liberar(raya);
      for (const a of alzados) { a.grupo.scale.y = 1; a.suelo.transparent = false; a.suelo.opacity = 1; a.suelo.color.copy(base.get(a.id)!.suelo); a.pared.blending = THREE.NormalBlending; a.borde.transparent = false; a.borde.opacity = 1; }
      instalacion.position.y = 0; instalacion.visible = true; convirtiendo = false; controles.enabled = true;
      controles.target.copy(fin.objetivo); camara.position.copy(fin.posicion); controles.update(); marcar(); pintar(); alTerminar();
    });
  }

  function medir() {
    const w = container.clientWidth || 1, h = container.clientHeight || 1;
    renderer.setSize(w, h, false); camara.aspect = w / h; camara.updateProjectionMatrix(); pintar();
  }
  const observador = new ResizeObserver(medir); observador.observe(container);
  controles.addEventListener("change", pintar);

  // Un toque elige; arrastrar mueve la cámara.
  let abajo: { x: number; y: number } | null = null;
  const rayo = new THREE.Raycaster();
  const alBajar = (e: PointerEvent) => { abajo = { x: e.clientX, y: e.clientY }; };
  const alSubir = (e: PointerEvent) => {
    if (!abajo || Math.hypot(e.clientX - abajo.x, e.clientY - abajo.y) > 6) { abajo = null; return; }
    abajo = null;
    const caja = canvas.getBoundingClientRect();
    rayo.setFromCamera(new THREE.Vector2((e.clientX - caja.left) / caja.width * 2 - 1, -((e.clientY - caja.top) / caja.height) * 2 + 1), camara);
    const equipo = rayo.intersectObjects(cajas, false)[0];
    if (equipo) { onSelect({ equipo: equipo.object.userData.equipo }); return; }
    const suelo = rayo.intersectObjects(suelos, false)[0];
    if (suelo) onSelect({ recinto: suelo.object.userData.recinto });
  };
  canvas.addEventListener("pointerdown", alBajar); canvas.addEventListener("pointerup", alSubir);

  medir(); encuadrar();
  return {
    instalar,
    seleccionar(s: PlantaSeleccion) { actual = s; marcar(); pintar(); },
    view: (recinto?: string) => encuadrar(recinto, true),
    convertir,
    command(c: PlantaCommand) {
      const d = camara.position.clone().sub(controles.target);
      if (c === "left" || c === "right") d.applyAxisAngle(new THREE.Vector3(0, 1, 0), (c === "left" ? 1 : -1) * Math.PI / 8);
      else d.multiplyScalar(c === "closer" ? 0.75 : 1.3).clampLength(controles.minDistance, controles.maxDistance);
      camara.position.copy(controles.target).add(d); controles.update(); pintar();
    },
    dispose() {
      cancelAnimationFrame(cuadro); observador.disconnect(); controles.dispose(); canvas.removeEventListener("pointerdown", alBajar); canvas.removeEventListener("pointerup", alSubir);
      liberar(mundo); renderer.dispose(); renderer.forceContextLoss(); canvas.remove();
    }
  };
}
