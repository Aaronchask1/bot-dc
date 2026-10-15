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
- `.lookup 3`, `!lookup 4`, `xyb lookup 5` o `/lookup`: nombres abandonados detectados por XYB, con avatar, fechas, páginas, búsqueda y filtros. También acepta `lookup vanity 6`.
- `xyb snipe [n]`: recupera hasta 10 mensajes borrados del canal, con quién los borró.
- `xyb prefix add !` / `remove` / `set`: agrega prefijos extra (hasta 5). `xyb` nunca se puede quitar.
- `xyb welcome`: panel con botones para configurar la bienvenida (canal, mensaje, título, footer, color, imagen, thumbnail, mención y embed). `xyb welcomevars` lista las variables y `xyb welcometest` la prueba.
- `xyb steal`: crea un sticker en el servidor a partir de un emoji o de un PNG/APNG/Lottie.

## Preparación

1. Instala Node.js 18 o superior.
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
| `xyb lookup [vanity] [2-32] [texto]` | Nombres y vanities abandonados detectados por XYB. |
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

## Antispam automático

El owner del servidor queda excluido. Para cualquier otra persona, si envía 8 mensajes iguales consecutivos en una ventana de 5 minutos, XYB la silencia automáticamente durante una hora. El bot necesita **Moderar miembros** y un rol superior al de esa persona para poder hacerlo.

## Nombres y vanities: lookup

Ejemplos: `.lookup 3`, `.lookup 4`, `.lookup 5`, `.lookup 6`, `.lookup vanity 4` y `.lookup 5 ab`. También funcionan `!lookup`, `xyb lookup` y `/lookup` con opciones de tipo, longitud y texto. La longitud admite de 2 a 32 caracteres; sin número muestra todas. Los cinco botones permiten retroceder, avanzar, buscar, cerrar el panel y filtrar por letras, números o nombres sin símbolos. El panel dura 15 minutos y lo maneja quien lo abrió.

XYB registra cambios reales de **nombre de usuario** recibidos por Discord (no apodos ni nombres visibles). La primera observación de una persona solo fija su nombre actual. Las fechas indican cuándo se detectó el cambio. La lista de usernames es del servidor donde se consulta; la de vanities reúne cambios de URLs personalizadas de los servidores donde está XYB. Si vuelve a detectar un nombre o vanity en uso, lo retira de la lista.

El catálogo empieza vacío y crece con los cambios recibidos desde su activación. No importa la base de Greed, no reconstruye cambios anteriores y **no confirma que los nombres estén disponibles para registrarlos**. Para usernames, habilita Server Members Intent en el portal y `MEMBERS_INTENT=true` en `.env`; el bot carga una referencia inicial y después usa los eventos. Fuente de estos eventos: [Discord Gateway Events](https://docs.discord.com/developers/events/gateway-events#guild-member-update).

Se conserva en `data/username-lookup.json` con caché y escritura atómica agrupada, usando el almacén existente del bot. Conserva hasta 10 000 nombres abandonados por servidor y 10 000 vanities. Mantén `data/` en almacenamiento persistente al desplegar. No se envían mensajes de historial automáticamente a los canales.
