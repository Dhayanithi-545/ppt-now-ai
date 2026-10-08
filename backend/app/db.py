"""SQLite storage: decks (current JSON), versions (snapshots on every save) and saved custom themes.

Single-file DB is fine for one instance. For multiple replicas swap this module for Postgres/Firestore;
the function signatures stay the same.
"""

import asyncio
import json
import sqlite3
import time
import uuid
from contextlib import contextmanager

from .config import get_settings

SCHEMA = """
CREATE TABLE IF NOT EXISTS decks (
  id TEXT PRIMARY KEY, title TEXT NOT NULL, data TEXT NOT NULL, created REAL NOT NULL, updated REAL NOT NULL
);
CREATE TABLE IF NOT EXISTS versions (
  id INTEGER PRIMARY KEY AUTOINCREMENT, deck_id TEXT NOT NULL, data TEXT NOT NULL, note TEXT, created REAL NOT NULL
);
CREATE INDEX IF NOT EXISTS ix_versions_deck ON versions(deck_id, id);
CREATE TABLE IF NOT EXISTS themes (
  id TEXT PRIMARY KEY, name TEXT NOT NULL, data TEXT NOT NULL, created REAL NOT NULL
);
"""


@contextmanager
def _conn():
    s = get_settings()
    s.data_dir.mkdir(parents=True, exist_ok=True)
    con = sqlite3.connect(s.db_path, timeout=10)
    con.row_factory = sqlite3.Row
    try:
        yield con
        con.commit()
    finally:
        con.close()


def init() -> None:
    with _conn() as con:
        con.executescript(SCHEMA)
        con.execute("PRAGMA journal_mode=WAL")


def new_id() -> str:
    return uuid.uuid4().hex[:12]


# ---------------- decks (sync implementations, call through the async wrappers)


def _save_deck(deck: dict, note: str | None, version: bool) -> dict:
    now = time.time()
    deck["updated"] = now
    data = json.dumps(deck, ensure_ascii=False)
    with _conn() as con:
        row = con.execute("SELECT created FROM decks WHERE id=?", (deck["id"],)).fetchone()
        if row:
            con.execute("UPDATE decks SET title=?, data=?, updated=? WHERE id=?", (deck.get("title", ""), data, now, deck["id"]))
        else:
            con.execute("INSERT INTO decks VALUES (?,?,?,?,?)", (deck["id"], deck.get("title", ""), data, now, now))
        if version:
            con.execute("INSERT INTO versions (deck_id, data, note, created) VALUES (?,?,?,?)", (deck["id"], data, note, now))
            keep = get_settings().max_versions_per_deck
            con.execute(
                "DELETE FROM versions WHERE deck_id=? AND id NOT IN (SELECT id FROM versions WHERE deck_id=? ORDER BY id DESC LIMIT ?)",
                (deck["id"], deck["id"], keep),
            )
    return deck


def _get_deck(deck_id: str) -> dict | None:
    with _conn() as con:
        row = con.execute("SELECT data FROM decks WHERE id=?", (deck_id,)).fetchone()
    return json.loads(row["data"]) if row else None


def _list_decks(limit: int) -> list[dict]:
    with _conn() as con:
        rows = con.execute("SELECT id, title, data, updated FROM decks ORDER BY updated DESC LIMIT ?", (limit,)).fetchall()
    out = []
    for r in rows:
        d = json.loads(r["data"])
        out.append({"id": r["id"], "title": r["title"], "updated": r["updated"], "themeId": d.get("themeId"),
                    "theme": d.get("theme"), "slideCount": len(d.get("slides", [])), "cover": (d.get("slides") or [None])[0]})
    return out


def _delete_deck(deck_id: str) -> None:
    with _conn() as con:
        con.execute("DELETE FROM decks WHERE id=?", (deck_id,))
        con.execute("DELETE FROM versions WHERE deck_id=?", (deck_id,))


def _versions(deck_id: str) -> list[dict]:
    with _conn() as con:
        rows = con.execute("SELECT id, note, created FROM versions WHERE deck_id=? ORDER BY id DESC", (deck_id,)).fetchall()
    return [dict(r) for r in rows]


def _version(deck_id: str, vid: int) -> dict | None:
    with _conn() as con:
        row = con.execute("SELECT data FROM versions WHERE deck_id=? AND id=?", (deck_id, vid)).fetchone()
    return json.loads(row["data"]) if row else None


def _save_theme(theme: dict) -> dict:
    with _conn() as con:
        con.execute("INSERT OR REPLACE INTO themes VALUES (?,?,?,?)", (theme["id"], theme["name"], json.dumps(theme), time.time()))
    return theme


def _list_themes() -> list[dict]:
    with _conn() as con:
        rows = con.execute("SELECT data FROM themes ORDER BY created DESC").fetchall()
    return [json.loads(r["data"]) for r in rows]


def _delete_theme(theme_id: str) -> None:
    with _conn() as con:
        con.execute("DELETE FROM themes WHERE id=?", (theme_id,))


async def save_deck(deck: dict, note: str | None = None, version: bool = True) -> dict:
    return await asyncio.to_thread(_save_deck, deck, note, version)


async def get_deck(deck_id: str) -> dict | None:
    return await asyncio.to_thread(_get_deck, deck_id)


async def list_decks(limit: int = 50) -> list[dict]:
    return await asyncio.to_thread(_list_decks, limit)


async def delete_deck(deck_id: str) -> None:
    await asyncio.to_thread(_delete_deck, deck_id)


async def versions(deck_id: str) -> list[dict]:
    return await asyncio.to_thread(_versions, deck_id)


async def version(deck_id: str, vid: int) -> dict | None:
    return await asyncio.to_thread(_version, deck_id, vid)


async def save_theme(theme: dict) -> dict:
    return await asyncio.to_thread(_save_theme, theme)


async def list_themes() -> list[dict]:
    return await asyncio.to_thread(_list_themes)


async def delete_theme(theme_id: str) -> None:
    await asyncio.to_thread(_delete_theme, theme_id)
