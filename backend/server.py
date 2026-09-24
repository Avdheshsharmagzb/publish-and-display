from fastapi import FastAPI, APIRouter, HTTPException, UploadFile, File, Form, Query, Response
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import io
import asyncio
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional
import uuid
from datetime import datetime, timezone, timedelta

import requests
from PIL import Image, ImageDraw, ImageFont


ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

app = FastAPI()
api_router = APIRouter(prefix="/api")

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Object storage
# ---------------------------------------------------------------------------
STORAGE_BASE = (os.environ.get("INTEGRATION_PROXY_URL") or "").strip() or "https://integrations.emergentagent.com"
STORAGE_URL = STORAGE_BASE.rstrip("/") + "/objstore/api/v1/storage"
EMERGENT_KEY = os.environ.get("EMERGENT_LLM_KEY")
APP_NAME = "meridian-news"
storage_key = None


def init_storage(force: bool = False):
    global storage_key
    if storage_key and not force:
        return storage_key
    resp = requests.post(f"{STORAGE_URL}/init", json={"emergent_key": EMERGENT_KEY}, timeout=30)
    resp.raise_for_status()
    storage_key = resp.json()["storage_key"]
    return storage_key


def put_object(path: str, data: bytes, content_type: str) -> dict:
    key = init_storage()
    resp = requests.put(
        f"{STORAGE_URL}/objects/{path}",
        headers={"X-Storage-Key": key, "Content-Type": content_type},
        data=data, timeout=120,
    )
    if resp.status_code == 404:
        key = init_storage(force=True)
        resp = requests.put(
            f"{STORAGE_URL}/objects/{path}",
            headers={"X-Storage-Key": key, "Content-Type": content_type},
            data=data, timeout=120,
        )
    resp.raise_for_status()
    return resp.json()


def get_object(path: str):
    key = init_storage()
    resp = requests.get(f"{STORAGE_URL}/objects/{path}", headers={"X-Storage-Key": key}, timeout=60)
    if resp.status_code == 404:
        key = init_storage(force=True)
        resp = requests.get(f"{STORAGE_URL}/objects/{path}", headers={"X-Storage-Key": key}, timeout=60)
    resp.raise_for_status()
    return resp.content, resp.headers.get("Content-Type", "application/octet-stream")


# ---------------------------------------------------------------------------
# Watermarking (Pillow)
# ---------------------------------------------------------------------------
def _load_font(size: int):
    for p in [
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
        "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
    ]:
        try:
            return ImageFont.truetype(p, size)
        except Exception:
            continue
    try:
        return ImageFont.load_default(size)
    except Exception:
        return ImageFont.load_default()


