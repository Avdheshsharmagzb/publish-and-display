# The Meridian — News Publishing Platform (PRD)

## Original Problem Statement
Create a final 'Publish' button in the Admin Dashboard for 'Rewritten_Pending_Publish' news items. On Publish, the article + its watermarked media go live on the public news website. Build a responsive public homepage displaying published articles categorized nicely.

## Architecture
- **Backend**: FastAPI + MongoDB (motor). Object storage (Emergent) for media. Pillow for server-side watermarking.
- **Frontend**: React 19 + Tailwind + shadcn/ui + framer-motion + sonner. Editorial "Swiss Modern" theme (Playfair Display / Inter / JetBrains Mono).
- No auth (per user choice); admin dashboard open at /admin.

## User Personas
- **Admin/Editor**: reviews rewritten pending articles and publishes them.
- **Public reader**: browses categorized published news.

## Core Requirements (static)
- News item statuses: `Rewritten_Pending_Publish`, `Published`.
- Publish action watermarks media (baked-in via Pillow) + stores to object storage + flips status → live.
- Categories: Politics, Business, Technology, Sports, Entertainment, Health.
- Responsive public homepage with hero + category sections; category filter pages; article detail page.

## Implemented (2026-09-24)
- Backend endpoints: `/api/articles` (published, category filter), `/api/articles/{id}`, `/api/admin/articles` (GET/POST), `/api/admin/articles/{id}/publish`, `/api/admin/stats`, `/api/admin/upload`, `/api/media/{path}`, `/api/wm` (live watermark fallback), `/api/categories`.
- Server-side watermarking (diagonal "MERIDIAN" tiling + corner verified badge) baked into image on publish; stored to object storage.
- Seed: 12 articles (7 published w/ watermarked media, 5 pending).
- Admin dashboard: stats cards, article table, per-row Publish button (pending only) with toast, "View Live" for published, New Article dialog (upload or URL, category select).
- Public homepage: masthead, hero + sidebar, category-grouped cards with watermark overlay badges; category pages; article detail page.
- Verified: testing agent — backend 13/13 pass, frontend critical flows 100%.

## Backlog / Remaining
- P1: Edit/delete articles from admin; image-less article placeholder polish.
- P2: Pagination for large volumes; background task for large-image publish; auth if needed.
- P2: Search, related articles, dark mode for public site.
