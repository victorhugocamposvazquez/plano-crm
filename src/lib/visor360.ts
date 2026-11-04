import * as THREE from "three";
import type { Acabado } from "./visita360";
import type { TipoAuto } from "./autodeteccion";

/**
 * Visor de fotografía 360 (equirectangular) con three.js: una esfera vista desde dentro.
 * Arrastrar gira la vista; la rueda o el pellizco acercan; un toque corto devuelve la dirección (yaw, pitch) a la que apunta.
 * Las superficies marcadas (suelo, paredes, muebles) se dibujan como polígonos reales en el espacio, con su perspectiva,
 * y su color se multiplica por la luz de la foto en ese punto: así conservan sombras, reflejos y rincones.
 */
export type Direccion = { yaw: number; pitch: number };
export type SuperficieVisor = { id: string; vertices: [number, number, number][]; plano: [number, number][]; huecos: number[]; acabado: Acabado };
/** Superficie detectada en la foto: una máscara del tamaño analizado y lo necesario para pegar el material con perspectiva. */
export type CapaVisor = { id: string; tipo: TipoAuto; bits: Uint8Array; w: number; h: number; acabado: Acabado; columnas: Float32Array; alturaTecho: number };
export type Visor360 = {
  /** Proyecta una dirección a píxeles del contenedor; `visible` es falso si queda detrás de la cámara. */
  proyectar(d: Direccion): { x: number; y: number; visible: boolean };
  centro(): Direccion;
  mirar(d: Direccion): void;
  cambiarFoto(url: string): Promise<void>;
  /** Sustituye las superficies dibujadas sobre la foto. */
  superficies(lista: SuperficieVisor[]): void;
  /** Sustituye las superficies detectadas (máscaras) dibujadas sobre la foto. */
  capas(lista: CapaVisor[]): void;
  /** Píxeles de la foto cargada, al tamaño pedido, para analizarla. */
  pixeles(w: number, h: number): ImageData | null;
  /** Enseña la foto tal como está, sin las superficies. */
  verOriginal(si: boolean): void;
  dispose(): void;
};

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));

const vertexShader = `
varying vec3 vMundo;
varying vec2 vUv;
void main() {
  vUv = uv;
  vMundo = (modelMatrix * vec4(position, 1.0)).xyz;
  gl_Position = projectionMatrix * viewMatrix * vec4(vMundo, 1.0);
}`;
// Misma correspondencia dirección → foto que la esfera (SphereGeometry con la x invertida).
const fragmentShader = `
uniform sampler2D foto;
uniform sampler2D mapa;
uniform bool conMapa;
uniform vec3 color;
uniform float base;
uniform float opacidad;
uniform float lodLuz;
varying vec3 vMundo;
varying vec2 vUv;
const float PI = 3.141592653589793;
void main() {
  vec3 d = normalize(vMundo);
  vec2 uvFoto = vec2(fract(atan(d.z, d.x) / (2.0 * PI)), 1.0 - acos(clamp(d.y, -1.0, 1.0)) / PI);
  vec3 f = texture2D(foto, uvFoto).rgb;
  // La luz sale de la foto desenfocada: trae sombras y cambios de luz, no el dibujo de las baldosas ni las juntas.
  vec3 borrosa = textureLod(foto, uvFoto, lodLuz).rgb;
  float l = dot(borrosa, vec3(0.2126, 0.7152, 0.0722));
  float luz = clamp(l / max(base, 0.02), 0.55, 1.35);
  vec3 albedo = conMapa ? texture2D(mapa, vUv).rgb : color;
  gl_FragColor = vec4(mix(f, albedo * luz, opacidad), 1.0);
  gl_FragColor = linearToOutputTexel(gl_FragColor);
}`;

