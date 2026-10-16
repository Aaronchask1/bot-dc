# XYB Private Bot

Base inicial del bot privado de Discord.

## Incluye

- Prefijo `xyb`.
- `xyb help`: menú visual por categorías con selector interactivo.
- `/help`.
- Respuesta al mencionar únicamente al bot: `Mi prefijo es xyb`.
- `xyb kiss usuario`, `xyb kc usuario` y `/kiss`: envía un beso que solo la persona elegida puede corresponder o rechazar; al responder, el bot contesta con una imagen de regalo de besos.
- `xyb server` y `/server`: muestra la ficha del servidor actual.
- Moderación: `xyb kick`, `xyb ban`, `xyb unban`, `xyb mute`, `xyb unmute`, `xyb lock` y `xyb unlock`; también disponibles como comandos `/`.
- Limpieza: `xyb purge 1-1000` o `xyb c 1-1000` para moderadores; `xyb purge bots` o `xyb c bots [1-1000]` borra solo mensajes de bots; `xyb pg` o `xyb apg` limpia los mensajes propios.
- Antispam: silencia automáticamente por una hora tras 8 mensajes consecutivos iguales en menos de 5 minutos.
- `xyb avatar`, `xyb banner`, `xyb ping`, `xyb botinfo`: ficha, avatar, banner, latencia y estado del bot.
- `.lookup 3`, `!lookup 4`, `xyb lookup 5` o `/lookup`: comprobación global de candidatos, con avatar, fecha de consulta, páginas y filtros. También acepta `lookup vanity 6`.
- `xyb snipe [n]`: recupera hasta 10 mensajes borrados del canal, con quién los borró.
- `xyb prefix add !` / `remove` / `set`: agrega prefijos extra (hasta 5). `xyb` nunca se puede quitar.
- `xyb welcome`: panel con botones para configurar la bienvenida (canal, mensaje, título, footer, color, imagen, thumbnail, mención y embed). `xyb welcomevars` lista las variables y `xyb welcometest` la prueba.
- `xyb steal`: crea un sticker en el servidor a partir de un emoji o de un PNG/APNG/Lottie.

## Preparación

1. Instala Node.js 24 LTS (incluye soporte para la biblioteca de voz actual).
2. En esta carpeta, ejecuta `npm install`.
3. Copia `.env.example` como `.env` y completa `DISCORD_TOKEN`, `CLIENT_ID` y, para pruebas rápidas, `GUILD_ID`.
4. En el portal de desarrolladores de Discord, activa los intents **Message Content** y **Server Members**. Luego pon `MEMBERS_INTENT=true` en `.env`: es necesario para usar nombres o apodos sin mencionar a la persona (por ejemplo, `xyb kiss csr`).
5. Registra los comandos con `npm run register`.
6. Inicia el bot con `npm start`.

Nunca compartas el token de Discord ni lo subas a GitHub.

Comprobaciones: `npm test` (candado anti-duplicados y guardia de repeticiones) y `npm run check:images` (que las imágenes de los besos sigan en pie). Todo lo que pasa se queda anotado en `logs/bot.log`.

## Comandos añadidos después

Viven en `src/commands/`, se cargan solos al arrancar y también se registran como `/comando` (`npm run register` los añade al final de la lista).

| Comando | Qué hace |
| --- | --- |
| `xyb avatar` (`pfp`, `av`, `foto`) | Avatar en grande de alguien. |
| `xyb banner` (`bn`) | Banner de alguien, con caché de 5 minutos. |
| `xyb ping` (`ms`, `latencia`) | Latencia de mensaje y de gateway. |
| `xyb botinfo` (`info`, `stats`) | Uptime, memoria, servidores, versión. |
| `xyb snipe` (`s`, `recuperar`) | Últimos mensajes borrados del canal. |
| `xyb lookup [vanity] [2-32/todos] [texto]` | Comprueba candidatos globales de nombres y enlaces vanity. |
| `xyb prefix` (`prefijos`) | Agrega o quita prefijos del servidor. |
| `xyb welcome` (`wlc`) | Panel de bienvenida. |
| `xyb welcomevars` | Variables disponibles: `{{user}}`, `{{username}}`, `{{tag}}`, `{{id}}`, `{{server}}`, `{{members}}`, `{{count}}`. |
| `xyb welcometest` | Muestra cómo quedaría la bienvenida. |
| `xyb steal` (`rob`) | Convierte un emoji o imagen en sticker del servidor. |

