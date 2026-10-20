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
- `xyb quote texto` o responde con `xyb quote`: genera una tarjeta visual que cita el mensaje y su autor.
- `.lookup 3`, `!lookup 4`, `xyb lookup 5` o `/lookup`: comprobación global de candidatos, con avatar, fecha de consulta, páginas y filtros. También acepta `lookup vanity 6`.
- `xyb snipe [n]`: recupera hasta 10 mensajes borrados del canal, con quién los borró.
- `xyb prefix add !` / `remove` / `set`: agrega prefijos extra (hasta 5). `xyb` nunca se puede quitar.
- `xyb welcome`: panel con botones para configurar la bienvenida (canal, mensaje, título, footer, color, imagen, thumbnail, mención y embed). `xyb welcomevars` lista las variables y `xyb welcometest` la prueba.
- `xyb steal`: crea un sticker en el servidor a partir de un emoji o de un PNG/APNG/Lottie.
- Comunidad: `xyb afk`, `xyb remind`, `xyb poll`, `xyb suggest`, `xyb act` y utilidades `xyb 8ball`, `xyb choose`, `xyb coinflip` y `xyb ship`. Al vencer, `xyb remind` te menciona en el mismo canal del servidor donde lo creaste.
- Interacciones con GIF: `xyb hug`, `xyb slap`, `xyb hi`, `xyb highfive`, `xyb pat`, `xyb cuddle`, `xyb poke`, `xyb wave`, `xyb dance`, `xyb bonk`, `xyb bite`, `xyb lick`, `xyb handhold`, `xyb feed`, `xyb heal`, `xyb blush`, `xyb cry` y `xyb laugh`. Cada acción elige un GIF acorde al contexto, con respaldos locales si el proveedor falla.
- Mascotas: compra un `🥚 Huevo misterioso` en `xyb shop`, incúbalo con `xyb pet hatch [nombre]` y cuídalo con frutas, pastel, juego y limpieza para ganar niveles.
- Música: `xyb play <canción o URL de YouTube/SoundCloud>` (también `/play`), `pause`, `resume`, `skip`, `queue`, `np`, `stop` y `volume 0-200`. YouTube es la fuente principal y SoundCloud el respaldo; usa yt-dlp + FFmpeg, sin cookies ni Lavalink. Detalles en [`MUSICA.md`](MUSICA.md).
- Metadatos: `xyb mb` (MusicBrainz) y playlists de YouTube Music con `xyb ytm`.

## Preparación

1. Instala Node.js 24 LTS (incluye soporte para la biblioteca de voz actual).
2. En esta carpeta, ejecuta `npm install`.
3. Copia `.env.example` como `.env` y completa `DISCORD_TOKEN`, `CLIENT_ID` y, para pruebas rápidas, `GUILD_ID`.
4. En el portal de desarrolladores de Discord, activa los intents **Message Content**, **Server Members** y **Guild Voice States**. Luego pon `MEMBERS_INTENT=true` en `.env`: es necesario para usar nombres o apodos sin mencionar a la persona (por ejemplo, `xyb kiss csr`).
5. Registra los comandos con `npm run register`.
6. Inicia el bot con `npm start`.

Para música, `yt-dlp` ya viene en `bin/` y FFmpeg se instala con npm. Si quieres
playlists de YouTube Music, ejecuta `npm run ytmusic` una vez (ver `MUSICA.md`).

Nunca compartas el token de Discord ni lo subas a GitHub.

Comprobaciones: `npm test` (candado anti-duplicados y guardia de repeticiones) y `npm run check:images` (que las imágenes de los besos y los GIF de interacción sigan en pie). Todo lo que pasa se queda anotado en `logs/bot.log`.

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
| `xyb hug` (`abrazo`, `abraza`) | Abrazo con GIF y botón para devolverlo. |
| `xyb act <acción>` (`slap`, `hi`, `pat`, `cuddle`, `handhold`...) | Interacciones con GIF al estilo Nekotina. También funcionan como alias directos: `xyb slap @persona`, `xyb hi`. |

