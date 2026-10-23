"""HTTP API (no Gemini calls): decks, versions, themes, images, filenames."""

import pytest
from fastapi.testclient import TestClient


@pytest.fixture()
def client(tmp_path, monkeypatch):
    monkeypatch.setenv("DATA_DIR", str(tmp_path))
    # Real env vars beat backend/.env: keep a developer's stock-photo keys out of the tests.
    monkeypatch.setenv("UNSPLASH_ACCESS_KEY", "")
    monkeypatch.setenv("PEXELS_API_KEY", "")
    from app import config
    from app.services import capabilities

    config.get_settings.cache_clear()

    async def caps(refresh=False):
        return {"stockPhotos": False, "stockProvider": None, "imageGeneration": False, "imageModel": None, "grounding": False, "model": "x"}

    monkeypatch.setattr(capabilities, "get", caps)
    from app import main

    with TestClient(main.app) as c:
        yield c
    config.get_settings.cache_clear()


def deck(i="abc"):
    return {"id": i, "title": "T", "themeId": "midnight", "slides": [{"id": "s1", "layout": "cover-hero", "content": {"title": "Hi"}}]}


def test_capabilities(client):
    assert client.get("/api/capabilities").json()["grounding"] is False


def test_save_get_and_versions(client):
    from app import db
    import asyncio

    asyncio.run(db.save_deck(deck(), "outline", version=False))
    d = deck()
    d["slides"][0]["content"]["title"] = "Edited"
    r = client.patch("/api/decks/abc", json=d)
    assert r.status_code == 200
    assert client.get("/api/decks/abc").json()["slides"][0]["content"]["title"] == "Edited"
    d["title"] = "Second"
    client.patch("/api/decks/abc", json=d)
    versions = client.get("/api/decks/abc/versions").json()
    assert len(versions) == 2
    old = client.get(f"/api/decks/abc/versions/{versions[-1]['id']}").json()
    assert old["title"] == "T"
    assert client.get("/api/decks").json()[0]["id"] == "abc"


def test_missing_deck_404(client):
    assert client.get("/api/decks/nope").status_code == 404
    assert client.patch("/api/decks/nope", json=deck("nope")).status_code == 404


def test_custom_theme_crud(client):
    t = {"id": "custom-1", "name": "Mine", "colors": {}}
    assert client.post("/api/themes", json=t).status_code == 200
    assert client.get("/api/themes").json()[0]["name"] == "Mine"
    assert client.post("/api/themes", json={"id": "midnight", "name": "x"}).status_code == 400
    client.delete("/api/themes/custom-1")
    assert client.get("/api/themes").json() == []


def test_image_search_without_keys_is_empty(client):
    r = client.get("/api/images/search", params={"q": "mountain"}).json()
    assert r["results"] == [] and r["stock"] is False


def test_image_upload_and_type_check(client):
    png = b"\x89PNG\r\n\x1a\n" + b"0" * 64
    r = client.post("/api/images/upload", files={"file": ("a.png", png, "image/png")})
    assert r.status_code == 200 and r.json()["url"].startswith("/media/")
    assert client.get(r.json()["url"]).status_code == 200
    bad = client.post("/api/images/upload", files={"file": ("a.exe", b"MZ", "application/octet-stream")})
    assert bad.status_code == 400


def test_safe_filename():
    from app.main import _safe_filename

    assert _safe_filename('Q3: "Review"/final', "x", ".pdf") == "Q3 Reviewfinal.pdf"
    assert _safe_filename(None, "Deck title", ".pdf") == "Deck title.pdf"
    assert _safe_filename("already.pdf", "x", ".pdf") == "already.pdf"
