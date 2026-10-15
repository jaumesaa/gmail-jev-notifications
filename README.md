# Notificaciones de Gmail con Jev

**Escribe qué correos merecen tu atención. Jev decide cuáles generan un aviso.**

Extensión exclusiva para **Gmail en Safari para Mac**, gratuita y con código abierto. Tú aportas una API key de TypeSafe; las evaluaciones consumen tu saldo. Sin suscripción a esta extensión, servidor propio, Google Cloud ni configuración OAuth.

> **Estado: versión preliminar 0.1.0.** Compilada para Apple Silicon e Intel y con pruebas automatizadas. La conexión real con Jev, el guardado de clave y la ventana flotante se han comprobado en el Mac de desarrollo. La lectura de filas de Gmail y el envío de avisos desde Safari a la app también se han comprobado. La prueba completa con una llegada nueva de Gmail y la visibilidad del aviso de macOS siguen pendientes. No se presenta como una versión de producción ya validada. Consulta [la lista de publicación](docs/RELEASE.md).

## Qué hace

1. Abres Gmail en **Recibidos** y permites el acceso de la extensión a `mail.google.com`.
2. Guardas tu API key desde **Clave y ajustes**. Se almacena en el llavero de macOS.
3. Escribes algo como: **«Avísame cuando haeyoday empiece un directo o mi profesor cambie una entrega. Ignora promociones y resúmenes.»**
4. Activas el filtro. La lista actual se toma como referencia, sin procesar el historial.
5. Cada mensaje nuevo detectado se abre en una pestaña temporal de fondo. Se lee el cuerpo, se devuelve a sin leer si lo estaba y se cierra esa pestaña. Jev evalúa el contenido y, si cumple tu criterio, recibes una ventana flotante sobre las demás aplicaciones y un aviso de macOS con el asunto y el remitente originales. Puedes elegir ambos o uno solo. También puedes elegir modo «solo vista previa».

Puedes cambiar el criterio, la probabilidad mínima, el modelo y el máximo de consultas diarias. La pausa invalida las decisiones pendientes antes de avisar.

## Límites que debes conocer

- **Gmail y Safari deben seguir abiertos.** Puede funcionar con la pestaña en segundo plano mientras Safari la mantenga cargada. Una pestaña suspendida, un Mac dormido o Safari cerrado interrumpen la vigilancia.
- **La detección parte de la lista de Recibidos visible.** En el modo de lectura (predeterminado) se abre cada nuevo correo en una pestaña temporal, se lee el último mensaje visible de la conversación (hasta 12.000 caracteres) y los destinatarios que Gmail exponga. No se leen adjuntos ni cuerpos dinámicos dentro de iframes de otros dominios. En modo «solo vista previa» se usa únicamente el fragmento de Recibidos. Mantén habilitados los fragmentos de Gmail.
- **La lectura puede marcar temporalmente el correo como leído.** Si estaba sin leer, se intenta restaurar y se comprueba antes de cerrar la pestaña. Si falla, la pestaña permanece abierta, no se consulta Jev y el diagnóstico pide revisión. Cerrar Safari durante la lectura puede interrumpir esta restauración.
- No vigila automáticamente todas las categorías de Recibidos, carpetas, búsquedas ni todas las páginas de una bandeja. Cada navegación establece una nueva referencia para evitar avisos históricos.
- Se admiten fechas visibles de Gmail en inglés y español. Otros formatos no reconocidos se omiten y aparecen en el diagnóstico. Cambios futuros del HTML de Gmail pueden requerir actualizar el adaptador.
- Una conversación se identifica por su ID y su vista previa/fecha. Una respuesta que no cambie ninguno de esos datos puede pasar inadvertida. También puede omitir mensajes si Gmail no los renderiza, si llegan durante el establecimiento inicial de la referencia o si Safari suspende la pestaña.
- Un correo que anuncia un directo **no verifica que el streamer continúe en directo**. La extensión no consulta Twitch, por lo que no necesita acceder a enlaces bloqueados de Twitch para decidir el aviso.
- Jev puede equivocarse. Prueba tus criterios con mensajes representativos, especialmente en español.

## Instalación gratuita desde el código

Necesitas un Mac, **Xcode 27** con sus herramientas seleccionadas, Node.js 22 o posterior y Python 3. La app se compila con firma local y no requiere contratar Apple Developer para construirla.

```sh
git clone https://github.com/jaumesaa/gmail-jev-notifications.git
cd gmail-jev-notifications
npm ci
npm test
npm run build:mac
```

El resultado estará en `dist/GmailJev.app` y `dist/GmailJev-macOS.zip`. Abre la app desde Finder, usa **Abrir ajustes de Safari** y sigue [la guía de instalación](docs/INSTALL.md).

**No es una instalación de la App Store.** Safari requiere permitir extensiones sin firmar para la compilación de desarrollo; este ajuste puede tener que repetirse al reiniciar Safari. La firma local no es una firma Developer ID notarizada. No desactives Gatekeeper globalmente para instalarla.