Las acciones y los textos están inspirados en la página oficial de rol de [Nekotina](https://nekotina.com/en/modules/roleplay). Cada comando elige un GIF acorde al contexto (cariñoso, divertido o de saludo); si el proveedor externo falla, se usa una lista local de respaldo para que el comando nunca se quede sin imagen.

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
# Etiqueta de servidor obligatoria

La ejecución local mantiene `TAG_ENFORCEMENT_ENABLED=false`; el servicio de Railway
usa su propia variable para activar las revisiones, evitando dos monitores simultáneos.
Las consultas de perfil y miembro se contrastan: una etiqueta válida observada
protege a la persona y se exige ausencia en ambas consultas antes de actuar.

## Imágenes y mensajes temporales

Comando único: `xyb img descripción`, sin subcomandos obligatorios.
- `xyb img perro`: busca una imagen existente.
- `xyb img gato gracioso`: busca una plantilla popular de Imgflip.
- `xyb img gato encima de perro`: busca imágenes existentes relacionadas con la escena.
- `xyb img paisaje de Japón`: busca imágenes existentes del lugar.

Solo sitios web: Wikimedia Commons, Openverse e Imgflip. No se usa OpenAI,
no se generan imágenes y no hace falta clave ni saldo. La antigua clave de `.env`
no se utiliza. La búsqueda prueba la frase original y equivalencias de palabras
comunes en inglés; no es traducción por IA ni reconocimiento visual. Se ordenan
resultados según sus títulos/descripciones/etiquetas y se identifican las imágenes
relacionadas. No se garantiza que reproduzcan exactamente una escena inventada.
Si no hay coincidencias, se ofrece un enlace a Google Imágenes para abrir en el
navegador. Google no se rastrea automáticamente. Caché de búsquedas de 5 minutos.
Documentación: https://api.openverse.org/v1/
Catálogo de memes: https://imgflip.com/api

`xyb img perro` (alias `xyb imagen perro`) busca imágenes existentes en Wikimedia
Commons y Openverse, sin clave API ni generación de IA. Devuelve una imagen con autor,
licencia y enlace a su fuente. Admite búsquedas de hasta 300 caracteres.
El comando es por prefijo; no requiere registrar comandos slash.

Los mensajes nuevos de este bot en servidores se eliminan 5 minutos después de
enviarse; los avisos del uniforme, a los 5 minutos. No se eliminan mensajes de
personas ni de otros bots. Los plazos se guardan en `data/auto-delete.json` y se
recuperan al reiniciar; borrar un aviso no cancela el plazo de moderación.
Las respuestas efímeras no producen eventos públicos y quedan fuera de este
borrado. Los botones dejan de estar disponibles cuando se elimina su mensaje.
Estos cambios requieren iniciar/reiniciar el bot actualizado; no limpian el historial.

## Autorespuestas

El autoresponder no responde por defecto al mencionar o escribir el nombre de una
persona, y no incluye reglas automáticas. Solo responde a palabras o frases que un
administrador añada manualmente con `xyb add autoresponder ...` (o
`/autoresponder agregar`). No responde a bots, mensajes privados ni comandos `xyb`.
La configuración requiere Gestionar servidor: `/autoresponder` y `/autoreact`, o
`xyb autoresponder`/`xyb autoreact` (también `!` y los prefijos añadidos), con
`ver`, `agregar palabra respuesta`, `quitar palabra`, `activar`, `desactivar` y `reset`.
`autoreact` usa la misma estructura, pero recibe `agregar palabra emoji` y añade
la reacción configurada al mensaje; empieza sin reglas para que el servidor elija
sus propios emojis.
Atajos rápidos: `xyb add autoresponder palabra respuesta` y `xyb add autoreact palabra emoji`.
Puedes acumular varias respuestas o reacciones repitiendo el comando, o separándolas con `|`:
`xyb add autoresponder hola respuesta 1 | respuesta 2` y
`xyb add autoreact hola 🐷 | 🔥`. Las respuestas se eligen al azar y las reacciones se añaden todas.
(también funcionan con `!` y los demás prefijos). Estos atajos guardan la regla y
encienden automáticamente el módulo correspondiente.

Las pruebas automáticas solo cargan `test/*.test.js`. La herramienta manual
`scripts/uniform-live-test.js` exige `--execute-live` y no se ejecuta bajo el
runner de pruebas. No ejecutarla salvo que se quiera un aviso y posible ban real.

`TAG_ENFORCEMENT_ENABLED=true` y `TAG_GUILD_ID=1494581763899396136` activan
la revisión horaria únicamente para Xyb y exigen la etiqueta de ese mismo servidor.
Configura estas variables también en el hosting si el bot corre allí; `.env` local
no actualiza Railway ni otra máquina. Reinicia el proceso después de configurarlas.
Para desactivar, usa `TAG_ENFORCEMENT_ENABLED=false` y reinicia.

La primera revisión al arrancar solo observa. Cada 1 hora se comprueba si la persona
tiene la etiqueta de Xyb o está impulsando el servidor; cualquiera de las dos
condiciones la mantiene fuera del flujo de moderación. Cuando falta la etiqueta en dos
revisiones separadas por al menos una hora, se menciona a la persona en el canal
`TAG_WARNING_CHANNEL_ID` (en Xyb: #chat, `1494581764390391961`) y se le ordena ponerse
«el uniforme», indicando que será baneada si no activa la etiqueta en 20 minutos.
Solo se menciona al destinatario. El plazo empieza después de enviar correctamente
el aviso; si falla el envío, no se banea. Se comprueban los plazos cada segundo,
sin consultas de red hasta que venza uno. Tras al menos 20 minutos se vuelve a
consultar la etiqueta y se banea únicamente si sigue faltando. Los errores de red
pueden retrasar o cancelar la acción. Ponerse la etiqueta cancela el baneo al
comprobarlo. Reiniciar descarta los plazos: se requiere nueva evidencia y aviso.
El bot necesita Ver canal y Enviar mensajes en #chat además de los permisos de ban.
No se borran mensajes. Todos los bots (actuales y futuros), el propietario,
las personas que estén impulsando el servidor (`premium_since` en el Guild Member
de Discord) y los miembros que Discord no permita banear por permisos/jerarquía
quedan fuera.
El bot necesita Banear miembros y un rol superior al de las personas afectadas.

Se compara `primary_guild.identity_guild_id` y `identity_enabled`, nunca el nombre,
apodo, estado, texto de la bio ni solo las letras `xyb`. Un `primary_guild: null`
explícito indica ausencia; campos omitidos/incompletos o `identity_enabled: null`
se consideran desconocidos y no justifican un ban. Los errores HTTP cancelan el
resto del ciclo y descartan evidencia previa. Si desaparece `GUILD_TAGS` o no se
puede confirmar al menos una etiqueta correcta activa, se cancela el ciclo.
Los reinicios descartan la evidencia: nunca hay un ban inmediato al iniciar.
Las consultas y la acción no son atómicas en Discord: no se puede garantizar riesgo
cero si alguien cambia su etiqueta exactamente entre la lectura final y el ban.

Auditoría manual sin baneos: `node scripts/audit-guild-tag.js`.
Resultados y baneos: `logs/bot.log`, líneas `[guild-tag]`.
Prueba individual en Railway: configurar `TAG_TEST_USER_ID` y un `TAG_TEST_RUN_ID`
único antes del despliegue. Solo esa persona recibe un aviso inmediato si las
consultas confirman que falta la etiqueta y puede banearse. Se conservan los 20
minutos completos y la revisión final. El identificador se registra en el volumen
(`guild-tag-tests.json`) para no repetir la prueba al reiniciar.
Pruebas: `node --test test/guild-tag.test.js`.

La etiqueta se elige en Ajustes de usuario > Perfiles > Etiqueta del servidor.
Fuentes oficiales:
- https://docs.discord.com/developers/resources/user#user-object-user-primary-guild
- https://support.discord.com/hc/en-us/articles/31444248479639-Server-Tags
(Economía)

`xyb rm 30m texto` crea un recordatorio por DM; admite minutos y horas hasta un
máximo de 24 horas. También puedes usar `xyb rm list` y `xyb rm remove ID`.
`xyb deposit` abre el banco visual con bolsillo, capacidad, total y botones para
depositar o retirar todo o una cantidad exacta. `xyb shop` abre una tienda con
botones e iconos. El pico cuesta 300 monedas; cada compra posterior lo mejora y
desbloquea mejores recompensas en `xyb mine`. Se empieza pescando con `xyb fish`.
