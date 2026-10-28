# Importar expedientes

Cómo cargar en un espacio de trabajo (producción o demo) proyectos reales con sus presupuestos y documentos a partir de una carpeta preparada. Sirvió para los expedientes de GARAL; vale para cualquier otra carpeta con el mismo formato.

## Qué hace

- Crea cada proyecto (nombre, cliente, tipo) por el comando `project.create`, como si se diera de alta a mano.
- Cada presupuesto del expediente entra como un presupuesto propio (ámbito) con su **V1 en borrador**: una partida alzada por capítulo (`unit: global`, cantidad 1, el importe del capítulo) y, en las notas, de qué PDF sale y si las partidas cuadran con el total impreso en el documento. Las opciones del documento entran como alternativas que no suman.
- Sube los PDF y vídeos a Documentos del proyecto (planos → «Planos», presupuestos → «Contratos y presupuestos», hojas de pedido → «Otros», vídeos → «Fotos de antes»). Los archivos de más de 50 MB y los DWG no se importan y quedan anotados.
- Los proyectos que ya existen (mismo nombre y cliente) **no se tocan**, así que se puede repetir sin duplicar.
- Nada escribe en la base de datos por detrás: todo pasa por los comandos y las subidas de siempre, con los permisos del usuario que importa (oficina o administración).

## Dónde está

«Más → Importar expedientes» (`/configuracion/importar`). Se elige la carpeta, se revisa la tabla de lo que va a entrar y se pulsa «Importar». Los documentos se suben uno a uno; con vídeos puede tardar unos minutos. La pantalla muestra el progreso y, al final, errores y avisos.

## El paquete

La carpeta debe contener `plano-importacion.json` y la subcarpeta `archivos` con los documentos, a los que el paquete se refiere por su ruta relativa dentro de `archivos`. Formato (`src/lib/importar-expedientes.ts`, `paqueteSchema`):

```json
{ "schema_version": 1, "origen": "…", "proyectos": [ {
  "name": "Reforma integral · Cliente", "client_name": "Cliente", "location": "", "kind": "integral|partial|carpentry",
  "presupuestos": [ { "title": "Presupuesto 01 Cliente", "items": [ { "chapter": "Demolición", "description": "…", "quantity": 1, "unit": "global", "unit_price": 1237500, "vat_rate": 21, "adjustment_percent": 0, "inclusion": "included" } ], "notes": "…" } ],
  "documentos": [ { "path": "HUGO/…/Plano.pdf", "name": "Plano.pdf", "category": "plan", "mime": "application/pdf", "size": 12345 } ],
  "omitidos": [ "Video.mp4 (80 MB)" ]
} ] }
```

Los importes van en céntimos. El paquete de GARAL se genera con un script fuera del repositorio a partir del inventario y los textos extraídos de los PDF; el material de GARAL no se copia al repositorio.

## Límites conocidos

- Las partidas salen de la prosa de los PDF («- Capítulo. Descripción… Total: X €»): son alzadas, sin mediciones ni precios unitarios. Para presupuestar de nuevo conviene recomponerlas con el catálogo.
- Las partidas «en rojo» de los originales (no incluidas) no se distinguen por texto; cuando el total impreso no cuadra, la nota del presupuesto lo avisa para revisarlo.
- No se importan clientes como entidad (no existe aún), ni tareas, compras ni certificaciones.
