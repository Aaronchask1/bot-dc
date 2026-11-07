# Música en Xyb

Adaptación del bot de D:\musica\musica al proceso JavaScript existente de Xyb.
Usa la identidad de Xyb y su motor de voz con DAVE; no inicia otro bot Python.

- `xyb play <nombre o enlace>`: YouTube, SoundCloud y Spotify.
- `xyb panel`: anterior, siguiente, pausa/reanudar y volumen 0–200%.
- `xyb previous`: anterior; sin historial reinicia la canción actual.
- `xyb join`, `xyb pause`, `xyb resume`, `xyb skip`, `xyb queue`.
- `xyb now`, `xyb volume 50`, `xyb stop`, `xyb leave`.

Spotify solo aporta metadatos públicos (canciones, álbumes, playlists).
Las canciones se resuelven al llegar su turno. Las listas privadas no se leen y
el reproductor público puede limitar las canciones visibles de listas largas.
No se necesitan las credenciales del otro bot para esta lectura.

El volumen se aplica con FFmpeg; cambiarlo reinicia el flujo en la posición
actual y puede producir una pausa breve. El estado de cola e historial está
separado por servidor y se pierde al reiniciar el proceso.

Validación local: `npm test`. La audición desde Railway requiere una prueba
real en Discord: pruebas locales no garantizan acceso a YouTube desde el host.
