import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { api, media, fmtDate } from "@/lib/api";
import { CATEGORY_BADGE, categoryLabel, CATEGORIES } from "@/constants/news";
import { PublicNav } from "@/components/news/PublicNav";
import { Footer } from "@/components/news/Footer";
import { ArticleCard } from "@/components/news/ArticleCard";
import { WatermarkBadge } from "@/components/news/WatermarkBadge";

export default function Home() {
  const { slug } = useParams();
  const [articles, setArticles] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api
      .get("/articles", { params: slug ? { category: slug } : {} })
      .then((r) => setArticles(r.data))
      .catch(() => setArticles([]))
      .finally(() => setLoading(false));
  }, [slug]);

  const hero = articles[0];
  const sidebar = articles.slice(1, 4);
  const rest = articles.slice(4);

  const grouped = CATEGORIES.map((c) => ({
    ...c,
    items: rest.filter((a) => a.category === c.slug),
  })).filter((g) => g.items.length > 0);

  return (
    <div className="min-h-screen bg-[#FDFCF7] text-slate-900">
      <PublicNav />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        <div className="border-b-4 border-slate-900 pb-4 mb-8 text-center">
          <h1 className="font-serif font-extrabold text-4xl sm:text-5xl lg:text-6xl tracking-tight">
            {slug ? categoryLabel(slug) : "Today's Edition"}
          </h1>
          <p className="mt-2 font-mono text-[11px] uppercase tracking-[0.25em] text-slate-500">
            {slug ? `${categoryLabel(slug)} Desk` : "The Meridian · Verified Newsroom"}
          </p>
        </div>

        {loading ? (
          <p className="text-center py-20 font-mono text-sm text-slate-400">Loading edition…</p>
        ) : articles.length === 0 ? (
          <div className="text-center py-20" data-testid="empty-state">
            <p className="font-serif text-2xl text-slate-700">No published stories yet</p>
            <p className="mt-2 text-slate-500">
              Publish articles from the{" "}
              <Link to="/admin" className="text-red-700 underline">Admin Dashboard</Link>.
            </p>
          </div>
        ) : (
          <>
            {/* Hero */}
            <section className="grid grid-cols-1 lg:grid-cols-12 gap-8 border-b border-slate-200 pb-12 mb-12">
              {hero && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5 }}
                  className="lg:col-span-8 group"
                >
                  <Link to={`/article/${hero.id}`}>
                    <div className="relative aspect-[16/9] overflow-hidden rounded-lg bg-slate-100">
                      <img
                        src={media(hero.watermarked_image_url || hero.source_image_url)}
                        alt={hero.title}
                        className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-700"
                      />
                      <WatermarkBadge />
                    </div>
                    <span
                      className={`inline-block mt-5 px-2.5 py-0.5 text-[10px] font-mono uppercase tracking-[0.15em] border rounded ${CATEGORY_BADGE[hero.category]}`}
                    >
                      {categoryLabel(hero.category)}
                    </span>
                    <h2 className="mt-3 font-serif font-extrabold text-3xl sm:text-4xl lg:text-5xl leading-[1.1] tracking-tight group-hover:text-red-700 transition-colors">
                      {hero.title}
                    </h2>
                    <p className="mt-4 text-base sm:text-lg leading-relaxed text-slate-700 max-w-2xl">
                      {hero.excerpt}
                    </p>
                    <p className="mt-4 font-mono text-[11px] uppercase tracking-wider text-slate-400">
                      {hero.author} · {fmtDate(hero.published_at)}
                    </p>
                  </Link>
                </motion.div>
              )}
              <div className="lg:col-span-4 flex flex-col divide-y divide-slate-200 lg:border-l lg:border-slate-200 lg:pl-8">
                {sidebar.map((a) => (
                  <Link
                    key={a.id}
                    to={`/article/${a.id}`}
                    data-testid={`article-card-${a.id}`}
                    className="group py-5 first:pt-0 flex gap-4"
                  >
                    <div className="relative w-24 h-24 shrink-0 overflow-hidden rounded bg-slate-100">
                      <img
                        src={media(a.watermarked_image_url || a.source_image_url)}
                        alt={a.title}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div>
                      <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-red-700">
                        {categoryLabel(a.category)}
                      </span>
                      <h3 className="mt-1 font-serif font-bold text-base leading-snug group-hover:text-red-700 transition-colors">
                        {a.title}
                      </h3>
                    </div>
                  </Link>
                ))}
              </div>
            </section>

            {/* Grouped by category */}
            {slug ? (
              <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {rest.map((a, i) => (
                  <ArticleCard key={a.id} article={a} index={i} />
                ))}
              </section>
            ) : (
              grouped.map((g) => (
                <section key={g.slug} className="mb-14">
                  <div className="flex items-center justify-between mb-6">
                    <h2 className="font-serif font-bold text-2xl sm:text-3xl tracking-tight">
                      {g.label}
                    </h2>
                    <Link
                      to={`/category/${g.slug}`}
                      className="font-mono text-[11px] uppercase tracking-[0.15em] text-red-700 hover:underline"
                    >
                      View all →
                    </Link>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                    {g.items.map((a, i) => (
                      <ArticleCard key={a.id} article={a} index={i} />
                    ))}
                  </div>
                </section>
              ))
            )}
          </>
        )}
      </main>
      <Footer />
    </div>
  );
}
