import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { coloresCircuito as colorCircuito, coloresUso as colorUso, type EscenaEquipo, type EscenaPlanta, type EscenaTubo, type RGB } from "../planta3d";

export type PlantaCommand = "left" | "right" | "closer" | "farther";
export type PlantaSeleccion = { recinto?: string; equipo?: string };

const colorEquipo: RGB = [30, 200, 60];
/** Paleta de cámara térmica para la conversión: del violeta del congelado al naranja de lo que no se enfría. Contenido de la escena, no interfaz. */
const calor: Record<string, RGB> = { congelado: [96, 60, 255], refrigerado: [0, 170, 255], atemperado: [40, 220, 130], ambiente: [255, 176, 40], servicio: [255, 84, 48] };
const haz: RGB = [255, 70, 40];
/** El plano en 2D como textura de suelo durante la conversión; `caja` en metros de la escena. */
export type LaminaEscena = { lienzo: HTMLCanvasElement; caja: [number, number, number, number] };
export type PasoConversion = "barrido" | "muros" | "tuberias" | "equipos" | "fin";
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
    s.userData.titulo = r.nombre; s.userData.detalle = r.rotulo; s.userData.recinto = r.id; s.userData.alto = r.alto;
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
      m.position.set((e.caja[0] + e.caja[2]) / 2, y, (e.caja[1] + e.caja[3]) / 2); m.userData.equipo = e.id; const pieza = new THREE.Group(); pieza.userData.pieza = true; instalacion.add(pieza); pieza.add(m); cajas.push(m);
      const silueta = new THREE.LineSegments(new THREE.EdgesGeometry(m.geometry), new THREE.LineBasicMaterial({ color: color(colorEquipo).multiplyScalar(e.puesto ? 0.45 : 0.8) }));
      silueta.position.copy(m.position); pieza.add(silueta);
      // Cuelgue hasta el techo, para leer la altura a la que va.
      if (e.puesto) for (const dx of [-w / 2 + 0.15, w / 2 - 0.15]) { const t = new THREE.Mesh(new THREE.BoxGeometry(0.06, e.alto - y - h / 2, 0.06), new THREE.MeshStandardMaterial({ color: color([90, 90, 90]) })); t.position.set(m.position.x + dx, (e.alto + y + h / 2) / 2, m.position.z); pieza.add(t); }
    }
    // Las líneas de un mismo haz van una al lado de otra, a la misma altura, para que se vean todas desde arriba.
    // Gruesas a propósito: a escala real un tubo de 35 mm no se vería con la planta entera en pantalla.
    for (const t of tubos) {
      const material = new THREE.MeshStandardMaterial({ color: color(colorCircuito[t.circuito]), roughness: 0.4, transparent: !t.puesto, opacity: t.puesto ? 1 : 0.7, depthWrite: t.puesto });
      const r = (t.puesto ? 0.13 : 0.1) + t.grueso * 0.05, y = t.alto, paso = 0.42;
      for (let i = 1; i < t.puntos.length; i++) {
        const dx = t.puntos[i][0] - t.puntos[i - 1][0], dz = t.puntos[i][1] - t.puntos[i - 1][1], largo = Math.hypot(dx, dz);
        if (largo < 0.01) continue;
        const ox = -dz / largo * t.carril * paso, oz = dx / largo * t.carril * paso;
        const a = new THREE.Vector3(t.puntos[i - 1][0] + ox, y, t.puntos[i - 1][1] + oz), b = new THREE.Vector3(t.puntos[i][0] + ox, y, t.puntos[i][1] + oz);
        const tubo = new THREE.Mesh(new THREE.CylinderGeometry(r, r, largo + paso * 2, 8), material);
        tubo.position.copy(a).add(b).multiplyScalar(0.5); tubo.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize()); tubo.userData.tubo = true; instalacion.add(tubo);
      }
    }
    mundo.add(instalacion); marcar(); pintar();
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
   * Conversión de 2D a 3D, rodada como un plano secuencia: la cámara arranca cerca y en vertical sobre la planta en colores de cámara térmica,
   * un haz y dos ondas la recorren, y mientras la cámara sube en espiral los muros crecen como una nube de puntos de escáner con el canto encendido.
   * Luego las tuberías se trazan una a una, caen los equipos y un destello devuelve la escena a sus colores.
   * Todo es geometría ligera (líneas, puntos y planos aditivos), sin sombras ni postproceso, y dura lo mismo en cualquier dispositivo.
   */
  function convertir(alPaso: (p: PasoConversion, reconocidos: number, ultimo: string) => void, alTerminar: () => void, lamina?: LaminaEscena) {
    if (quieto()) { alPaso("fin", alzados.length, ""); alTerminar(); return; }
    convirtiendo = true; controles.enabled = false;
    const fin = destino(), esf = new THREE.Spherical().setFromVector3(fin.posicion.clone().sub(fin.objetivo));
    const orden = [...alzados].sort((a, b) => a.x0 - b.x0), turno = new Map(orden.map((a, i) => [a.id, i / Math.max(1, orden.length - 1)]));
    const base = new Map(alzados.map(a => [a.id, { suelo: a.suelo.color.clone(), borde: a.borde.color.clone() }]));
    const efimero = new THREE.Group(); mundo.add(efimero);
    const brillo = (c: RGB, opacity: number) => ({ color: color(c), transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false });
    // Nube de puntos y canto encendido de cada recinto: van dentro de su alzado para crecer con él.
    const extras: { nube: THREE.PointsMaterial; canto: THREE.LineBasicMaterial; objetos: THREE.Object3D[] }[] = [];
    const presupuesto = Math.max(40, Math.floor(7000 / Math.max(1, escena.recintos.length)));
    for (const a of alzados) {
      const r = escena.recintos.find(x => x.id === a.id)!, perimetro = r.contorno.reduce((t, p, i) => { const q = r.contorno[(i + 1) % r.contorno.length]; return t + Math.hypot(q[0] - p[0], q[1] - p[1]); }, 0);
      const n = Math.min(presupuesto, Math.ceil(perimetro * r.alto * 1.6)), pos = new Float32Array(n * 3), arriba: number[] = [];
      for (let i = 0; i < n; i++) {
        let d = Math.random() * perimetro, k = 0;
        for (; k < r.contorno.length - 1; k++) { const p = r.contorno[k], q = r.contorno[k + 1], l = Math.hypot(q[0] - p[0], q[1] - p[1]); if (d <= l) break; d -= l; }
        const p = r.contorno[k], q = r.contorno[(k + 1) % r.contorno.length], l = Math.hypot(q[0] - p[0], q[1] - p[1]) || 1;
        pos[i * 3] = p[0] + (q[0] - p[0]) * d / l; pos[i * 3 + 1] = Math.random() * r.alto; pos[i * 3 + 2] = p[1] + (q[1] - p[1]) * d / l;
      }
      r.contorno.forEach(([x0, z0], i) => { const [x1, z1] = r.contorno[(i + 1) % r.contorno.length]; arriba.push(x0, r.alto, z0, x1, r.alto, z1); });
      const gn = new THREE.BufferGeometry(); gn.setAttribute("position", new THREE.BufferAttribute(pos, 3));
      const nube = new THREE.PointsMaterial({ ...brillo(calor[a.uso], 0), size: 2.2, sizeAttenuation: false });
      const gc = new THREE.BufferGeometry(); gc.setAttribute("position", new THREE.Float32BufferAttribute(arriba, 3));
      const canto = new THREE.LineBasicMaterial(brillo([255, 236, 220], 0));
      const objetos = [new THREE.Points(gn, nube), new THREE.LineSegments(gc, canto)]; a.grupo.add(...objetos); extras.push({ nube, canto, objetos });
      a.grupo.scale.y = 0.001; a.suelo.transparent = true; a.suelo.opacity = 0; a.suelo.color.copy(color(calor[a.uso])); a.pared.color.copy(color(calor[a.uso])); a.pared.blending = THREE.AdditiveBlending; a.pared.opacity = 0; a.borde.color.copy(color(calor[a.uso])); a.borde.transparent = true; a.borde.opacity = 0;
    }
    for (const r of rotulos) r.material.opacity = 0;
    // El plano en 2D tendido en el suelo: la conversión empieza leyéndolo y los muros nacen de sus líneas.
    let papel: THREE.MeshBasicMaterial | null = null;
    if (lamina) {
      const mapa = new THREE.CanvasTexture(lamina.lienzo); mapa.colorSpace = THREE.SRGBColorSpace; mapa.anisotropy = 4;
      papel = new THREE.MeshBasicMaterial({ map: mapa, transparent: true, opacity: 0, depthWrite: false });
      const hoja = new THREE.Mesh(new THREE.PlaneGeometry(lamina.caja[2] - lamina.caja[0], lamina.caja[3] - lamina.caja[1]), papel);
      hoja.rotation.x = -Math.PI / 2; hoja.position.set((lamina.caja[0] + lamina.caja[2]) / 2, 0.03, (lamina.caja[1] + lamina.caja[3]) / 2); hoja.renderOrder = 2; efimero.add(hoja);
    }
    // Etiqueta de «reconocido» de cada recinto con rótulo: aparece cuando el haz pasa por él y sube con sus muros.
    const etiquetas = rotulos.map(r => { const e = new THREE.Sprite(new THREE.SpriteMaterial({ map: rotulo(r.userData.titulo, r.userData.detalle, "rgb(244 236 232)", fuente).material.map, transparent: true, opacity: 0, depthTest: false })); e.renderOrder = 11; e.scale.copy(r.scale); e.position.copy(r.position); e.userData = { ...r.userData }; efimero.add(e); return e; });
    // Marca de «reconocido»: cuatro esquinas que encuadran cada recinto cuando el haz lo lee.
    const marcas = orden.map(a => {
      const r = escena.recintos.find(x => x.id === a.id)!, xs = r.contorno.map(p => p[0]), zs = r.contorno.map(p => p[1]);
      const x0 = Math.min(...xs), x1 = Math.max(...xs), z0 = Math.min(...zs), z1 = Math.max(...zs), l = Math.min(2.5, (x1 - x0) * 0.25, (z1 - z0) * 0.25), y = 0.09, v: number[] = [];
      for (const [x, dx] of [[x0, l], [x1, -l]]) for (const [z, dz] of [[z0, l], [z1, -l]]) v.push(x, y, z, x + dx, y, z, x, y, z, x, y, z + dz);
      const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(v, 3));
      const m = new THREE.LineBasicMaterial({ ...brillo([255, 244, 232], 0), depthTest: false }), o = new THREE.LineSegments(g, m); o.renderOrder = 10; efimero.add(o);
      return { id: a.id, m };
    });
    const nombres = new Map(escena.recintos.map(r => [r.id, r.nombre]));
    // Suelo de rejilla, haz y dos ondas que salen del centro.
    const rejilla = new THREE.GridHelper(radio * 6, 72, color(haz), color(haz)); rejilla.position.set(cx, -0.05, cz);
    const mr = rejilla.material as THREE.LineBasicMaterial; mr.transparent = true; mr.opacity = 0; mr.depthWrite = false;
    const margen = radio * 0.15, luz = new THREE.Mesh(new THREE.PlaneGeometry(escena.fondo + margen * 2, escena.alto + 6), new THREE.MeshBasicMaterial({ ...brillo(haz, 0.32), side: THREE.DoubleSide }));
    luz.rotation.y = Math.PI / 2; luz.position.set(-margen, (escena.alto + 6) / 2 - 1, cz);
    const raya = new THREE.Mesh(new THREE.PlaneGeometry(radio * 0.03, escena.fondo + margen * 2), new THREE.MeshBasicMaterial({ ...brillo([255, 170, 130], 0.95), side: THREE.DoubleSide }));
    raya.rotation.x = -Math.PI / 2; raya.position.set(-margen, 0.06, cz);
    const ondas = [0, 1].map(() => { const o = new THREE.Mesh(new THREE.RingGeometry(0.97, 1, 96), new THREE.MeshBasicMaterial({ ...brillo(haz, 0), side: THREE.DoubleSide })); o.rotation.x = -Math.PI / 2; o.position.set(cx, 0.04, cz); return o; });
    efimero.add(rejilla, luz, raya, ...ondas);
    // Tuberías en el orden en que se dibujan; equipos, cada uno con su caída.
    const prepara = () => {
      const tubos = instalacion.children.filter(o => o.userData.tubo), piezas = instalacion.children.filter(o => o.userData.pieza);
      for (const o of [...tubos, ...piezas]) o.visible = false;
      return { tubos, piezas };
    };
    instalacion.visible = true; let piezas = prepara(), grupo = instalacion;
    // Tiempos, en ms: el plano aparece solo, el haz lo lee de izquierda a derecha y, leído entero, se levanta.
    const LEE = 900, HAZ = 2700, ALZA = LEE + HAZ, TUBOS = ALZA + 2900, EQUIPOS = TUBOS + 1300, FUNDE = EQUIPOS + 1500, total = FUNDE + 1400; let dicho = "";
    const di = (p: PasoConversion, n: number, ultimo: string) => { if (dicho !== p + n) { dicho = p + n; alPaso(p, n, ultimo); } };
    animar(total, t => {
      // `x` es por dónde va el haz; sigue avanzando fuera de la planta para que las marcas de los últimos recintos también se apaguen.
      const s = t * total, b = tramo(s, LEE, HAZ), x = -margen + (escena.ancho + margen * 2) * Math.max(0, (s - LEE) / HAZ), paso = escena.ancho * 0.05;
      if (grupo !== instalacion) { grupo = instalacion; instalacion.visible = true; piezas = prepara(); }
      luz.position.x = raya.position.x = Math.min(x, escena.ancho + margen); luz.visible = raya.visible = b > 0 && b < 1;
      const f = suave(tramo(s, FUNDE, 1200)), aparece = tramo(s, 0, 700);
      mr.opacity = 0.3 * tramo(s, ALZA - 400, 900) * (1 - f);
      if (papel) papel.opacity = aparece * (1 - 0.45 * tramo(s, ALZA, 2500)) * (1 - f);
      ondas.forEach((o, i) => { const k = tramo(s, ALZA - 300 + i * 700, 2400); o.scale.setScalar(radio * 1.9 * frena(k) + 0.01); (o.material as THREE.MeshBasicMaterial).opacity = 0.7 * Math.sin(Math.PI * k); });
      // Plano secuencia: primero en vertical y derecho, como se lee un plano; después baja girando una vuelta entera hasta la vista final.
      const c = suave(tramo(s, ALZA, 5400));
      camara.position.setFromSpherical(new THREE.Spherical(esf.radius * (0.94 + 0.06 * c - 0.06 * (1 - c) * tramo(s, 0, ALZA)), 0.02 + (esf.phi - 0.02) * suave(tramo(s, ALZA, 4600)), (esf.theta - Math.PI * 2) * c)).add(fin.objetivo); camara.lookAt(fin.objetivo);
      let reconocidos = 0, ultimo = "";
      alzados.forEach((a, i) => {
        const visto = tramo(x - a.x0, 0, paso), k = turno.get(a.id) ?? 0, ini = base.get(a.id)!, sube = tramo(s, ALZA + 100 + k * 2100, 1100), e = extras[i];
        if (visto > 0.5) reconocidos++;
        // Al reconocerlo, el suelo del recinto da un fogonazo y se queda teñido.
        a.suelo.opacity = Math.min(1, visto * (0.3 + 0.45 * (1 - tramo(x - a.x0, paso, paso * 4)) * (1 - f) + 0.7 * f)); a.borde.opacity = visto;
        a.grupo.scale.y = Math.max(0.001, frena(sube));
        e.nube.opacity = Math.min(1, sube * 3) * 0.9 * (1 - f); e.canto.opacity = Math.min(1, sube * 3) * (1 - f);
        a.suelo.color.copy(color(calor[a.uso])).lerp(ini.suelo, f); a.borde.color.copy(color(calor[a.uso])).lerp(ini.borde, f); a.pared.color.copy(color(calor[a.uso])).lerp(ini.suelo, f);
        a.pared.blending = f < 0.5 ? THREE.AdditiveBlending : THREE.NormalBlending; a.pared.opacity = 0.3 * tramo(sube, 0.5, 0.5) + (0.2 - 0.3) * f;
      });
      for (const e of etiquetas) {
        const a = alzados.find(z => z.id === e.userData.recinto)!;
        e.material.opacity = tramo(x - a.x0, 0, paso) * (1 - f); e.position.y = Math.max(0.4, (e.userData.alto as number) * a.grupo.scale.y + 1.2);
      }
      for (const marca of marcas) {
        const a = alzados.find(z => z.id === marca.id)!, visto = tramo(x - a.x0, 0, paso);
        if (visto > 0.5) ultimo = nombres.get(marca.id) ?? ultimo;
        marca.m.opacity = visto * (1 - 0.8 * tramo(x - a.x0, paso * 2, paso * 6)) * (1 - tramo(s, ALZA, 500));
      }
      const traza = tramo(s, TUBOS, 1600); piezas.tubos.forEach((o, i) => { o.visible = i < traza * piezas.tubos.length; });
      piezas.piezas.forEach((o, i) => { const cae = tramo(s, EQUIPOS + i / Math.max(1, piezas.piezas.length) * 700, 700); o.visible = cae > 0; o.position.y = (1 - frena(cae)) * escena.alto * 0.9; });
      for (const r of rotulos) r.material.opacity = f;
      di(s < ALZA ? "barrido" : s < TUBOS ? "muros" : s < EQUIPOS ? "tuberias" : s < FUNDE ? "equipos" : "fin", reconocidos, ultimo);
    }, () => {
      mundo.remove(efimero); liberar(efimero);
      alzados.forEach((a, i) => { for (const o of extras[i].objetos) { a.grupo.remove(o); liberar(o); } a.grupo.scale.y = 1; a.suelo.transparent = false; a.suelo.opacity = 1; a.suelo.color.copy(base.get(a.id)!.suelo); a.pared.blending = THREE.NormalBlending; a.borde.transparent = false; a.borde.opacity = 1; });
      for (const o of instalacion.children) { o.visible = true; o.position.y = o.userData.pieza ? 0 : o.position.y; }
      convirtiendo = false; controles.enabled = true;
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