Permisos que hacen falta:

- **Server Members Intent** en el portal (y `MEMBERS_INTENT=true` en `.env`) para que la bienvenida se dispare al entrar alguien.
- **Gestionar stickers y emojis** para `xyb steal`.
- **Gestionar servidor** para `xyb prefix` y `xyb welcome`.

Los prefijos extra no duplican nada: `normalizeCustomPrefix` en `src/index.js` reescribe el mensaje a `xyb ...` antes de que lo vea la lógica que ya existía.

## Si el bot responde dos veces

Discord reparte cada evento entre **todas** las sesiones abiertas con el mismo token, así que si hay dos copias del bot en marcha (por ejemplo, una en el PC y otra en Railway o Render) cada mensaje recibe dos respuestas idénticas.

- El bot deja un candado en `data/bot.lock` al arrancar. Si esa carpeta ya tiene otra copia viva, el proceso nuevo se cierra solo con un mensaje explicando cuál es el PID que estorba.
- Comprueba que no haya más de una copia viva. En Windows: `Get-CimInstance Win32_Process -Filter "Name='node.exe'" | Select-Object ProcessId, CommandLine`.
- Si el candado quedó de un proceso que ya no existe, se reutiliza solo; si quieres borrarlo a mano, elimina `data/bot.lock`.
- Recuerda que el candado solo protege la misma carpeta: si despliegas en Railway, detén la copia local o la de Railway, nunca las dos.

## Moderación

- `xyb kick @usuario [razón]` o `xyb expulsar @usuario [razón]` requiere **Expulsar miembros**.
- `xyb ban @usuario [razón]` o `xyb banear @usuario [razón]` requiere **Banear miembros**.
- `xyb unban ID_DEL_USUARIO [razón]`, `xyb sacarban ID_DEL_USUARIO [razón]` o `xyb unban all` requiere **Banear miembros**. `all` muestra un resumen de los baneos que pudo quitar.
- `xyb mute @usuario minutos [razón]`, `xyb silenciar` y `xyb mutear` requieren **Moderar miembros**. Discord permite de 1 minuto a 28 días (40320 minutos).
- `xyb unmute @usuario` o `xyb desmutear @usuario` requiere **Moderar miembros**.
- `xyb lock` y `xyb unlock` requieren **Gestionar canales**.
- `xyb purge <1-1000>` y `xyb c <1-1000>` requieren **Gestionar mensajes**.
- `xyb purge bots [1-1000]` y `xyb c bots [1-1000]` requieren **Gestionar mensajes** y solo eliminan mensajes de bots.
- `xyb pg` y `xyb apg` no requieren rol; borran hasta 1000 mensajes recientes del autor. El bot igualmente requiere **Gestionar mensajes** para poder borrarlos.

El bot necesita esos mismos permisos y su rol debe estar por encima del usuario que se pretende moderar.

## Interacciones

Cuando alguien use `xyb kiss @usuario` o `/kiss`, el bot publica un embed con botones **Corresponder** y **Rechazar**. Solo la persona mencionada puede pulsarlos y los botones desaparecen en cuanto responde.

- Al lanzar el beso: imagen de beso al azar.
- **Corresponder**: el bot responde con un mensaje nuevo, visible para todo el canal, con una imagen de regalo de besos y el contador actualizado.
- **Rechazar**: mensaje nuevo con una imagen de rechazo.

Los contadores de besos se guardan en `data/kiss-counts.json`; en Railway, ese directorio debe estar en un volumen persistente si se quieren conservar tras un despliegue. Si alguna imagen deja de funcionar, `npm run check:images` dice cuál y basta con cambiarla en `src/index.js`.

El contador es compartido por pareja y servidor: A besa a B = 1; B corresponde = 2; B besa a A = 3; A corresponde = 4. Los antiguos contadores separados por dirección se suman automáticamente sin reiniciarse. Un rechazo no suma ni borra el total. Solo se permite una respuesta por beso; el botón caduca a las 24 horas. Se guarda en memoria con escritura agrupada para evitar leer y reescribir el archivo en cada interacción.

