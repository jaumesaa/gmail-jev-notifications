# Instalar y configurar

## Compilar

1. Instala Xcode 27 desde Apple y ábrelo para completar su instalación. Selecciona sus herramientas en Xcode → Settings → Locations → Command Line Tools. Acepta sus condiciones personalmente si te las solicita.
2. Descarga/clona este repositorio. Instala Node.js 22+ desde su fuente oficial si no lo tienes. Python 3 debe estar disponible.
3. Ejecuta `npm ci`, `npm test` y `npm run build:mac` en la carpeta del proyecto.
4. En Finder, abre `dist/GmailJev.app`. Puedes moverla a Aplicaciones para conservar su ubicación. Si la mueves, no mantengas varias copias activas de la app.

## Activar en Safari

1. Safari → Ajustes → Avanzado → Mostrar funciones para desarrolladores web.
2. En los ajustes o el menú Desarrollo, permite **extensiones sin firmar** para esta sesión de desarrollo. Este permiso habilita también otras extensiones locales; úsalo solo con código que conozcas. Puede restablecerse al cerrar Safari.
3. Safari → Ajustes → Extensiones → activa **Notificaciones de Gmail con Jev** (la app contenedora se llama GmailJev).
4. Abre Gmail, pulsa el botón de la extensión y permite el acceso a **mail.google.com**. Recarga Gmail después de activar por primera vez.
5. Abre la app GmailJev y permite sus notificaciones.

Si no aparece la extensión tras compilar o actualizar, abre GmailJev y pulsa **Abrir ajustes de Safari** para que Safari actualice el registro. Comprueba que abriste la app compilada completa y que Safari permite extensiones locales. La carpeta web por sí sola no contiene el componente nativo. En equipos administrados la organización puede impedir este tipo de extensiones.

## Configurar desde la extensión

1. Abre **Clave y ajustes**.
2. Pega una clave de la consola oficial de TypeSafe y pulsa **Guardar clave**. El campo se vacía; la clave no se muestra de nuevo.
3. Pulsa **Probar conexión**. Esta acción envía una muestra sintética, no un correo, y consume saldo de TypeSafe.
4. Pulsa **Enviar aviso de prueba**. Con el ajuste inicial deben aparecer la ventana flotante y el aviso de macOS (según permisos y Concentración).
5. Escribe qué correos merecen un aviso, elige lectura en pestaña temporal o solo vista previa, revisa el límite diario y pulsa **Guardar y activar**.
6. Mantén la lista de **Recibidos** de Gmail abierta. Tras unos segundos, la extensión debe mostrar **Gmail conectado**.

## Diagnóstico

| Síntoma | Comprobación |
| --- | --- |
| No conecta con la app | Instala la app completa; cargar solo la carpeta web no permite native messaging |
| Esperando Gmail | Recibidos abierto, permiso del sitio concedido, Gmail recargado y pestaña cargada |
| Algunas fechas no se reconocen | Usa Gmail en español o inglés; informa del formato con un ejemplo ficticio |
| Jev coincide pero no aparece aviso | Revisa permiso de notificaciones y Concentración; usa la prueba de aviso |
| HTTP 401/403 | Revisa la clave oficial y sus permisos en TypeSafe |
| HTTP 429/529 | Espera: hay como máximo dos reintentos con espera creciente |
| Wifi bloquea Twitch | No afecta a la lectura del correo; sí podría impedir ver el directo |
| Wifi bloquea TypeSafe o Gmail | El filtro necesita ambas conexiones; mostrará el error y no tratará un fallo como «no relevante» |
| Se alcanzó el máximo diario | El filtro se pausa. Revisa el consumo antes de aumentar el límite o reactivarlo |

Si una pestaña temporal queda abierta, puedes usar **Reintentar lectura pendiente** con el filtro activo en lectura completa. El reintento evalúa con los criterios actuales y cuenta contra el límite diario. Mantén abierta esa pestaña. Si prefieres cerrarla, revisa antes que ese correo vuelva a estar sin leer. La extensión no cierra automáticamente una pestaña si no pudo confirmar la restauración.

## Desinstalar

Pausa el filtro, pulsa **Borrar clave** y **Borrar actividad local**. Desactiva la extensión en Safari y elimina la app. Safari gestiona el resto del almacenamiento de la extensión. Si ya eliminaste la app sin borrar la clave, puedes eliminar la entrada `GmailJev.TypeSafe` desde Acceso a Llaveros. Una copia de la clave guardada en TypeSafe no se revoca al borrar su copia local; revócala en la consola si también deseas invalidarla.

## Avisos y diagnóstico

En los ajustes de la extensión puedes seleccionar ambos avisos, solo macOS o solo ventana flotante. La selección se guarda al activar o pausar. La app incluye **Probar ambos avisos** y un diagnóstico de entrega sin asuntos ni remitentes. El botón de prueba de la extensión comprueba además el envío a la app; «Solicitud enviada» no confirma por sí solo que macOS haya mostrado un banner. Revisa el diagnóstico y los ajustes de notificaciones/modos de concentración si no aparece. La ventana flotante permanece hasta cerrarla o recibir otra coincidencia y no necesita el permiso de banners de macOS.

Al actualizar una compilación local con firma ad-hoc, macOS puede volver a pedir permiso de acceso al llavero para GmailJev Extension. Completa ese aviso personalmente; mientras espera, las operaciones con la clave pueden quedar pendientes.
