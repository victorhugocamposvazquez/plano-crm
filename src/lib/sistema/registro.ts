/** Registro editorial del producto. No es monitorización ni consulta de GitHub en vivo. */
export type CapabilityStatus = "available" | "partial" | "pending";
export type Evidence = { label: string; path: string };
export type Capability = {
  id: string;
  name: string;
  status: CapabilityStatus;
  summary: string;
  available: string[];
  pending: string[];
  evidence: Evidence[];
};

export const documentationDate = "2026-10-30";
export const workBranch = "codex/estado-fechas-produccion";
const repository = "https://github.com/victorhugocamposvazquez/plano-crm";
export const statusLabels: Record<CapabilityStatus, string> = {
  available: "Implementado",
  partial: "Parcial",
  pending: "Pendiente",
};
export function evidenceUrl(path: string, deployedCommit: string | null = null) {
  const revision = deployedCommit && /^[a-f0-9]{40}$/i.test(deployedCommit) ? deployedCommit : workBranch;
  return `${repository}/blob/${revision.split("/").map(encodeURIComponent).join("/")}/${path.split("/").map(encodeURIComponent).join("/")}`;
}

export const capabilities: Capability[] = [
  {
    id: "fechas-partidas", name: "Fechas y autor de las ediciones de partidas", status: "partial",
    summary: "Registro transaccional de altas, cambios y bajas, con última edición individual en el comparador. Migración activada en producción el 30/10/2026.",
    available: ["Fecha y autor verificados por el servidor; los eventos conservan valores anteriores y posteriores.", "Consulta privada por empresa y versión, sin alterar aprobados ni duplicar reintentos."],
    pending: ["Pantalla del registro completo de guardados; el comparador muestra la última edición en la versión consultada.", "Los datos antiguos sin registro individual no permiten reconstruir una fecha exacta."],
    evidence: [{ label: "Fechas y activación", path: "docs/usabilidad/fechas-partidas.md" }, { label: "Migración", path: "supabase/migrations/202610300001_budget_item_events.sql" }],
  },
  {
    id: "supervision", name: "Documentación y supervisión del producto", status: "partial",
    summary: "Zona privada con capacidades, límites, fuentes y registro de cambios de software.",
    available: ["Acceso de lectura verificado en servidor e independiente del rol de administración de empresa.", "Registro editorial de entregas y versión del despliegue cuando Vercel la proporciona."],
    pending: ["Autorizar las cuentas de supervisión en el entorno real.", "Persistir incidencias y decisiones; automatizar diagnóstico y propuestas con revisión humana, pruebas y reversión."],
    evidence: [{ label: "Procedimiento y acceso", path: "docs/sistema/supervision.md" }, { label: "Pruebas de autorización", path: "tests/sistema/superadmin.test.ts" }],
  },
  {
    id: "presupuestos", name: "Presupuestos y versiones", status: "available",
    summary: "Partidas con precios, ajustes, revisión, cierre y aprobación para obra.",
    available: ["Cálculo en céntimos e IVA; comparación entre versiones.", "Versiones aprobadas protegidas y control de cambios concurrentes al guardar."],
    pending: ["Validar la consulta y comparación con personas nuevas y completar el historial de ediciones dentro de un borrador."],
    evidence: [{ label: "Reglas y permisos", path: "src/lib/domain.ts" }, { label: "Pruebas de versiones y cálculo", path: "tests/domain.test.ts" }],
  },
  {
    id: "usabilidad", name: "Usabilidad y consulta de versiones", status: "partial",
    summary: "Ficha y consulta de versiones integradas; nueva pasada de lectura y documentos en preparación.",
    available: ["Componente de presupuesto con selector de cualquier versión e historial accesible fuera del chat.", "Comparador de partidas, importes y notas/condiciones con antes y después.", "Lectura por capítulos desplegables para reducir información visible de golpe."],
    pending: ["Integrar las mejoras de lectura, resumen móvil y documentos de esta rama; continuar con el resto de pantallas.", "Validar comprensión con usuarios nuevos antes de considerar resuelto el uso del CRM."],
    evidence: [{ label: "Historial y comparación", path: "src/lib/budget-history.ts" }, { label: "Espacio de presupuesto simplificado", path: "src/components/project/budget-workspace.tsx" }, { label: "Mejoras de lectura y documentos", path: "docs/usabilidad/lectura-clara.md" }],
  },
  {
    id: "pdf", name: "Presupuesto desde planos PDF", status: "partial",
    summary: "Lectura directa y propuesta de trabajos, con escala y revisión profesional.",
    available: ["Lectura local del PDF, original vinculado y avisos de elementos no interpretados.", "Varios planos; escala confirmada; huecos y trabajos ligados al catálogo."],
    pending: ["Persistir la extracción y la procedencia para continuar en otro dispositivo.", "Reconocer recintos, símbolos y planos escaneados; validar precisión con mediciones reales."],
    evidence: [{ label: "Lectura y límites", path: "docs/captura/lectura-pdf-directa.md" }, { label: "Fiabilidad de mediciones", path: "docs/captura/fiabilidad-planos.md" }],
  },
  {
    id: "estancias", name: "Estancias y artículos del catálogo", status: "partial",
    summary: "Motor para separar zonas y cambiar artículos conservando cantidades y procedencia.",
    available: ["API de previsualización por estancia con catálogo autorizado y dudas pendientes.", "Bloqueo de unidades incompatibles; decoración y elementos existentes sin coste añadido."],
    pending: ["Conectar la captura por estancias a la pantalla y guardar la asociación en servidor.", "Tarifario real de GARAL y reglas de compatibilidad técnica entre artículos."],
    evidence: [{ label: "Contrato y alcance", path: "docs/captura/estancias-catalogo.md" }, { label: "Pruebas de propuestas por estancia", path: "tests/captura/room-survey.test.ts" }],
  },
  {
    id: "fotos", name: "Análisis automático de fotos y 360", status: "pending",
    summary: "Objetivo de producto. Todavía no se ha implementado el reconocimiento automático.",
    available: ["Adjuntos de fotos en el CRM y contrato de fuentes por estancia."],
    pending: ["Reconocimiento de alcance y elementos, preguntas automáticas y evaluación con casos reales.", "Captura 360 y reconstrucción; una imagen sin referencia métrica no acredita dimensiones."],
    evidence: [{ label: "Fuentes, medidas y cuestiones pendientes", path: "docs/captura/estancias-catalogo.md" }],
  },
  {
    id: "virtual", name: "Entorno virtual y cambio de acabados", status: "partial",
    summary: "Laboratorio navegable con escenas sintéticas y selección ligada a importes de ejemplo.",
    available: ["Prototipo de local y nave con materiales físicos; cambio de artículos y diferencia económica."],
    pending: ["Reconstruir el inmueble real desde sus fuentes, usar modelos del catálogo y guardar por revisión.", "Validar rendimiento en móviles y alcanzar el acabado fotográfico esperado."],
    evidence: [{ label: "Laboratorio y limitaciones", path: "docs/captura/espacio-navegable.md" }, { label: "Vínculo entre catálogo y visualización", path: "docs/captura/catalogo-visual.md" }],
  },
  {
    id: "crm", name: "Gestión diaria del proyecto", status: "partial",
    summary: "Proyectos, documentos, chat, tareas, compras y certificaciones en una ficha común.",
    available: ["Sesión y permisos por organización; archivos y comandos protegidos en servidor.", "Versiones, tareas, compras, mensajes y registro de actividad del proyecto."],
    pending: ["Facturación y cobros completos, validación documental y planificación avanzada de oficios.", "Parte de la identidad y presentación de documentos sigue guardada en el navegador."],
    evidence: [{ label: "Backend y seguridad", path: "docs/backend.md" }, { label: "Alcance y coordinación pendientes", path: "docs/PREGUNTAS.md" }],
  },
];

