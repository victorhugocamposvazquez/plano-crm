# PLANO

CRM de obras y reformas para GARAL. Next.js 16, React 19, TypeScript, Supabase y Vercel.

## Desarrollo

Requiere Node.js 22 o 24.

```sh
npm ci
npm run dev
```

Sin configuración de Supabase se utiliza una demostración local con datos ficticios. Los cambios se guardan en ese navegador; no se comparten entre personas. Los archivos de demostración se guardan en IndexedDB. No usar esta modalidad como archivo real de una obra.

```sh
npm run check
```

Comprueba tipos, ejecuta pruebas de cálculo, permisos, API y migraciones en PostgreSQL embebido y compila la aplicación. No requiere credenciales ni modifica Supabase remoto.

## Estado

- Interfaz inicial de obras y buscador: Claude. Hay botones y flujos todavía pendientes de conectar.
- Dominio, cálculo decimal, revisiones, comparador de partidas y demostración local: implementados.
- API autenticada, comandos transaccionales, RLS, almacenamiento privado y migración inicial: implementados en código, pendientes de configurar y probar contra el proyecto Supabase real.
- Las certificaciones son **borradores de importes base**, no facturas, cobros ni certificaciones ya aprobadas. La facturación por unidades ejecutadas, conciliación y cierre económico quedan pendientes.
- La estimación desde fotos/360/voz, extracción de planos, publicación para clientes e importación histórica quedan pendientes. Ninguno de estos procesos se simula como IA funcionando.

La guía [despliegue](docs/despliegue.md) recoge los pasos para Supabase y Vercel. El [contrato de backend](docs/backend.md) permite conectar las pantallas sin modificar el motor. La coordinación entre agentes está en [AGENTS.md](AGENTS.md) y [docs/PREGUNTAS.md](docs/PREGUNTAS.md).

Los documentos originales de clientes no se copian al repositorio. Las credenciales solo van en `.env.local` y en los entornos de Vercel.
