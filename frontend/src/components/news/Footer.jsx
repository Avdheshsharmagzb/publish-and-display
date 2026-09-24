export const Footer = () => (
  <footer className="mt-20 border-t-4 border-slate-900 bg-[#0B0F17] text-slate-300">
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-12">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-6">
        <div>
          <p className="font-serif font-extrabold text-3xl text-white">The Meridian</p>
          <p className="mt-2 font-mono text-[11px] uppercase tracking-[0.2em] text-slate-500">
            Independent Journalism · Verified Media
          </p>
        </div>
        <p className="font-mono text-[11px] uppercase tracking-[0.15em] text-slate-500">
          © {new Date().getFullYear()} Meridian News. All media watermarked.
        </p>
      </div>
    </div>
  </footer>
);
