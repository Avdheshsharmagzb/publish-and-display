import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { media, fmtDate } from "@/lib/api";
import { CATEGORY_BADGE, categoryLabel } from "@/constants/news";
import { WatermarkBadge } from "./WatermarkBadge";

export const ArticleCard = ({ article, index = 0 }) => {
  const img = media(article.watermarked_image_url || article.source_image_url);
  return (
    <motion.article
      data-testid={`article-card-${article.id}`}
      initial={{ opacity: 0, y: 18 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.4, delay: (index % 6) * 0.05 }}
      className="group flex flex-col bg-white border border-slate-200 rounded-lg overflow-hidden hover:shadow-xl hover:-translate-y-1 transition-all duration-300"
    >
      <Link to={`/article/${article.id}`} className="block">
        <div className="relative aspect-[16/10] overflow-hidden bg-slate-100">
          <img
            src={img}
            alt={article.title}
            loading="lazy"
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          />
          <WatermarkBadge />
        </div>
      </Link>
      <div className="flex flex-col flex-1 p-5">
        <span
          className={`self-start mb-3 px-2.5 py-0.5 text-[10px] font-mono uppercase tracking-[0.15em] border rounded ${CATEGORY_BADGE[article.category]}`}
        >
          {categoryLabel(article.category)}
        </span>
        <Link to={`/article/${article.id}`}>
          <h3 className="font-serif font-bold text-lg sm:text-xl leading-snug text-slate-900 group-hover:text-red-700 transition-colors">
            {article.title}
          </h3>
        </Link>
        <p className="mt-2 text-sm text-slate-600 leading-relaxed line-clamp-3 flex-1">
          {article.excerpt}
        </p>
        <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between font-mono text-[11px] uppercase tracking-wider text-slate-400">
          <span>{article.author}</span>
          <span data-testid="article-publish-date">{fmtDate(article.published_at)}</span>
        </div>
      </div>
    </motion.article>
  );
};