def watermark_image(data: bytes) -> bytes:
    img = Image.open(io.BytesIO(data)).convert("RGB")
    max_w = 1600
    if img.width > max_w:
        ratio = max_w / img.width
        img = img.resize((max_w, int(img.height * ratio)))
    W, H = img.size
    base = img.convert("RGBA")

    # Faint diagonal repeated watermark
    wm_layer = Image.new("RGBA", (W * 2, H * 2), (0, 0, 0, 0))
    wd = ImageDraw.Draw(wm_layer)
    wmf = _load_font(max(28, W // 18))
    step_x = max(260, W // 2)
    step_y = max(150, H // 3)
    for yy in range(0, H * 2, step_y):
        for xx in range(0, W * 2, step_x):
            wd.text((xx, yy), "MERIDIAN", font=wmf, fill=(255, 255, 255, 30))
    wm_layer = wm_layer.rotate(30, expand=False)
    left = (wm_layer.width - W) // 2
    top = (wm_layer.height - H) // 2
    wm_layer = wm_layer.crop((left, top, left + W, top + H))

    # Corner badge
    overlay = Image.new("RGBA", base.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay)
    text = "THE MERIDIAN"
    sub = "VERIFIED  •  © MERIDIAN NEWS"
    fs = max(20, W // 36)
    font = _load_font(fs)
    subfont = _load_font(max(12, fs // 2))
    pad = fs // 2
    tb = draw.textbbox((0, 0), text, font=font)
    sb = draw.textbbox((0, 0), sub, font=subfont)
    tw, th = tb[2] - tb[0], tb[3] - tb[1]
    sw, sh = sb[2] - sb[0], sb[3] - sb[1]
    bar_w = max(tw, sw) + pad * 2 + 8
    bar_h = th + sh + pad * 2
    x1 = W - bar_w - fs // 2
    y1 = H - bar_h - fs // 2
    draw.rectangle([x1, y1, x1 + bar_w, y1 + bar_h], fill=(11, 15, 23, 175))
    draw.rectangle([x1, y1, x1 + 6, y1 + bar_h], fill=(220, 38, 38, 255))
    draw.text((x1 + pad + 8, y1 + pad // 2), text, font=font, fill=(255, 255, 255, 255))
    draw.text((x1 + pad + 8, y1 + pad // 2 + th + pad // 2), sub, font=subfont, fill=(210, 210, 210, 255))

    combined = Image.alpha_composite(base, wm_layer)
    combined = Image.alpha_composite(combined, overlay)
    out = io.BytesIO()
    combined.convert("RGB").save(out, format="JPEG", quality=88)
    return out.getvalue()


def _fetch_bytes(src: str) -> bytes:
    if src.startswith("/api/media/"):
        path = src[len("/api/media/"):]
        data, _ = get_object(path)
        return data
    r = requests.get(src, timeout=30)
    r.raise_for_status()
    return r.content


def process_publish_media(article: dict) -> dict:
    """Fetch original media, watermark it, store to object storage. Returns update fields."""
    if article.get("source_storage_path"):
        data, _ = get_object(article["source_storage_path"])
    else:
        data = _fetch_bytes(article["source_image_url"])
    wm_bytes = watermark_image(data)
    path = f"{APP_NAME}/watermarked/{uuid.uuid4()}.jpg"
    result = put_object(path, wm_bytes, "image/jpeg")
    return {
        "watermarked_storage_path": result["path"],
        "watermarked_image_url": f"/api/media/{result['path']}",
    }


# ---------------------------------------------------------------------------
# Models
# ---------------------------------------------------------------------------
STATUS_PENDING = "Rewritten_Pending_Publish"
STATUS_PUBLISHED = "Published"

CATEGORIES = [
    {"slug": "politics", "label": "Politics"},
    {"slug": "business", "label": "Business"},
    {"slug": "technology", "label": "Technology"},
    {"slug": "sports", "label": "Sports"},
    {"slug": "entertainment", "label": "Entertainment"},
    {"slug": "health", "label": "Health"},
]


def now_iso():
    return datetime.now(timezone.utc).isoformat()


class Article(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    title: str
    category: str
    excerpt: str
    body: str
    author: str = "Meridian Desk"
    status: str = STATUS_PENDING
    source_image_url: str = ""
    source_storage_path: Optional[str] = None
    watermarked_image_url: Optional[str] = None
    watermarked_storage_path: Optional[str] = None
    created_at: str = Field(default_factory=now_iso)
    published_at: Optional[str] = None


class ArticleCreate(BaseModel):
    title: str
    category: str
    excerpt: str
    body: str
    author: str = "Meridian Desk"
    source_image_url: str = ""
    source_storage_path: Optional[str] = None


class ArticleUpdate(BaseModel):
    title: Optional[str] = None
    category: Optional[str] = None
    excerpt: Optional[str] = None
    body: Optional[str] = None
    author: Optional[str] = None
    source_image_url: Optional[str] = None
    source_storage_path: Optional[str] = None


PROJ = {"_id": 0}


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------
@api_router.get("/")
async def root():
    return {"message": "Meridian News API"}


@api_router.get("/categories")
async def get_categories():
    return CATEGORIES


@api_router.get("/articles", response_model=List[Article])
async def list_published(category: Optional[str] = None):
    q = {"status": STATUS_PUBLISHED}
    if category:
        q["category"] = category
    docs = await db.articles.find(q, PROJ).sort("published_at", -1).to_list(500)
    return docs


@api_router.get("/articles/{article_id}", response_model=Article)
async def get_article(article_id: str):
    doc = await db.articles.find_one({"id": article_id}, PROJ)
    if not doc:
        raise HTTPException(status_code=404, detail="Article not found")
    return doc


# ---- Admin ----
@api_router.get("/admin/stats")
async def admin_stats():
    total = await db.articles.count_documents({})
    published = await db.articles.count_documents({"status": STATUS_PUBLISHED})
    pending = await db.articles.count_documents({"status": STATUS_PENDING})
    return {"total": total, "published": published, "pending": pending}


@api_router.get("/admin/articles", response_model=List[Article])
async def admin_list(status: Optional[str] = None):
    q = {}
    if status:
        q["status"] = status
    docs = await db.articles.find(q, PROJ).sort("created_at", -1).to_list(500)
    return docs


@api_router.post("/admin/articles", response_model=Article)
async def admin_create(payload: ArticleCreate):
    art = Article(**payload.model_dump())
    await db.articles.insert_one(art.model_dump())
    return art.model_dump()


@api_router.put("/admin/articles/{article_id}", response_model=Article)
async def admin_update(article_id: str, payload: ArticleUpdate):
    doc = await db.articles.find_one({"id": article_id}, PROJ)
    if not doc:
        raise HTTPException(status_code=404, detail="Article not found")
    updates = {k: v for k, v in payload.model_dump().items() if v is not None}
    if updates:
        await db.articles.update_one({"id": article_id}, {"$set": updates})
    doc = await db.articles.find_one({"id": article_id}, PROJ)
    return doc


@api_router.post("/admin/articles/{article_id}/publish", response_model=Article)
async def admin_publish(article_id: str):
    doc = await db.articles.find_one({"id": article_id}, PROJ)
    if not doc:
        raise HTTPException(status_code=404, detail="Article not found")
    if doc.get("status") == STATUS_PUBLISHED:
        raise HTTPException(status_code=400, detail="Article is already published")

    loop = asyncio.get_event_loop()
    try:
        media = await loop.run_in_executor(None, process_publish_media, doc)
    except Exception as e:
        logger.error(f"Watermark/store failed, using live fallback: {e}")
        src = doc.get("source_image_url", "")
        media = {"watermarked_image_url": f"/api/wm?src={src}"}

    updates = {"status": STATUS_PUBLISHED, "published_at": now_iso(), **media}
    await db.articles.update_one({"id": article_id}, {"$set": updates})
    doc = await db.articles.find_one({"id": article_id}, PROJ)
    return doc


@api_router.post("/admin/upload")
async def admin_upload(file: UploadFile = File(...)):
    ext = file.filename.split(".")[-1].lower() if "." in file.filename else "jpg"
    path = f"{APP_NAME}/uploads/{uuid.uuid4()}.{ext}"
    data = await file.read()
    loop = asyncio.get_event_loop()
    result = await loop.run_in_executor(
        None, put_object, path, data, file.content_type or "image/jpeg"
    )
    return {"storage_path": result["path"], "url": f"/api/media/{result['path']}"}


# ---- Media serving ----
@api_router.get("/media/{path:path}")
async def serve_media(path: str):
    loop = asyncio.get_event_loop()
    try:
        data, ct = await loop.run_in_executor(None, get_object, path)
    except Exception:
        raise HTTPException(status_code=404, detail="Media not found")
    return Response(content=data, media_type=ct or "image/jpeg")


@api_router.get("/wm")
async def watermark_on_the_fly(src: str = Query(...)):
    loop = asyncio.get_event_loop()
    try:
        data = await loop.run_in_executor(None, _fetch_bytes, src)
        wm = await loop.run_in_executor(None, watermark_image, data)
    except Exception as e:
        logger.error(f"Live watermark failed: {e}")
        raise HTTPException(status_code=404, detail="Media not found")
    return Response(content=wm, media_type="image/jpeg")


# ---------------------------------------------------------------------------
# Seed data
# ---------------------------------------------------------------------------
SEED_ARTICLES = [
    {
        "title": "Coalition Talks Extend Into Third Day as Leaders Seek Consensus",
        "category": "politics",
        "excerpt": "Negotiators emerged cautiously optimistic late Tuesday, signalling a framework agreement could be within reach before the weekend.",
        "body": "Senior figures from across the political spectrum reconvened in the capital on Tuesday for a third consecutive day of coalition negotiations, with sources close to the talks describing the mood as \"constructive but delicate.\"\n\nThe discussions, centred on fiscal policy and regional investment, have drawn intense public scrutiny. Party whips confirmed that a framework document is being drafted and could be presented to members within days.\n\nAnalysts note that the outcome will shape the legislative agenda for the coming term, particularly on infrastructure spending and tax reform.",
        "source_image_url": "https://images.unsplash.com/photo-1529107386315-e1a2ed48a620?crop=entropy&cs=srgb&fm=jpg&q=85",
        "publish": True,
    },
    {
        "title": "Parliament Passes Landmark Transparency Bill in Late-Night Vote",
        "category": "politics",
        "excerpt": "The sweeping reform mandates real-time disclosure of public contracts, a measure supporters call the most significant in a generation.",
        "body": "Lawmakers approved a landmark transparency bill after a marathon session, ushering in new requirements for the disclosure of public procurement contracts.\n\nThe legislation compels agencies to publish contract details within 72 hours of signing. Civil society groups hailed the vote as a turning point for accountability.\n\nImplementation will be phased over eighteen months, with an independent oversight office to be established next quarter.",
        "source_image_url": "https://images.unsplash.com/photo-1607778417094-1fef13315e6e?crop=entropy&cs=srgb&fm=jpg&q=85",
        "publish": False,
    },
    {
        "title": "Markets Rally as Central Bank Signals Pause on Rate Hikes",
        "category": "business",
        "excerpt": "Equities surged to a three-month high after policymakers hinted the tightening cycle may be nearing its end.",
        "body": "Global equities rallied sharply on Wednesday after the central bank indicated it may pause its aggressive campaign of interest rate increases, citing cooling inflation data.\n\nThe benchmark index closed up 2.4 percent, its strongest single-day gain in three months. Bond yields eased and the currency strengthened against major peers.\n\nEconomists cautioned that the path ahead remains data-dependent, with the next inflation reading seen as pivotal.",
        "source_image_url": "https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?crop=entropy&cs=srgb&fm=jpg&q=85",
        "publish": True,
    },
    {
        "title": "Startups Report Record Quarter Despite Funding Headwinds",
        "category": "business",
        "excerpt": "Early-stage companies posted their strongest revenue growth in two years, defying a broader slowdown in venture capital.",
        "body": "A new industry report shows early-stage technology companies achieved record quarterly revenue growth, even as venture funding tightened across the sector.\n\nThe findings suggest founders are prioritising profitability and disciplined spending over rapid expansion.\n\nInvestors say the shift marks a maturing market where sustainable unit economics increasingly determine which firms attract capital.",
        "source_image_url": "https://images.unsplash.com/photo-1645226880663-81561dcab0ae?crop=entropy&cs=srgb&fm=jpg&q=85",
        "publish": False,
    },
    {
        "title": "New AI Model Sets Benchmark for On-Device Reasoning",
        "category": "technology",
        "excerpt": "Researchers unveiled a compact model that runs complex reasoning tasks entirely on consumer hardware.",
        "body": "A team of researchers has unveiled a compact artificial intelligence model capable of performing sophisticated reasoning tasks directly on consumer devices, without relying on cloud infrastructure.\n\nThe breakthrough could reshape how applications handle privacy-sensitive data, keeping computation local.\n\nIndustry observers say on-device intelligence is poised to become a defining battleground for the next generation of hardware.",
        "source_image_url": "https://images.unsplash.com/photo-1697577418970-95d99b5a55cf?crop=entropy&cs=srgb&fm=jpg&q=85",
        "publish": True,
    },
    {
        "title": "Chipmakers Race to Meet Surging Demand for Neural Processors",
        "category": "technology",
        "excerpt": "Foundries are expanding capacity as demand for specialised AI silicon outpaces supply.",
        "body": "Leading semiconductor manufacturers announced fresh capacity expansions this week as demand for neural processing units continues to outstrip available supply.\n\nThe scramble reflects a broader boom in artificial intelligence deployment across industries, from automotive to healthcare.\n\nAnalysts expect supply constraints to persist well into next year despite the new investments.",
        "source_image_url": "https://images.unsplash.com/photo-1677442135703-1787eea5ce01?crop=entropy&cs=srgb&fm=jpg&q=85",
        "publish": True,
    },
    {
        "title": "Underdogs Stun Champions in Extra-Time Thriller",
        "category": "sports",
        "excerpt": "A last-gasp goal sent the home crowd into raptures as the league leaders fell to a spirited challenge.",
        "body": "In a match that will be remembered for years, the competition's perennial underdogs toppled the reigning champions with a dramatic extra-time winner.\n\nThe home side defended resolutely before striking on the counter in the 118th minute, sparking wild celebrations across the stadium.\n\nThe result blows the title race wide open with just weeks remaining in the season.",
        "source_image_url": "https://images.unsplash.com/photo-1489944440615-453fc2b6a9a9?crop=entropy&cs=srgb&fm=jpg&q=85",
        "publish": True,
    },
    {
        "title": "City to Host International Athletics Championship Next Summer",
        "category": "sports",
        "excerpt": "Organisers confirmed the marquee event will bring thousands of athletes and spectators to the region.",
        "body": "The city has been officially selected to host next summer's international athletics championship, organisers confirmed on Thursday.\n\nThe event is expected to draw thousands of competitors and a global broadcast audience, delivering a significant boost to the local economy.\n\nPreparations for venues and transport infrastructure are already underway.",
        "source_image_url": "https://images.unsplash.com/photo-1629217855633-79a6925d6c47?crop=entropy&cs=srgb&fm=jpg&q=85",
        "publish": False,
    },
    {
        "title": "Acclaimed Director Returns With Ambitious New Feature",
        "category": "entertainment",
        "excerpt": "The long-awaited project premiered to a rapturous reception, drawing early awards-season buzz.",
        "body": "An acclaimed filmmaker returned to the screen this week with an ambitious new feature that premiered to a rapturous reception at a major festival.\n\nCritics praised the film's bold visual language and emotional depth, with several tipping it for awards-season recognition.\n\nThe director said the project had been more than five years in the making.",
        "source_image_url": "https://images.unsplash.com/photo-1470229722913-7c0e2dbbafd3?crop=entropy&cs=srgb&fm=jpg&q=85",
        "publish": True,
    },
    {
        "title": "Sold-Out Tour Breaks Attendance Records Across the Country",
        "category": "entertainment",
        "excerpt": "The chart-topping act drew record crowds, cementing its status as this year's defining live phenomenon.",
        "body": "A chart-topping musical act has shattered attendance records on its nationwide tour, with several dates selling out within minutes of going on sale.\n\nThe run has become a cultural touchstone, drawing fans from across the country to sold-out arenas.\n\nPromoters described demand as unprecedented, with additional dates now under consideration.",
        "source_image_url": "https://images.unsplash.com/photo-1459749411175-04bf5292ceea?crop=entropy&cs=srgb&fm=jpg&q=85",
        "publish": False,
    },
    {
        "title": "Researchers Report Breakthrough in Early Disease Detection",
        "category": "health",
        "excerpt": "A new screening technique identified early markers with remarkable accuracy in a large clinical trial.",
        "body": "Medical researchers have reported a significant breakthrough in early disease detection, unveiling a screening technique that identified early markers with remarkable accuracy in a large clinical trial.\n\nThe method could enable earlier intervention and improved outcomes for patients, experts said.\n\nRegulatory review is expected to begin later this year ahead of potential wider rollout.",
        "source_image_url": "https://images.unsplash.com/photo-1516841273335-e39b37888115?crop=entropy&cs=srgb&fm=jpg&q=85",
        "publish": True,
    },
    {
        "title": "Public Health Campaign Drives Sharp Rise in Preventive Screenings",
        "category": "health",
        "excerpt": "Officials credit a coordinated outreach effort for a notable jump in participation across communities.",
        "body": "A coordinated public health campaign has driven a sharp rise in preventive screenings, officials announced this week.\n\nParticipation increased across communities that had historically reported lower engagement, a trend health authorities called encouraging.\n\nThe campaign will be extended following its early success, with new resources directed to underserved areas.",
        "source_image_url": "https://images.unsplash.com/photo-1504439468489-c8920d796a29?crop=entropy&cs=srgb&fm=jpg&q=85",
        "publish": False,
    },
]


async def seed_data():
    count = await db.articles.count_documents({})
    if count > 0:
        return
    logger.info("Seeding articles...")
    base = datetime.now(timezone.utc)
    idx = 0
    for item in SEED_ARTICLES:
        art = Article(
            title=item["title"],
            category=item["category"],
            excerpt=item["excerpt"],
            body=item["body"],
            source_image_url=item["source_image_url"],
            created_at=(base - timedelta(days=idx)).isoformat(),
        )
        doc = art.model_dump()
        if item.get("publish"):
            doc["status"] = STATUS_PUBLISHED
            doc["published_at"] = (base - timedelta(hours=idx * 5)).isoformat()
            try:
                media = process_publish_media(doc)
                doc.update(media)
            except Exception as e:
                logger.error(f"Seed watermark failed for '{item['title']}': {e}")
                doc["watermarked_image_url"] = f"/api/wm?src={item['source_image_url']}"
        await db.articles.insert_one(doc)
        idx += 1
    logger.info("Seeding complete.")


@app.on_event("startup")
async def on_startup():
    try:
        init_storage()
        logger.info("Storage initialized")
    except Exception as e:
        logger.error(f"Storage init failed: {e}")
    try:
        await seed_data()
    except Exception as e:
        logger.error(f"Seed failed: {e}")


app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