export type ProductChange = {
  id: string; date: string; title: string; impact: string; limitation: string;
  commit: string; pullRequest: number;
};
/** Se registran cambios existentes en git, sin inferir si están fusionados o desplegados. */
export const productChanges: ProductChange[] = [
  {
    id: "fechas-partidas", date: "2026-10-30", title: "Registrar fechas y autor de cambios de partidas",
    impact: "Registro transaccional de altas, modificaciones y bajas; última edición individual visible en el comparador.",
    limitation: "El registro comienza desde la activación; las fechas individuales antiguas no registradas no se reconstruyen.",
    commit: "4589c6a", pullRequest: 64,
  },
  {
    id: "lectura-clara", date: "2026-10-29", title: "Distinguir la versión actual, la aprobada y sus cambios",
    impact: "Fechas visibles, Actual y Para obra separados por texto y comparación con impacto con IVA. Los ejemplos conservan la identidad de las partidas. Documentos y preferencias de apariencia más claros.",
    limitation: "Entrega comprobada en vista previa; pendiente de integración y de pruebas de comprensión con personas nuevas.",
    commit: "f2aecfc", pullRequest: 63,
  },
  {
    id: "supervision-sistema", date: "2026-10-29", title: "Documentar el producto y su evolución en una zona privada",
    impact: "Capacidades, límites, fuentes y cambios consultables con autorización de supervisión en servidor.",
    limitation: "Pendiente de configurar cuentas; la corrección supervisada es un procedimiento, sin ejecución automática.",
    commit: "99bc6da", pullRequest: 43,
  },
  {
    id: "usabilidad", date: "2026-10-29", title: "Simplificar la ficha y aclarar versiones y cambios",
    impact: "Resumen por tareas, selector libre, historial y comparación de partidas y condiciones con antes y después.",
    limitation: "Primera entrega verificada; falta integración y prueba de comprensión con usuarios nuevos.",
    commit: "c227e96", pullRequest: 42,
  },
  {
    id: "estancias-catalogo", date: "2026-10-28", title: "Propuestas por estancia y sustitución de artículos",
    impact: "Se calcula cada zona con su catálogo y se conservan medidas al cambiar el artículo.",
    limitation: "Motor y API; pendiente de pantalla de captura y persistencia.",
    commit: "ea3fadb", pullRequest: 41,
  },
  {
    id: "pdf-directo", date: "2026-10-28", title: "Leer el PDF directamente",
    impact: "El flujo lee el original sin pedir un JSON y avisa cuando la lectura es parcial.",
    limitation: "Extracción en navegador; aún no se retoma entre dispositivos.",
    commit: "c5d77cd", pullRequest: 40,
  },
  {
    id: "fiabilidad-planos", date: "2026-10-28", title: "Reforzar escala y cambios de presupuesto",
    impact: "Confirma escalas, separa huecos y requiere decidir antes de sustituir partidas existentes.",
    limitation: "La revisión profesional y la referencia métrica siguen siendo necesarias.",
    commit: "8019d60", pullRequest: 39,
  },
  {
    id: "varios-planos", date: "2026-10-28", title: "Varios planos en un proyecto",
    impact: "Permite adjuntar y distinguir planos de demolición, obra nueva, cotas y otros usos.",
    limitation: "No interpreta automáticamente todos los tipos de plano.",
    commit: "8535eff", pullRequest: 38,
  },
];

