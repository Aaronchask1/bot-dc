"""
Puente entre el bot de Node y ytmusicapi.

Uso:
    echo '{"action":"search","query":"Oasis Wonderwall","limit":5}' | python ytmusic_bridge.py

Siempre responde JSON por stdout:
    {"ok": true, "data": ...}
    {"ok": false, "error": "...", "code": "..."}
"""
import json
import os
import sys

from ytmusicapi import YTMusic

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

AUTH_CANDIDATES = [
    os.environ.get("YTMUSIC_AUTH"),
    os.path.join(BASE_DIR, "oauth.json"),
    os.path.join(BASE_DIR, "browser.json"),
    os.path.join(BASE_DIR, "..", "oauth.json"),
    os.path.join(BASE_DIR, "..", "browser.json"),
]


class BridgeError(Exception):
    def __init__(self, message, code="ERROR"):
        super().__init__(message)
        self.code = code


def auth_path():
    for candidate in AUTH_CANDIDATES:
        if candidate and os.path.isfile(candidate):
            return candidate
    return None


def get_client(require_auth=False):
    path = auth_path()

    if path:
        return YTMusic(path)

    if require_auth:
        raise BridgeError(
            "Falta autenticación de YouTube Music. Ejecuta `npm run ytmusic` "
            "para generar python/oauth.json.",
            "NO_AUTH",
        )

    return YTMusic()


def normalize(item):
    thumbnails = item.get("thumbnails") or []
    album = item.get("album") or {}

    return {
        "videoId": item.get("videoId"),
        "title": item.get("title"),
        "duration": item.get("duration_seconds"),
        "thumbnail": thumbnails[-1]["url"] if thumbnails else None,
        "artists": [artist.get("name") for artist in item.get("artists") or [] if artist.get("name")],
        "album": album.get("name"),
        "resultType": item.get("resultType"),
        "isAvailable": item.get("isAvailable", True),
    }


def action_search(payload):
    yt = get_client()

    query = (payload.get("query") or "").strip()
    if not query:
        raise BridgeError("Falta el término de búsqueda.", "BAD_INPUT")

    limit = int(payload.get("limit") or 5)
    filter_type = payload.get("filter")

    results = yt.search(query, filter=filter_type, limit=limit)

    tracks = [
        normalize(item)
        for item in results
        if item.get("videoId")
        and item.get("resultType") in ("song", "video")
        and item.get("isAvailable", True) is not False
    ]

    return tracks[:limit]


def action_create_playlist(payload):
    yt = get_client(require_auth=True)

    title = (payload.get("title") or "").strip()
    if not title:
        raise BridgeError("Falta el nombre de la playlist.", "BAD_INPUT")

    description = payload.get("description") or ""
    video_ids = [v for v in payload.get("videoIds") or [] if v]

    playlist_id = yt.create_playlist(
        title,
        description,
        privacy_status=payload.get("privacy") or "PRIVATE",
    )

    if video_ids:
        yt.add_playlist_items(playlist_id, video_ids)

    return {
        "playlistId": playlist_id,
        "url": f"https://music.youtube.com/playlist?list={playlist_id}",
        "added": len(video_ids),
    }


def action_add_items(payload):
    yt = get_client(require_auth=True)

    playlist_id = payload.get("playlistId")
    if not playlist_id:
        raise BridgeError("Falta el ID de la playlist.", "BAD_INPUT")

    video_ids = [v for v in payload.get("videoIds") or [] if v]
    if not video_ids:
        raise BridgeError("No hay canciones para añadir.", "BAD_INPUT")

    result = yt.add_playlist_items(playlist_id, video_ids)

    return {"playlistId": playlist_id, "added": len(video_ids), "result": result}


def action_list_playlists(payload):
    yt = get_client(require_auth=True)

    limit = int(payload.get("limit") or 25)
    library = yt.get_library_playlists(limit=limit)

    return [
        {
            "playlistId": item.get("playlistId"),
            "title": item.get("title"),
            "count": item.get("count"),
        }
        for item in library
    ]


def action_auth_status(_payload):
    path = auth_path()
    return {"authenticated": bool(path), "authFile": path}


ACTIONS = {
    "search": action_search,
    "create_playlist": action_create_playlist,
    "add_items": action_add_items,
    "list_playlists": action_list_playlists,
    "auth_status": action_auth_status,
}


def main():
    try:
        raw = sys.stdin.read()
        payload = json.loads(raw) if raw.strip() else {}
    except json.JSONDecodeError as error:
        print(json.dumps({"ok": False, "code": "BAD_JSON", "error": str(error)}))
        return

    action = payload.get("action")
    handler = ACTIONS.get(action)

    if not handler:
        print(json.dumps({
            "ok": False,
            "code": "UNKNOWN_ACTION",
            "error": f"Acción desconocida: {action}",
        }))
        return

    try:
        print(json.dumps({"ok": True, "data": handler(payload)}, ensure_ascii=False))
    except BridgeError as error:
        print(json.dumps({"ok": False, "code": error.code, "error": str(error)}, ensure_ascii=False))
    except Exception as error:  # noqa: BLE001
        print(json.dumps({
            "ok": False,
            "code": type(error).__name__,
            "error": str(error),
        }, ensure_ascii=False))


if __name__ == "__main__":
    main()