// Capas detectadas: se pintan sobre la propia esfera de la foto, solo donde la máscara lo dice.
const fragmentCapa = `
uniform sampler2D foto;
uniform sampler2D mapa;
uniform sampler2D mascara;
uniform sampler2D columnas;
uniform bool conMapa;
uniform vec3 color;
uniform float base;
uniform float opacidad;
uniform float lodLuz;
uniform float altura;
uniform float alturaTecho;
uniform float escala;
uniform int tipo;
varying vec3 vMundo;
const float PI = 3.141592653589793;
void main() {
  vec3 d = normalize(vMundo);
  vec2 uvFoto = vec2(fract(atan(d.z, d.x) / (2.0 * PI)), 1.0 - acos(clamp(d.y, -1.0, 1.0)) / PI);
  float m = texture2D(mascara, vec2(uvFoto.x, 1.0 - uvFoto.y)).r;
  float a = smoothstep(0.3, 0.7, m);
  if (a < 0.01) discard;
  vec3 f = texture2D(foto, uvFoto).rgb;
  vec3 borrosa = textureLod(foto, uvFoto, lodLuz).rgb;
  float luz = clamp(dot(borrosa, vec3(0.2126, 0.7152, 0.0722)) / max(base, 0.02), 0.55, 1.35);
  vec2 uvM;
  float lejos = 0.0;
  if (tipo == 0) { float t = -altura / min(d.y, -0.02); uvM = (d * t).xz; lejos = length(uvM); }
  else if (tipo == 2) { float t = (alturaTecho - altura) / max(d.y, 0.02); uvM = (d * t).xz; lejos = length(uvM); }
  else { vec4 c = texture2D(columnas, vec2(uvFoto.x, 0.5)); float hz = max(length(d.xz), 0.001); uvM = vec2(c.g, c.r * d.y / hz + altura); }
  vec3 albedo = conMapa ? texture2D(mapa, uvM / escala).rgb : color;
  // A ras de suelo la textura se repite tanto que tiembla: de lejos se funde con su color medio, como lo vería el ojo.
  if (conMapa && lejos > 0.0) albedo = mix(albedo, textureLod(mapa, uvM / escala, 9.0).rgb, smoothstep(3.0, 7.0, lejos));
  gl_FragColor = vec4(mix(f, albedo * luz, opacidad), a);
  gl_FragColor = linearToOutputTexel(gl_FragColor);
}`;