export const commitUrl = (commit: string) => `${repository}/commit/${encodeURIComponent(commit)}`;
export const pullRequestUrl = (number: number) => `${repository}/pull/${number}`;

export function deploymentLabel(environment: Record<string, string | undefined>) {
  const sha = environment.VERCEL_GIT_COMMIT_SHA;
  return {
    environment: environment.VERCEL_ENV === "production" ? "Producción" : environment.VERCEL_ENV === "preview" ? "Vista previa" : "Local / entorno no identificado",
    commit: sha && /^[a-f0-9]{40}$/i.test(sha) ? sha.toLowerCase() : null,
  };
}

export const supervisionSteps = [
  { name: "Registrar el fallo", detail: "Qué ocurrió, qué se esperaba, pasos para repetirlo y versión del sistema. Omitir datos personales y archivos de clientes." },
  { name: "Reproducir y acotar", detail: "Una persona confirma el problema, su impacto y la prueba que debe fallar. La IA puede proponer causas; no las da por verificadas." },
  { name: "Preparar una corrección", detail: "Cambio aislado en una rama, con pruebas y descripción del efecto. Sin alterar presupuestos aprobados ni datos de producción." },
  { name: "Revisar y autorizar", detail: "Un responsable revisa el cambio, sus pruebas y la forma de deshacerlo antes de publicarlo." },
  { name: "Comprobar y dejar constancia", detail: "Tras la publicación se verifica el caso, se registra la versión y se cierra la incidencia. Si falla, se revierte o se reabre." },
] as const;
