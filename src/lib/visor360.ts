import * as THREE from "three";

/**
 * Visor de fotografía 360 (equirectangular) con three.js: una esfera vista desde dentro.
 * Arrastrar gira la vista; la rueda o el pellizco acercan; un toque corto devuelve la dirección (yaw, pitch) a la que apunta.
 * No pinta materiales sobre la foto: las cantidades salen de las medidas de la estancia y la foto sirve para situarse y marcar.
 */
export type Direccion = { yaw: number; pitch: number };
export type Visor360 = {
  /** Dónde cae en pantalla una dirección (para colocar las marcas). */
  proyectar(d: Direccion): { x: number; y: number; visible: boolean };
  centro(): Direccion;
  mirar(d: Direccion): void;
  cambiarFoto(url: string): Promise<void>;
  /** Lo que se ve ahora mismo, como JPEG de como mucho `maxAncho` px (para simular la vista con IA). */
  captura(maxAncho?: number): string | null;
  dispose(): void;
};

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));

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

  let yaw = 0, pitch = -0.12, fov = 75, zoomTocado = false, disposed = false, raf = 0;
  let velocidadYaw = 0, velocidadPitch = 0;
  const loader = new THREE.TextureLoader();

  function cargar(src: string) {
    return new Promise<void>((resolve, reject) => {
      loader.load(src, texture => {
        if (disposed) { texture.dispose(); return; }
        texture.colorSpace = THREE.SRGBColorSpace; texture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
        const anterior = material.map; material.map = texture; material.color.set(0xffffff); material.needsUpdate = true; anterior?.dispose();
        render(); opciones.alCargar?.(); resolve();
      }, undefined, e => { opciones.alFallar?.(e); reject(e); });
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
    captura(maxAncho = 1280) {
      // El lienzo WebGL solo conserva la imagen justo después de dibujar: se dibuja y se copia en el mismo paso.
      render();
      try {
        const escala = Math.min(1, maxAncho / canvas.width), w = Math.round(canvas.width * escala), h = Math.round(canvas.height * escala);
        const copia = document.createElement("canvas"); copia.width = w; copia.height = h;
        copia.getContext("2d")!.drawImage(canvas, 0, 0, w, h);
        return copia.toDataURL("image/jpeg", 0.88);
      } catch { return null; }
    },
    dispose() {
      disposed = true; cancelAnimationFrame(raf); observer.disconnect();
      material.map?.dispose(); material.dispose(); geometry.dispose(); renderer.dispose(); canvas.remove();
    }
  };
  redimensionar();
  void cargar(url);
  return visor;
}
