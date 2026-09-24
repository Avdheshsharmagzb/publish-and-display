import { Link, useLocation } from "react-router-dom";
import { CATEGORIES } from "@/constants/news";
import { fmtDate } from "@/lib/api";
import { LayoutDashboard } from "lucide-react";

export const PublicNav = () => {
  const location = useLocation();
  const activeSlug = location.pathname.startsWith("/category/")
    ? location.pathname.split("/category/")[1]
    : "";

  return (
    <header
      data-testid="public-nav"
      className="sticky top-0 z-50 bg-[#FDFCF7]/90 backdrop-blur-md border-b border-slate-200"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between py-3 border-b border-slate-200/70">
          <span className="hidden sm:block font-mono text-[11px] uppercase tracking-[0.2em] text-slate-500">
            {fmtDate(new Date().toISOString())}
          </span>
          <Link
            to="/"
            data-testid="public-nav-brand"
            className="font-serif font-extrabold text-3xl sm:text-4xl tracking-tight text-slate-900 hover:text-red-700 transition-colors"
          >
            The Meridian
          </Link>
          <Link
            to="/admin"
            data-testid="nav-admin-link"
            className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.15em] text-slate-600 hover:text-red-700 transition-colors"
          >
            <LayoutDashboard size={14} />
            <span className="hidden sm:inline">Admin</span>
          </Link>
        </div>
        <nav className="flex items-center gap-1 sm:gap-2 overflow-x-auto py-2 no-scrollbar">
          <Link
            to="/"
            data-testid="category-filter-button-all"
            className={`shrink-0 px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.15em] rounded transition-colors ${
              !activeSlug
                ? "bg-slate-900 text-white"
                : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            Home
          </Link>
          {CATEGORIES.map((c) => (
            <Link
              key={c.slug}
              to={`/category/${c.slug}`}
              data-testid={`category-filter-button-${c.slug}`}
              className={`shrink-0 px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.15em] rounded transition-colors ${
                activeSlug === c.slug
                  ? "bg-slate-900 text-white"
                  : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              {c.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
};
