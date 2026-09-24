import { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft } from "lucide-react";
import { api, media, fmtDate } from "@/lib/api";
import { CATEGORY_BADGE, categoryLabel } from "@/constants/news";
import { PublicNav } from "@/components/news/PublicNav";
import { Footer } from "@/components/news/Footer";
import { WatermarkBadge } from "@/components/news/WatermarkBadge";

export default function ArticleDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [article, setArticle] = useState(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    api
      .get(`/articles/${id}`)
      .then((r) => setArticle(r.data))
      .catch(() => setNotFound(true));
  }, [id]);

  if (notFound) {
    return (
      <div className="min-h-screen bg-[#FDFCF7]">
        <PublicNav />
        <div className="max-w-3xl mx-auto px-6 py-24 text-center">
          <p className="font-serif text-3xl">Story not found</p>
          <Link to="/" className="mt-4 inline-block text-red-700 underline">Back home</Link>
        </div>
      </div>
    );
  }

  if (!article) {
    return (
      <div className="min-h-screen bg-[#FDFCF7]">
        <PublicNav />
        <p className="text-center py-24 font-mono text-sm text-slate-400">Loading story…</p>
      </div>
    );
  }

  const img = media(article.watermarked_image_url || article.source_image_url);

  return (
    <div className="min-h-screen bg-[#FDFCF7] text-slate-900" data-testid="article-detail">
      <PublicNav />
      <article className="max-w-3xl mx-auto px-4 sm:px-6 py-10">
        <button
          onClick={() => navigate(-1)}
          data-testid="article-back-button"
          className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.15em] text-slate-500 hover:text-red-700 transition-colors mb-8"
        >
          <ArrowLeft size={14} /> Back
        </button>
        <span
          className={`inline-block px-2.5 py-0.5 text-[10px] font-mono uppercase tracking-[0.15em] border rounded ${CATEGORY_BADGE[article.category]}`}
        >
          {categoryLabel(article.category)}
        </span>
        <h1 className="mt-4 font-serif font-extrabold text-4xl sm:text-5xl leading-[1.1] tracking-tight">
          {article.title}
        </h1>
        <div className="mt-4 flex items-center gap-3 font-mono text-[11px] uppercase tracking-wider text-slate-500">
          <span>{article.author}</span>
          <span className="text-slate-300">|</span>
          <span data-testid="article-publish-date">{fmtDate(article.published_at)}</span>
        </div>
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
          className="relative aspect-[16/9] overflow-hidden rounded-lg bg-slate-100 mt-8"
        >
          <img
            src={img}
            alt={article.title}
            data-testid="article-watermarked-media"
            className="w-full h-full object-cover"
          />
          <WatermarkBadge />
        </motion.div>
        <div className="mt-8 space-y-5 text-lg leading-relaxed text-slate-800 first-letter:font-serif">
          {article.body.split("\n\n").map((p, i) => (
            <p key={i}>{p}</p>
          ))}
        </div>
      </article>
      <Footer />
    </div>
  );
}