## Perfil social

`xyb profile`, `xyb perfil`, `xyb profile @persona` y `/profile` muestran avatar, frase, profesión personal, nivel, ranking del servidor, besos compartidos y matrimonio. El selector permite editar tu propia frase y profesión. Los besos compartidos incluyen ambos sentidos; no son un conteo separado de enviados y recibidos.

El progreso empieza con la actividad que registra XYB desde esta actualización: 15 XP por mensaje, como máximo una vez por minuto. Bots y mensajes bloqueados por antispam no ganan XP. Nivel = parte entera de √(XP/100); ranking entre perfiles registrados en ese servidor. La fecha de registro corresponde a XYB, no a la creación de la cuenta de Discord. No se importan monedas, inventarios o estadísticas de otros bots. Datos en `data/profiles.json` (o `XYB_DATA_DIR`).

Para reducir esperas, las menciones y comandos sin argumentos no buscan miembros por la red. Las búsquedas por nombre usan REST cuando está disponible; las imágenes de besos se almacenan en caché de memoria de hasta 32 MiB, con límite de descarga de 1,5 segundos y enlace directo si el proveedor tarda. Los botones de besos confirman la interacción antes de preparar la imagen. La latencia de la red/Discord sigue siendo externa al bot.

## Antispam automático

El owner del servidor queda excluido. Para cualquier otra persona, si envía 8 mensajes iguales consecutivos en una ventana de 5 minutos, XYB la silencia automáticamente durante una hora. El bot necesita **Moderar miembros** y un rol superior al de esa persona para poder hacerlo.

## Nombres y vanities: lookup

Ejemplos: `.lookup 3`, `.lookup 4`, `.lookup 5`, `.lookup 6`, `.lookup todos`, `.lookup vanity 4` y `.lookup 5 ab`. También funcionan `!lookup`, `xyb lookup` y `/lookup` con opciones de tipo, longitud y texto. La longitud admite de 2 a 32 caracteres; sin número busca 3. `todos` genera distintas longitudes. `.lookup check nombre` y `.lookup vanity check codigo` comprueban un candidato concreto. No cambian tu nombre ni reclaman URLs.

El buscador genera hasta 12 candidatos por tanda y comprueba cada uno globalmente, no solo en tu servidor. Los cinco botones permiten retroceder, avanzar, buscar otra tanda (con texto opcional), cerrar y filtrar. Incluye letras, números y símbolos admitidos: `_.` para usernames, `-` para candidatos vanity. También permite solo letras, solo números o alfanuméricos. El panel dura 15 minutos y lo maneja quien lo abrió. Cerrar detiene la tanda después de la petición en curso.

**No es un registro completo de Discord ni una copia del historial de Greed.** Las fechas son de comprobación, nunca fechas de abandono. Los nombres de tres caracteres son escasos: una tanda puede no encontrar ninguno. Los usernames se incluyen solo cuando la consulta responde `taken: false`; pueden ocuparse después y Discord aún puede rechazar su asignación. Para vanities, `Unknown Invite` solo indica que no hay una invitación activa: NO confirma que la URL pueda asignarse. Las invitaciones existentes tampoco se identifican necesariamente como vanities.

Implementación: consulta pública anónima de usernames `POST /api/v9/unique-username/username-attempt-unauthed` y consulta de invitaciones `GET /api/v10/invites/{code}`. La primera no pertenece a la API documentada de bots y puede dejar de funcionar. No usa tokens de usuarios, cookies, selfbots, proxies ni evasión de CAPTCHA. No requiere Server Members Intent para lookup. Solo hay una tanda global a la vez, con al menos seis segundos entre consultas. Ante 429 respeta la espera indicada; ante restricciones/CAPTCHA detiene las consultas. Nunca interpreta un error como disponibilidad.

La caché se conserva en `data/lookup-cache.json`, hasta 25 000 comprobaciones; los resultados libres/sin invitación caducan a los 15 minutos y los ocupados a la hora. Mantén `data/` en almacenamiento persistente al desplegar. Cada nueva tanda se solicita manualmente; no hay barridos ilimitados en segundo plano. Después de actualizar archivos, reinicia una sola copia del bot con `npm start`; para publicar o actualizar `/lookup`, usa `npm run register`.