Safari 27 también permite cargar una carpeta de extensión temporal, pero **cargar solamente `extension/` no basta en este proyecto**: la clave, las llamadas a TypeSafe y los avisos requieren el componente nativo incluido en la app compilada.

Una distribución firmada y notarizada o mediante App Store es trabajo de publicación adicional y requiere las credenciales correspondientes de Apple. Publicar el código en GitHub no elimina ese requisito. El objetivo de esta primera publicación es compartir una base auditable y compilable gratuitamente.

## Configuración

- **API key:** una clave de [la consola oficial de TypeSafe](https://console.typesafe.ai). Se introduce desde la extensión, no editando archivos. El destino está fijado a `https://api.typesafe.ai/v1/systemone`; no se admiten claves de pasarelas de terceros.
- **Modelo inicial:** `jev-1.13.0`, fijado para evitar cambios silenciosos. Puedes elegir `jev-1.14.0` desde los ajustes.
- **Probabilidad mínima inicial:** 80 %. Es un punto de partida, no una garantía de precisión. Baja el umbral si prefieres más avisos; súbelo si prefieres menos interrupciones.
- **Máximo diario inicial:** 100 llamadas, con reinicio a las 00:00 UTC. Los reintentos de evaluación cuentan. Las pruebas manuales de conexión también consumen saldo (se contabilizan por separado de este límite automático).
- **Avisos:** elige ambos, solo macOS o solo ventana flotante. Abre la app, pulsa **Permitir notificaciones** y **Probar ambos avisos**. La ventana permanece hasta cerrarla o recibir otra coincidencia, que la reemplaza; no roba el foco. Los modos de concentración y ajustes de macOS pueden ocultar el aviso del sistema. La app incluye un diagnóstico sin contenido de correos.

**Activar** establece una nueva referencia. Los correos ya visibles no se recorren retroactivamente. Si cambias los criterios, vuelve a activar para empezar una sesión con esas reglas.

## Privacidad y seguridad

Los campos evaluados se envían a **TypeSafe**, un tercero. La clave se usa únicamente en el componente nativo y no se entrega al script que lee Gmail ni se devuelve al navegador al consultar el estado. La introduces en una pantalla de extensión, no en una página de Gmail.

No hay telemetría, anuncios, backend del autor, acceso a cookies, contraseñas, adjuntos ni permisos para otras webs. El modo de lectura sí envía el cuerpo y destinatarios disponibles a TypeSafe. Se conserva localmente una cola temporal de vistas previas pendientes, hashes de deduplicación y un historial limitado de estados/probabilidades. Consulta [PRIVACY.md](PRIVACY.md) y [SECURITY.md](SECURITY.md).

## Desarrollo

```sh
npm ci
npm run check
npm test
npm run build:mac
```

El único paquete npm externo se usa en pruebas de DOM; no se empaqueta en la extensión. No hay dependencias de ejecución de terceros.

| Ruta | Responsabilidad |
| --- | --- |
| `extension/gmail.js` | Observar vistas previas de Recibidos; referencia inicial y fechas |
| `src/background.js` | Cola persistente, lector, deduplicación, presupuesto, pausa y decisiones |
| `extension/background.js` | Bundle generado sin dependencias ni módulos de fondo |
| `extension/reader.js` | Leer cuerpo en pestaña temporal y restaurar sin leer |
| `extension/lib/core.js` | Validación y construcción de la pregunta de Jev |
| `extension/ui.*` | Configuración y diagnóstico |
| `native/` | Llavero, transporte HTTPS de TypeSafe y avisos nativos |
| `scripts/build-mac.sh` | Generar el proyecto Xcode y compilar la app universal |
| `tests/` | Casos de regresión con mensajes sintéticos; nunca correo real |

Tras editar el código de fondo o core, ejecuta `node scripts/bundle.mjs`; `npm run check` comprueba que el bundle esté actualizado.

Lee [ARCHITECTURE.md](docs/ARCHITECTURE.md), [CONTRIBUTING.md](CONTRIBUTING.md) y [la guía de publicación](docs/RELEASE.md).

## Referencias oficiales

- [API de TypeSafe](https://docs.typesafe.ai/api), [Noul](https://docs.typesafe.ai/primitives/noul), [modelos](https://docs.typesafe.ai/models).
- [Ejemplo de filtrado de Twitch](https://docs.typesafe.ai/cookbooks/twitch_chat_filter) y [limitaciones de Jev 1.13](https://docs.typesafe.ai/model-jaggedness/jev-1.13).
- [Native messaging de Safari](https://developer.apple.com/documentation/safariservices/messaging-between-the-app-and-javascript-in-a-safari-web-extension).
- [Crear extensiones para Safari, WWDC26](https://developer.apple.com/videos/play/wwdc2026/216/).

## License

MIT. Proyecto independiente, sin afiliación con Google, Apple, Twitch ni TypeSafe. [English overview](docs/README.en.md).
