import type { BudgetItem, Workspace, Actor } from "./domain";
export const demoActor: Actor = { id: "00000000-0000-4000-8000-000000000001", name: "Alex · Demo", role: "admin" };
export const demoId = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
export function createDemo(): Workspace {
  const org = demoId(2), now = new Date();
  const date = (offset: number) => { const d = new Date(now); d.setDate(d.getDate() + offset); return d.toISOString(); };
  const projects: Workspace["projects"] = [
    { id: demoId(10), organization_id: org, code: "PL-001", name: "Vivienda en Monte Alto", client_name: "Cliente de ejemplo 01", location: "A Coruña · Monte Alto", kind: "integral", status: "active", created_at: date(-52) },
    { id: demoId(11), organization_id: org, code: "PL-002", name: "Apartamento en el centro", client_name: "Cliente de ejemplo 02", location: "A Coruña · Centro", kind: "integral", status: "estimating", created_at: date(-18) },
    { id: demoId(12), organization_id: org, code: "PL-003", name: "Cocina abierta al salón", client_name: "Cliente de ejemplo 03", location: "Oleiros", kind: "partial", status: "active", created_at: date(-33) },
    { id: demoId(13), organization_id: org, code: "PL-004", name: "Carpintería a medida", client_name: "Cliente de ejemplo 04", location: "A Coruña · Riazor", kind: "carpentry", status: "planning", created_at: date(-12) },
    { id: demoId(14), organization_id: org, code: "PL-005", name: "Reforma de baño", client_name: "Cliente de ejemplo 05", location: "Cambre", kind: "partial", status: "lead", created_at: date(-2) }
  ];
  const articles: Workspace["articles"] = [
    { id: demoId(30), organization_id: org, code: "DEM-001", name: "Demolición de tabiquería interior", chapter: "Demoliciones", unit: "m²", unit_price: 2800, vat_rate: 21 },
    { id: demoId(31), organization_id: org, code: "ALB-001", name: "Tabique de placa de yeso laminado", chapter: "Albañilería", unit: "m²", unit_price: 5400, vat_rate: 21 },
    { id: demoId(32), organization_id: org, code: "PAV-001", name: "Tarima laminada con instalación", chapter: "Pavimentos", unit: "m²", unit_price: 4950, vat_rate: 21 },
    { id: demoId(33), organization_id: org, code: "CAR-001", name: "Puerta interior lacada con herrajes", chapter: "Carpintería", unit: "ud", unit_price: 44000, vat_rate: 21 },
    { id: demoId(34), organization_id: org, code: "PIN-001", name: "Preparación y pintura de paredes", chapter: "Pintura", unit: "m²", unit_price: 1450, vat_rate: 21 },
    { id: demoId(35), organization_id: org, code: "ELE-001", name: "Punto de luz con mecanismo", chapter: "Electricidad", unit: "ud", unit_price: 7800, vat_rate: 21 },
    { id: demoId(36), organization_id: org, code: "CAR-002", name: "Armario a medida con distribución interior", chapter: "Carpintería", unit: "ud", unit_price: 166200, vat_rate: 21 },
    { id: demoId(37), organization_id: org, code: "FON-001", name: "Instalación de fontanería de baño", chapter: "Fontanería", unit: "global", unit_price: 168000, vat_rate: 21 }
  ];
  const items: BudgetItem[] = articles.slice(0,6).map((a, i) => ({ id: demoId(100 + i), chapter: a.chapter, description: a.name, quantity: [42, 38, 86, 7, 235, 24][i], unit: a.unit as BudgetItem["unit"], unit_price: a.unit_price, adjustment_percent: 0, vat_rate: a.vat_rate, inclusion: "included" }));
  const revised = structuredClone(items); revised[0].adjustment_percent = 15; revised[2].description = "Tarima laminada roble natural, gama premium"; revised[2].unit_price = 5480; revised[3].quantity = 8;
  revised.push({ id: demoId(106), chapter: "Carpintería", description: "Armario a medida, dormitorio principal", quantity: 1, unit: "ud", unit_price: 166200, adjustment_percent: 0, vat_rate: 21, inclusion: "optional" });
  return {
    organization_id: org, organization_name: "GARAL · Demostración", projects, articles,
    budgets: projects.slice(0,4).map((p,i) => ({ id: demoId(50+i), organization_id: org, project_id: p.id, title: i === 3 ? "Carpintería interior" : "Presupuesto de reforma", approved_version_id: i === 0 ? demoId(60) : null, created_at: date(-20) })),
    versions: [
      { id: demoId(60), organization_id: org, budget_id: demoId(50), number: 1, status: "approved", draft_revision: 1, items, notes: "Propuesta de demostración. Precios ficticios, sin validez comercial.", change_reason: "Propuesta inicial", created_by_name: "Marta · Demo", created_at: date(-20), updated_at: date(-18), approved_at: date(-18), approval_reference: "Aprobación ficticia para probar el flujo" },
      { id: demoId(61), organization_id: org, budget_id: demoId(50), number: 2, status: "draft", draft_revision: 0, items: revised, notes: "Revisar el acceso para retirada de escombros y confirmar la elección del pavimento.", change_reason: "Cambio de pavimento y ajustes de alcance", created_by_name: "Alex · Demo", created_at: date(-1), updated_at: date(-1), approved_at: null, approval_reference: null },
      ...[1,2,3].map(i => ({ id: demoId(61+i), organization_id: org, budget_id: demoId(50+i), number: 1, status: "draft" as const, draft_revision: 0, items: structuredClone(i === 3 ? items.slice(3,4) : items.slice(0, i===1 ? 5 : 3)), notes: "Datos de ejemplo", change_reason: "Propuesta inicial", created_by_name: "Alex · Demo", created_at: date(-10), updated_at: date(-2), approved_at: null, approval_reference: null }))
    ],
    tasks: [
      { id: demoId(200), organization_id: org, project_id: demoId(10), title: "Protecciones y preparación de la vivienda", trade: "Albañilería", assignee: "Equipo de obra", due_date: date(-10).slice(0,10), status: "done", weight: 10 },
      { id: demoId(201), organization_id: org, project_id: demoId(10), title: "Demoliciones y retirada de escombros", trade: "Albañilería", assignee: "Equipo de obra", due_date: date(-5).slice(0,10), status: "done", weight: 30 },
      { id: demoId(202), organization_id: org, project_id: demoId(10), title: "Replantear tabiquería con el electricista", trade: "Coordinación", assignee: "Alex", due_date: date(0).slice(0,10), status: "pending", weight: 20 },
      { id: demoId(203), organization_id: org, project_id: demoId(10), title: "Ejecutar instalaciones y revestimientos", trade: "Instalaciones", assignee: "Equipo de obra", due_date: date(7).slice(0,10), status: "pending", weight: 40 },
      { id: demoId(204), organization_id: org, project_id: demoId(12), title: "Desmontar cocina y proteger pavimento", trade: "Carpintería", assignee: "Dani", due_date: date(-2).slice(0,10), status: "done", weight: 30 },
      { id: demoId(205), organization_id: org, project_id: demoId(12), title: "Confirmar medidas de la encimera", trade: "Carpintería", assignee: "Dani", due_date: date(0).slice(0,10), status: "pending", weight: 20 },
      { id: demoId(206), organization_id: org, project_id: demoId(12), title: "Instalar muebles y rematar encuentros", trade: "Carpintería", assignee: "Dani", due_date: date(5).slice(0,10), status: "pending", weight: 50 },
      { id: demoId(207), organization_id: org, project_id: demoId(11), title: "Revisar propuesta con el cliente", trade: "Oficina", assignee: "Marta", due_date: date(1).slice(0,10), status: "pending", weight: 10 }
    ],
    purchases: [
      { id: demoId(300), organization_id: org, project_id: demoId(10), name: "Placas de yeso laminado", supplier: "Proveedor de ejemplo", quantity: 80, unit: "m²", received_quantity: 40, delivered_quantity: 40, status: "ordered" },
      { id: demoId(301), organization_id: org, project_id: demoId(12), name: "Muebles de cocina", supplier: "Taller de ejemplo", quantity: 1, unit: "global", received_quantity: 0, delivered_quantity: 0, status: "planned" }
    ],
    documents: [], certifications: [],
    messages: [{ id: demoId(400), organization_id: org, project_id: demoId(10), body: "La V1 sigue siendo la aceptada. Los cambios de pavimento están en el borrador V2, pendientes de confirmar.", author_name: "Marta · Demo", created_at: date(-1) }],
    activities: [{ id: demoId(500), organization_id: org, project_id: demoId(10), text: "V2 creada: cambio de pavimento y ajustes de alcance", actor_name: "Alex · Demo", created_at: date(-1) }, { id: demoId(501), organization_id: org, project_id: demoId(12), text: "Desmontaje de cocina completado", actor_name: "Dani · Demo", created_at: date(-2) }]
  };
}
