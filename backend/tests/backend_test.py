"""Backend API tests for Meridian News publishing flow."""
import os
import time
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
if not BASE_URL:
    # Fallback to frontend .env
    with open("/app/frontend/.env") as f:
        for line in f:
            if line.startswith("REACT_APP_BACKEND_URL="):
                BASE_URL = line.split("=", 1)[1].strip().rstrip("/")

API = f"{BASE_URL}/api"


@pytest.fixture(scope="session")
def s():
    sess = requests.Session()
    sess.headers.update({"Content-Type": "application/json"})
    return sess


# -------- Public articles --------
class TestPublicArticles:
    def test_list_published_only(self, s):
        r = s.get(f"{API}/articles", timeout=30)
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list) and len(data) >= 1
        for a in data:
            assert a["status"] == "Published"
            assert a.get("watermarked_image_url")

    def test_filter_by_category(self, s):
        r = s.get(f"{API}/articles", params={"category": "technology"}, timeout=30)
        assert r.status_code == 200
        data = r.json()
        assert len(data) >= 1
        for a in data:
            assert a["category"] == "technology"
            assert a["status"] == "Published"

    def test_get_article_detail(self, s):
        r = s.get(f"{API}/articles", timeout=30)
        art_id = r.json()[0]["id"]
        r2 = s.get(f"{API}/articles/{art_id}", timeout=30)
        assert r2.status_code == 200
        assert r2.json()["id"] == art_id

    def test_get_article_404(self, s):
        r = s.get(f"{API}/articles/does-not-exist", timeout=30)
        assert r.status_code == 404


# -------- Admin --------
class TestAdmin:
    def test_admin_list_all(self, s):
        r = s.get(f"{API}/admin/articles", timeout=30)
        assert r.status_code == 200
        arts = r.json()
        statuses = {a["status"] for a in arts}
        assert "Published" in statuses
        assert "Rewritten_Pending_Publish" in statuses

    def test_admin_stats(self, s):
        r = s.get(f"{API}/admin/stats", timeout=30)
        assert r.status_code == 200
        d = r.json()
        assert d["total"] == d["published"] + d["pending"]
        assert d["total"] >= 12

    def test_create_article_is_pending(self, s):
        payload = {
            "title": "TEST_Article Backend",
            "category": "technology",
            "excerpt": "TEST excerpt",
            "body": "TEST body content",
            "source_image_url": "https://images.unsplash.com/photo-1677442135703-1787eea5ce01?crop=entropy&cs=srgb&fm=jpg&q=85",
        }
        r = s.post(f"{API}/admin/articles", json=payload, timeout=30)
        assert r.status_code == 200
        art = r.json()
        assert art["status"] == "Rewritten_Pending_Publish"
        assert art["title"] == payload["title"]
        assert art["id"]

        # Should not show up in public listing
        pub = s.get(f"{API}/articles", timeout=30).json()
        assert not any(a["id"] == art["id"] for a in pub)

        # Should show in admin listing
        admin = s.get(f"{API}/admin/articles", timeout=30).json()
        assert any(a["id"] == art["id"] for a in admin)

        pytest.created_id = art["id"]


# -------- Publish end-to-end --------
class TestPublishFlow:
    def test_publish_pending_article(self, s):
        # Find a pending seed article
        admin = s.get(f"{API}/admin/articles", timeout=30).json()
        pending = [a for a in admin if a["status"] == "Rewritten_Pending_Publish"
                   and a.get("source_image_url")]
        assert pending, "No pending articles to publish"
        art = pending[0]

        r = s.post(f"{API}/admin/articles/{art['id']}/publish", timeout=120)
        assert r.status_code == 200, r.text
        published = r.json()
        assert published["status"] == "Published"
        assert published["published_at"]
        assert published["watermarked_image_url"]
        assert published["watermarked_image_url"].startswith("/api/media/")

        # Verify appears in public listing
        pub = s.get(f"{API}/articles", timeout=30).json()
        assert any(a["id"] == art["id"] for a in pub)

        # Verify media serves
        media_path = published["watermarked_image_url"].replace("/api/media/", "")
        m = s.get(f"{API}/media/{media_path}", timeout=60)
        assert m.status_code == 200
        assert m.headers["Content-Type"].startswith("image/")
        assert len(m.content) > 1000

        pytest.published_id = art["id"]

    def test_publish_already_published_400(self, s):
        pid = getattr(pytest, "published_id", None)
        if not pid:
            pytest.skip("no published id")
        r = s.post(f"{API}/admin/articles/{pid}/publish", timeout=30)
        assert r.status_code == 400

    def test_publish_not_found_404(self, s):
        r = s.post(f"{API}/admin/articles/nope-xxx/publish", timeout=30)
        assert r.status_code == 404


# -------- Media --------
class TestMedia:
    def test_media_endpoint_serves_seed_watermark(self, s):
        pub = s.get(f"{API}/articles", timeout=30).json()
        assert pub
        wm = pub[0]["watermarked_image_url"]
        assert wm
        if wm.startswith("/api/media/"):
            r = s.get(f"{BASE_URL}{wm}", timeout=60)
            assert r.status_code == 200
            assert r.headers["Content-Type"].startswith("image/")

    def test_media_404(self, s):
        r = s.get(f"{API}/media/does/not/exist.jpg", timeout=30)
        assert r.status_code == 404


class TestCategories:
    def test_categories(self, s):
        r = s.get(f"{API}/categories", timeout=30)
        assert r.status_code == 200
        slugs = {c["slug"] for c in r.json()}
        assert {"politics", "business", "technology", "sports", "entertainment", "health"} <= slugs