export function crearVisor360(container: HTMLElement, url: string, opciones: { alTocar?: (d: Direccion) => void; alMover?: () => void; alCargar?: () => void; alFallar?: (e: unknown) => void } = {}): Visor360 {
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "low-power" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  const canvas = renderer.domElement;
  canvas.style.display = "block"; canvas.style.width = "100%"; canvas.style.height = "100%"; canvas.style.touchAction = "none"; canvas.style.cursor = "grab"; canvas.style.zIndex = "0";
  canvas.setAttribute("aria-label", "Fotografía 360 de la estancia. Arrastra para mirar alrededor; toca un sitio para poner algo ahí.");
  container.appendChild(canvas);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(75, 1, 0.05, 100);
  const geometry = new THREE.SphereGeometry(50, 64, 40);
  geometry.scale(-1, 1, 1); // se ve desde dentro
  const material = new THREE.MeshBasicMaterial({ color: 0x222222 });
  const sphere = new THREE.Mesh(geometry, material);
  sphere.renderOrder = 0;
  scene.add(sphere);
  const grupo = new THREE.Group(); scene.add(grupo);
  const grupoCapas = new THREE.Group(); scene.add(grupoCapas);
  const geoCapa = new THREE.SphereGeometry(45, 96, 64); geoCapa.scale(-1, 1, 1);
  let capasActuales: CapaVisor[] = [];

  let yaw = 0, pitch = -0.12, fov = 75, zoomTocado = false, disposed = false, raf = 0;
  let velocidadYaw = 0, velocidadPitch = 0;
  const loader = new THREE.TextureLoader();
  const texturas = new Map<string, THREE.Texture>();
  let fotoTex: THREE.Texture | null = null;
  // Copia pequeña de la foto para medir su luz media en cada superficie.
  let muestreo: { data: Uint8ClampedArray; w: number; h: number } | null = null;
  let actuales: SuperficieVisor[] = [];

  function cargar(src: string) {
    return new Promise<void>((resolve, reject) => {
      loader.load(src, texture => {
        if (disposed) { texture.dispose(); return; }
        texture.colorSpace = THREE.SRGBColorSpace; texture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
        const anterior = material.map; material.map = texture; material.color.set(0xffffff); material.needsUpdate = true; anterior?.dispose();
        fotoTex = texture; muestreo = null;
        try {
          const img = texture.image as CanvasImageSource;
          const w = 512, h = 256, lienzo = document.createElement("canvas"); lienzo.width = w; lienzo.height = h;
          const ctx = lienzo.getContext("2d", { willReadFrequently: true })!; ctx.drawImage(img, 0, 0, w, h);
          muestreo = { data: ctx.getImageData(0, 0, w, h).data, w, h };
        } catch { muestreo = null; }
        construir(); construirCapas(); render(); opciones.alCargar?.(); resolve();
      }, undefined, e => { opciones.alFallar?.(e); reject(e); });
    });
  }

  /** Luz media de la foto (lineal) en las direcciones de una superficie, para que el material guarde las sombras pero no oscurezca. */
  function luzMedia(v: [number, number, number][]): number {
    if (!muestreo) return 0.35;
    const c = v.reduce((s, p) => [s[0] + p[0] / v.length, s[1] + p[1] / v.length, s[2] + p[2] / v.length] as [number, number, number], [0, 0, 0] as [number, number, number]);
    const puntos: [number, number, number][] = [c];
    for (const p of v) for (const k of [0.25, 0.5, 0.75]) puntos.push([c[0] + (p[0] - c[0]) * k, c[1] + (p[1] - c[1]) * k, c[2] + (p[2] - c[2]) * k]);
    const lin = (c8: number) => { const s = c8 / 255; return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; };
    let suma = 0;
    for (const [x, y, z] of puntos) {
      const len = Math.hypot(x, y, z) || 1, dx = x / len, dy = y / len, dz = z / len;
      let u = Math.atan2(dz, dx) / (2 * Math.PI); u -= Math.floor(u);
      const vv = Math.acos(clamp(dy, -1, 1)) / Math.PI;
      const px = Math.min(muestreo.w - 1, Math.floor(u * muestreo.w)), py = Math.min(muestreo.h - 1, Math.floor(vv * muestreo.h));
      const i = (py * muestreo.w + px) * 4;
      suma += 0.2126 * lin(muestreo.data[i]) + 0.7152 * lin(muestreo.data[i + 1]) + 0.0722 * lin(muestreo.data[i + 2]);
    }
    return suma / puntos.length;
  }

  function textura(src: string) {
    let t = texturas.get(src);
    if (!t) {
      t = loader.load(src, () => render());
      t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
      texturas.set(src, t);
    }
    return t;
  }

  function construir() {
    for (const m of [...grupo.children] as THREE.Mesh[]) { m.geometry.dispose(); (m.material as THREE.Material).dispose(); grupo.remove(m); }
    const foto = fotoTex; if (!foto) return;
    const lodLuz = Math.max(3, Math.log2(((foto.image as { width?: number } | undefined)?.width ?? 4096) / 96));
    actuales.forEach((s, i) => {
      if (s.vertices.length < 3) return;
      let caras: number[][];
      const v2 = s.plano.map(([u, v]) => new THREE.Vector2(u, v)), corte = s.huecos[0] ?? v2.length;
      const huecos = s.huecos.map((ini, k) => v2.slice(ini, s.huecos[k + 1] ?? v2.length));
      try { caras = THREE.ShapeUtils.triangulateShape(v2.slice(0, corte), huecos); } catch { return; }
      if (!caras.length) return;
      const conMapa = "textura" in s.acabado, escala = "textura" in s.acabado ? s.acabado.escala : 1;
      const geo = new THREE.BufferGeometry();
      geo.setAttribute("position", new THREE.Float32BufferAttribute(s.vertices.flat(), 3));
      geo.setAttribute("uv", new THREE.Float32BufferAttribute(s.plano.flatMap(([u, v]) => [u / escala, v / escala]), 2));
      geo.setIndex(caras.flat());
      const mat = new THREE.ShaderMaterial({
        // Con profundidad: suelo, paredes y muebles se tapan entre sí como en la estancia; la esfera de la foto queda siempre detrás.
        vertexShader, fragmentShader, side: THREE.DoubleSide, depthWrite: true, depthTest: true,
        uniforms: {
          foto: { value: foto }, mapa: { value: "textura" in s.acabado ? textura(s.acabado.textura) : null }, conMapa: { value: conMapa },
          color: { value: new THREE.Color("color" in s.acabado ? s.acabado.color : "#ffffff") }, base: { value: luzMedia(s.vertices) }, opacidad: { value: s.acabado.opacidad },
          lodLuz: { value: lodLuz }
        }
      });
      const mesh = new THREE.Mesh(geo, mat); mesh.renderOrder = 1 + i; mesh.name = s.id; grupo.add(mesh);
    });
  }

  /** Luz media de la foto en lo que cubre una máscara. */
  function luzMascara(c: CapaVisor): number {
    if (!muestreo) return 0.35;
    const lin = (c8: number) => { const s = c8 / 255; return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; };
    let suma = 0, k = 0;
    for (let y = 0; y < muestreo.h; y += 2) for (let x = 0; x < muestreo.w; x += 2) {
      if (!c.bits[Math.floor((y / muestreo.h) * c.h) * c.w + Math.floor((x / muestreo.w) * c.w)]) continue;
      const i = (y * muestreo.w + x) * 4; suma += 0.2126 * lin(muestreo.data[i]) + 0.7152 * lin(muestreo.data[i + 1]) + 0.0722 * lin(muestreo.data[i + 2]); k++;
    }
    return k ? suma / k : 0.35;
  }

  function construirCapas() {
    for (const m of [...grupoCapas.children] as THREE.Mesh[]) { const mat = m.material as THREE.ShaderMaterial; (mat.uniforms.mascara.value as THREE.Texture).dispose(); (mat.uniforms.columnas.value as THREE.Texture).dispose(); mat.dispose(); grupoCapas.remove(m); }
    const foto = fotoTex; if (!foto) return;
    const lodLuz = Math.max(3, Math.log2(((foto.image as { width?: number } | undefined)?.width ?? 4096) / 96));
    capasActuales.forEach((c, i) => {
      const datos = new Uint8Array(c.w * c.h); for (let k = 0; k < datos.length; k++) datos[k] = c.bits[k] ? 255 : 0;
      const mascara = new THREE.DataTexture(datos, c.w, c.h, THREE.RedFormat, THREE.UnsignedByteType);
      mascara.magFilter = mascara.minFilter = THREE.LinearFilter; mascara.wrapS = THREE.RepeatWrapping; mascara.needsUpdate = true;
      const columnas = new THREE.DataTexture(c.columnas, c.columnas.length / 4, 1, THREE.RGBAFormat, THREE.FloatType);
      columnas.magFilter = columnas.minFilter = THREE.NearestFilter; columnas.wrapS = THREE.RepeatWrapping; columnas.needsUpdate = true;
      const conMapa = "textura" in c.acabado, escala = "textura" in c.acabado ? c.acabado.escala : 1;
      const mat = new THREE.ShaderMaterial({
        vertexShader, fragmentShader: fragmentCapa, transparent: true, depthTest: false, depthWrite: false,
        uniforms: {
          foto: { value: foto }, mapa: { value: "textura" in c.acabado ? textura(c.acabado.textura) : null }, mascara: { value: mascara }, columnas: { value: columnas },
          conMapa: { value: conMapa }, color: { value: new THREE.Color("color" in c.acabado ? c.acabado.color : "#ffffff") }, base: { value: luzMascara(c) },
          opacidad: { value: c.acabado.opacidad }, lodLuz: { value: lodLuz }, altura: { value: 1.5 }, alturaTecho: { value: c.alturaTecho }, escala: { value: escala },
          tipo: { value: c.tipo === "suelo" ? 0 : c.tipo === "pared" ? 1 : 2 }
        }
      });
      const mesh = new THREE.Mesh(geoCapa, mat); mesh.renderOrder = 10 + i; mesh.name = c.id; grupoCapas.add(mesh);
    });
  }

  function aplicarCamara() {
    camera.fov = fov; camera.updateProjectionMatrix();
    const x = Math.cos(pitch) * Math.sin(yaw), y = Math.sin(pitch), z = Math.cos(pitch) * Math.cos(yaw);
    camera.lookAt(x, y, z);
  }
  function render() { if (disposed) return; aplicarCamara(); renderer.render(scene, camera); opciones.alMover?.(); }
  function redimensionar() {
    const w = container.clientWidth || 1, h = container.clientHeight || 1;
    // En vertical (móvil) el campo de visión se abre para que la estancia no se vea como por una rendija.
    if (!zoomTocado) fov = w / h < 1 ? 100 : 75;
    renderer.setSize(w, h, false); camera.aspect = w / h; render();
  }
  const observer = new ResizeObserver(redimensionar); observer.observe(container);

  // Arrastre con el dedo o el ratón; un toque corto sin desplazamiento es «poner algo aquí».
  let arrastrando = false, inicioX = 0, inicioY = 0, ultimoX = 0, ultimoY = 0, movido = false, ultimoT = 0;
  const porPixel = () => (fov * Math.PI / 180) / (container.clientHeight || 1);
  canvas.addEventListener("pointerdown", e => { arrastrando = true; movido = false; inicioX = ultimoX = e.clientX; inicioY = ultimoY = e.clientY; ultimoT = performance.now(); velocidadYaw = velocidadPitch = 0; canvas.setPointerCapture(e.pointerId); canvas.style.cursor = "grabbing"; });
  canvas.addEventListener("pointermove", e => {
    if (!arrastrando) return;
    const dx = e.clientX - ultimoX, dy = e.clientY - ultimoY; ultimoX = e.clientX; ultimoY = e.clientY;
    if (Math.abs(e.clientX - inicioX) + Math.abs(e.clientY - inicioY) > 6) movido = true;
    const k = porPixel(); yaw -= dx * k; pitch = clamp(pitch + dy * k, -Math.PI / 2 + 0.05, Math.PI / 2 - 0.05);
    const ahora = performance.now(), dt = Math.max(8, ahora - ultimoT); ultimoT = ahora;
    velocidadYaw = -dx * k / dt * 16; velocidadPitch = dy * k / dt * 16;
    render();
  });
  const soltar = (e: PointerEvent) => {
    if (!arrastrando) return; arrastrando = false; canvas.style.cursor = "grab";
    if (!movido) { opciones.alTocar?.(direccionDesde(e.clientX, e.clientY)); return; }
    inercia();
  };
  canvas.addEventListener("pointerup", soltar); canvas.addEventListener("pointercancel", soltar);
  function inercia() {
    cancelAnimationFrame(raf);
    const paso = () => {
      if (disposed) return;
      velocidadYaw *= 0.9; velocidadPitch *= 0.9;
      if (Math.abs(velocidadYaw) + Math.abs(velocidadPitch) < 0.0004) return;
      yaw += velocidadYaw; pitch = clamp(pitch + velocidadPitch, -Math.PI / 2 + 0.05, Math.PI / 2 - 0.05); render(); raf = requestAnimationFrame(paso);
    };
    raf = requestAnimationFrame(paso);
  }
  canvas.addEventListener("wheel", e => { e.preventDefault(); zoomTocado = true; fov = clamp(fov + e.deltaY * 0.05, 40, 110); render(); }, { passive: false });
  // Pellizco: dos dedos cambian el ángulo de visión.
  let pellizco = 0;
  canvas.addEventListener("touchstart", e => { if (e.touches.length === 2) pellizco = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY); }, { passive: true });
  canvas.addEventListener("touchmove", e => { if (e.touches.length === 2 && pellizco) { const d = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY); zoomTocado = true; fov = clamp(fov * (pellizco / d), 40, 110); pellizco = d; arrastrando = false; render(); } }, { passive: true });

  function direccionDesde(clientX: number, clientY: number): Direccion {
    const r = canvas.getBoundingClientRect();
    const ndc = new THREE.Vector2(((clientX - r.left) / r.width) * 2 - 1, -(((clientY - r.top) / r.height) * 2 - 1));
    const v = new THREE.Vector3(ndc.x, ndc.y, 0.5).unproject(camera).normalize();
    return { yaw: Math.atan2(v.x, v.z), pitch: Math.asin(clamp(v.y, -1, 1)) };
  }

  const visor: Visor360 = {
    proyectar(d) {
      const v = new THREE.Vector3(Math.cos(d.pitch) * Math.sin(d.yaw), Math.sin(d.pitch), Math.cos(d.pitch) * Math.cos(d.yaw));
      const delante = v.dot(camera.getWorldDirection(new THREE.Vector3())) > 0.15;
      v.project(camera);
      return { x: (v.x + 1) / 2 * (container.clientWidth || 1), y: (1 - v.y) / 2 * (container.clientHeight || 1), visible: delante && Math.abs(v.x) <= 1.05 && Math.abs(v.y) <= 1.05 };
    },
    centro: () => ({ yaw, pitch }),
    mirar(d) { cancelAnimationFrame(raf); yaw = d.yaw; pitch = clamp(d.pitch, -Math.PI / 2 + 0.05, Math.PI / 2 - 0.05); render(); },
    cambiarFoto: cargar,
    superficies(lista) { actuales = lista; construir(); render(); },
    capas(lista) { capasActuales = lista; construirCapas(); render(); },
    pixeles(w, h) {
      const img = fotoTex?.image as CanvasImageSource | undefined; if (!img) return null;
      try { const lienzo = document.createElement("canvas"); lienzo.width = w; lienzo.height = h; const ctx = lienzo.getContext("2d", { willReadFrequently: true })!; ctx.drawImage(img, 0, 0, w, h); return ctx.getImageData(0, 0, w, h); } catch { return null; }
    },
    verOriginal(si) { grupo.visible = !si; grupoCapas.visible = !si; render(); },
    dispose() {
      disposed = true; cancelAnimationFrame(raf); observer.disconnect();
      for (const m of grupo.children as THREE.Mesh[]) { m.geometry.dispose(); (m.material as THREE.Material).dispose(); }
      for (const m of grupoCapas.children as THREE.Mesh[]) (m.material as THREE.Material).dispose(); geoCapa.dispose();
      texturas.forEach(t => t.dispose()); material.map?.dispose(); material.dispose(); geometry.dispose(); renderer.dispose(); canvas.remove();
    }
  };
  redimensionar();
  void cargar(url);
  return visor;
}
