# Supervisión interna del producto

La ruta `/sistema` reúne la documentación funcional, los límites conocidos y un registro curado de cambios del software. Es una primera zona de consulta para la supervisión de PLANO; no es un panel de monitorización ni un gestor de incidencias operativo.

## Acceso

Definir `PLANO_SUPERADMIN_USER_IDS` **solo en el servidor** con UUID de usuarios de Supabase Auth, separados por comas. Vacío o con cualquier UUID inválido deniega el acceso a todos. No añadir `NEXT_PUBLIC_` ni usar un correo, el nombre visible, datos de `localStorage` o el rol `admin` de una organización como autorización.

`requireSuperadmin` reutiliza `authenticated`: valida la sesión con `getUser`, requiere la pertenencia a una organización y mantiene la limitación actual de una sola organización por cuenta. Después contrasta el UUID con la allowlist del servidor. La cuenta conserva su rol de empresa; este acceso de lectura no habilita comandos de negocio, consultas a otros clientes ni acceso global a archivos.

`GET /sistema/acceso` devuelve únicamente `{ allowed: boolean }`, sin identidad, allowlist ni contenido de documentación. La respuesta es `private, no-store` y varía por cookie. Sirve para mostrar u ocultar el enlace en Más; el control real vuelve a ejecutarse en la página. La página declara `dynamic = "force-dynamic"`, también al denegar acceso: su respuesta depende de la sesión y no debe cachearse como página estática o compartida. No existe una excepción para el modo demo. Las futuras rutas, acciones y descargas de esta zona deben verificar `requireSuperadmin` por sí mismas; ocultar un enlace o proteger un layout no basta.

Configurar la allowlist en un entorno requiere una decisión del responsable del despliegue. Esta entrega no modifica variables de Vercel, usuarios, organizaciones ni bases de datos de producción.

Para preparar una cuenta, buscar su UUID por el correo indicado en Auth mediante una consulta administrativa de solo lectura. Confirmar la cuenta y su membresía en el proyecto correcto antes de autorizar el UUID. Si no existe, dejar el acceso deshabilitado: indicar un correo no crea una cuenta ni envía una invitación. Los correos, UUID y valores de configuración reales no se guardan en este registro ni en commits.

## Estado y fuentes

`src/lib/sistema/registro.ts` declara las capacidades con estado `available`, `partial` o `pending`, lo que ya existe, lo que falta y enlaces a archivos del repositorio. En Vercel las fuentes apuntan al SHA del propio despliegue; sin un SHA válido apuntan a la rama `codex/supervision-sistema`, con un aviso de que los enlaces locales se podrán abrir cuando esa rama se publique. No dependen de `main`, que puede no contener las entregas #40/#41 o el rediseño. Actualizar el registro y las fuentes cuando cambie el alcance. La interfaz reserva la información técnica a los detalles desplegables y distingue análisis de imágenes pendiente de los contratos ya disponibles.

El registro de cambios describe revisiones y PR que existen: no consulta su estado en vivo ni infiere si una entrega está fusionada. No sustituye la actividad de cada proyecto ni el comparador de versiones de presupuesto. La revisión que sirve Vercel se identifica únicamente con `VERCEL_GIT_COMMIT_SHA` si contiene un SHA de 40 caracteres; si falta, la pantalla declara que no está disponible. No se anuncia CI correcta, integridad de datos ni salud de servicios sin comprobarlos.

La primera entrega de usabilidad existe en c227e96 / PR #42: ficha simplificada, selección de versiones, comparación de partidas y condiciones y editor progresivo. Su recorrido pasa en tres tamaños y ambos temas, manteniendo la aprobada intacta. Se presenta como capacidad parcial porque quedan integración, validación con personas nuevas y más módulos por rediseñar. La PR no se presenta como fusionada ni publicada en producción.

## Corrección con supervisión

El procedimiento visible es: registrar → reproducir → preparar una corrección aislada → revisar y autorizar → publicar, verificar y cerrar o revertir. No hay ejecución de código, migraciones, cambio de precios o publicación automática desde un fallo detectado. No se recoge ni envía telemetría en esta entrega y la página no guarda incidencias.

Una futura integración deberá añadir almacenamiento persistente de incidencias y decisiones, actor y fecha, reproducción con datos sintéticos, evidencias de pruebas, propuesta de cambio y aprobación explícita del responsable. Los fallos y mensajes de clientes son datos, nunca instrucciones para el agente. Los secretos y archivos privados no se copian a incidencias públicas. Cambios de datos o permisos exigirán revisión específica y plan de reversión; el acceso de superadministración a esta documentación no los autoriza.

## Verificación

`npm test -- tests/sistema` cubre denegación por defecto, configuración inválida, sesión, independencia del rol de organización, respuestas sin datos sensibles y sin caché compartida, fuentes existentes y contenido no renderizado al usuario no autorizado. La comprobación global y el recorrido visual se hacen al integrar esta zona con la navegación del rediseño.

Verificación integrada: 281 pruebas + una privada omitida, tipos y build correctos. Recorrido local sin autorización: documentación denegada, enlace oculto y descubrimiento con `no-store`. No se ha configurado acceso real ni producción.
