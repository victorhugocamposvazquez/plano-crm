# Propuesta completa de usabilidad

Integración de los dos prototipos («PLANO Propuesta completa» de escritorio y «PLANO Movil» de 390 px) que Hugo entregó el 31 de octubre de 2026. El prototipo es una referencia: se ha recreado con los componentes, tokens y datos de Plano. No hay migraciones en esta entrega.

| Pantalla del prototipo | Estado | Qué falta y por qué |
|---|---|---|
| Armazón, «+ Nuevo», cuenta | Integrada | «Factura» es «Cobro» hasta que existan facturas. «Cliente» abre el alta de proyecto, porque el cliente nace con él. |
| Hoy | Integrada | |
| Proyectos | Integrada | |
| Ficha · Resumen | Integrada | |
| Presupuesto, Versiones, Ver qué cambia | Integradas | La columna «De dónde sale» no se pone: la partida no guarda su origen. |
| Añadir del catálogo | Integrada | Sin fotos ni filtro de proveedor: no hay dato. |
| Medir el plano, Recorrer el 360°, Visita | Sin rediseñar | Siguen las pantallas actuales, ligadas al trabajo de captura de Codex. |
| Enviar al cliente | Integrada | Abre WhatsApp o el correo y el PDF se adjunta a mano. No hay enlace público con aceptación. |
| Respuesta del cliente | Integrada | «Pide cambios» y «No lo acepta» abren una versión nueva con el motivo; no hay estado propio. |
| Obra | Integrada | Propone tareas desde los capítulos aceptados. |
| Materiales | Integrada | No hay vínculo con la partida de origen. |
| Planos y fotos | Integrada | Lista por tipo y filtro. Sin miniaturas en esta pestaña. |
| Cobros | Integrada | Aceptado, facturado, cobrado y lo que se puede facturar según el avance. |
| Facturas | Integradas | Base, IVA y total, número al enviar, Borrador / Enviada / Vencida / Cobrada, PDF y recordatorio. Plano las registra: no sustituyen a la oficial. Sin NIF del cliente, factura suelta ni rectificativas. |
| Chat | Integrada en parte | Flota, tiene lupa, cuadrícula, chips, clip, @ y «Hacer tarea». Falta responder citando, tarjetas, ✓✓ y foto de grupo: no hay dato. |
| Agenda | Integrada en parte | Calendario con Día por persona, Semana o 3 días, Mes y Lista, minicalendario y «Qué mostrar». Sin rejilla por horas, línea de ahora ni tipos de cita: las tareas no tienen hora. |
| Avisos y aro del avatar | Integrados en parte | Deducidos de menciones, tareas y clientes sin contestar. Lo leído es local a cada dispositivo. |
| Móvil | Integrado | Barra con «+» central, tarjetas en Hoy, apartados en la ficha, presupuesto por tarjetas con barra fija, chat a pantalla completa, Más con la cuenta y hojas inferiores. Sin Gasto ni ficha de stock. La visita sigue sin rediseñar. |
| Clientes y ficha | Integradas en parte | Sin teléfono, correo ni NIF: el cliente no es una entidad todavía. |
| Finanzas | Integrada en parte | Facturado, cobrado, pendiente, aceptado, por cobrar y lista de facturas por estado. Sin gastos, beneficio ni margen. |
| Catálogo y ficha de artículo | Integrada en parte | Buscador tolerante, categoría, acordeón y panel. Sin proveedor, stock, subcategorías ni fotos. |
| Ajustes | Integrada | |

Lista de datos necesarios para completar lo pendiente: `docs/PREGUNTAS.md`, entrada del 31 de octubre de 2026.

Secciones que dejan el menú: Presupuestos, Compras y Documentos. En móvil, Clientes, Catálogo y Finanzas pasan a Más. Viven en cada proyecto y sus vistas de todos los proyectos siguen accesibles desde Ajustes y Más.

Comprobación: `npm run check` y el recorrido `tests/usabilidad/presupuesto.browser-check.cjs` en modo demostración.
