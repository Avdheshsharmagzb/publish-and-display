import { useEffect, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { toast } from "sonner";
import {
  Newspaper, CheckCircle2, Clock, Send, Plus, ArrowLeft, Loader2, Upload, ExternalLink,
} from "lucide-react";
import { api, media, fmtDate } from "@/lib/api";
import { CATEGORIES, categoryLabel, STATUS_PENDING, STATUS_PUBLISHED } from "@/constants/news";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

const StatCard = ({ icon: Icon, label, value, tone }) => (
  <div className="rounded-lg border border-slate-800 bg-[#111827] p-5">
    <div className="flex items-center justify-between">
      <span className="font-mono text-[11px] uppercase tracking-[0.15em] text-slate-400">{label}</span>
      <Icon size={18} className={tone} />
    </div>
    <p className="mt-3 font-serif font-bold text-4xl text-white" data-testid={`stat-${label.toLowerCase()}`}>
      {value}
    </p>
  </div>
);

const emptyForm = { title: "", category: "politics", excerpt: "", body: "", author: "Meridian Desk", source_image_url: "" };

export default function Admin() {
  const [articles, setArticles] = useState([]);
  const [stats, setStats] = useState({ total: 0, published: 0, pending: 0 });
  const [publishing, setPublishing] = useState(null);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [uploadPath, setUploadPath] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    api.get("/admin/articles").then((r) => setArticles(r.data)).catch(() => {});
    api.get("/admin/stats").then((r) => setStats(r.data)).catch(() => {});
  }, []);

  useEffect(() => { load(); }, [load]);

  const handlePublish = async (a) => {
    setPublishing(a.id);
    try {
      await api.post(`/admin/articles/${a.id}/publish`);
      toast.success("Article published", {
        description: `"${a.title}" is now live with watermarked media.`,
      });
      load();
    } catch (e) {
      toast.error("Publish failed", { description: e?.response?.data?.detail || "Try again." });
    } finally {
      setPublishing(null);
    }
  };

  const handleUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const fd = new FormData();
    fd.append("file", file);
    try {
      const r = await api.post("/admin/upload", fd, { headers: { "Content-Type": "multipart/form-data" } });
      setUploadPath(r.data.storage_path);
      setForm((f) => ({ ...f, source_image_url: r.data.url }));
      toast.success("Image uploaded");
    } catch {
      toast.error("Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const handleCreate = async () => {
    if (!form.title || !form.excerpt || !form.body) {
      toast.error("Title, excerpt and body are required");
      return;
    }
    setSaving(true);
    try {
      await api.post("/admin/articles", { ...form, source_storage_path: uploadPath });
      toast.success("Draft created", { description: "Status: Rewritten_Pending_Publish" });
      setOpen(false);
      setForm(emptyForm);
      setUploadPath(null);
      load();
    } catch {
      toast.error("Could not create article");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0B0F17] text-slate-100 font-sans p-4 sm:p-8 lg:p-10">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div>
            <Link to="/" className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.15em] text-slate-500 hover:text-emerald-400 transition-colors mb-3">
              <ArrowLeft size={14} /> Public Site
            </Link>
            <h1 className="font-serif font-extrabold text-3xl sm:text-4xl text-white">Newsroom Control</h1>
            <p className="mt-1 font-mono text-[11px] uppercase tracking-[0.2em] text-slate-500">
              Publish · Watermark · Distribute
            </p>
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <button
                data-testid="admin-create-article-modal-trigger"
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-white text-slate-900 font-medium text-sm rounded-md hover:bg-slate-200 transition-colors"
              >
                <Plus size={16} /> New Article
              </button>
            </DialogTrigger>
            <DialogContent className="bg-[#111827] border-slate-800 text-slate-100 max-w-lg max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="font-serif text-2xl">Create Rewritten Article</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-2">
                <div>
                  <label className="block font-mono text-[11px] uppercase tracking-wider text-slate-400 mb-1">Title</label>
                  <input
                    data-testid="form-title-input"
                    value={form.title}
                    onChange={(e) => setForm({ ...form, title: e.target.value })}
                    className="w-full bg-[#0B0F17] border border-slate-700 rounded px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block font-mono text-[11px] uppercase tracking-wider text-slate-400 mb-1">Category</label>
                    <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                      <SelectTrigger data-testid="form-category-select" className="bg-[#0B0F17] border-slate-700 text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {CATEGORIES.map((c) => (
                          <SelectItem key={c.slug} value={c.slug}>{c.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="block font-mono text-[11px] uppercase tracking-wider text-slate-400 mb-1">Author</label>
                    <input
                      value={form.author}
                      onChange={(e) => setForm({ ...form, author: e.target.value })}
                      className="w-full bg-[#0B0F17] border border-slate-700 rounded px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none"
                    />
                  </div>
                </div>
                <div>
                  <label className="block font-mono text-[11px] uppercase tracking-wider text-slate-400 mb-1">Excerpt</label>
                  <textarea
                    data-testid="form-excerpt-input"
                    value={form.excerpt}
                    onChange={(e) => setForm({ ...form, excerpt: e.target.value })}
                    rows={2}
                    className="w-full bg-[#0B0F17] border border-slate-700 rounded px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block font-mono text-[11px] uppercase tracking-wider text-slate-400 mb-1">Body</label>
                  <textarea
                    data-testid="form-body-input"
                    value={form.body}
                    onChange={(e) => setForm({ ...form, body: e.target.value })}
                    rows={4}
                    className="w-full bg-[#0B0F17] border border-slate-700 rounded px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block font-mono text-[11px] uppercase tracking-wider text-slate-400 mb-1">Media</label>
                  <div className="flex items-center gap-3">
                    <label className="inline-flex items-center gap-2 px-3 py-2 bg-[#0B0F17] border border-slate-700 rounded text-sm cursor-pointer hover:border-emerald-500">
                      {uploading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
                      Upload
                      <input type="file" accept="image/*" onChange={handleUpload} className="hidden" data-testid="form-image-upload" />
                    </label>
                    <input
                      placeholder="or paste image URL"
                      value={form.source_image_url}
                      onChange={(e) => { setForm({ ...form, source_image_url: e.target.value }); setUploadPath(null); }}
                      className="flex-1 bg-[#0B0F17] border border-slate-700 rounded px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none"
                    />
                  </div>
                  {form.source_image_url && (
                    <img src={media(form.source_image_url)} alt="preview" className="mt-3 w-full h-32 object-cover rounded border border-slate-700" />
                  )}
                </div>
              </div>
              <DialogFooter>
                <button
                  data-testid="admin-news-form-submit-button"
                  onClick={handleCreate}
                  disabled={saving}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 text-white font-medium text-sm rounded-md transition-colors"
                >
                  {saving && <Loader2 size={14} className="animate-spin" />}
                  Save as Pending
                </button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          <StatCard icon={Newspaper} label="Total" value={stats.total} tone="text-slate-400" />
          <StatCard icon={Clock} label="Pending" value={stats.pending} tone="text-amber-400" />
          <StatCard icon={CheckCircle2} label="Published" value={stats.published} tone="text-emerald-400" />
        </div>

        <div className="rounded-lg border border-slate-800 bg-[#111827] overflow-hidden">
          <div className="hidden md:grid grid-cols-12 gap-4 px-6 py-3 border-b border-slate-800 font-mono text-[10px] uppercase tracking-[0.15em] text-slate-500">
            <span className="col-span-5">Article</span>
            <span className="col-span-2">Category</span>
            <span className="col-span-2">Status</span>
            <span className="col-span-3 text-right">Action</span>
          </div>
          {articles.length === 0 && (
            <p className="px-6 py-10 text-center text-slate-500 text-sm">No articles yet.</p>
          )}
          {articles.map((a) => {
            const isPending = a.status === STATUS_PENDING;
            return (
              <motion.div
                key={a.id}
                layout
                data-testid={`admin-row-${a.id}`}
                className="grid grid-cols-1 md:grid-cols-12 gap-3 md:gap-4 items-center px-6 py-4 border-b border-slate-800/60 hover:bg-white/[0.02] transition-colors"
              >
                <div className="col-span-5 flex items-center gap-3 min-w-0">
                  <div className="relative w-14 h-14 shrink-0 overflow-hidden rounded bg-slate-800">
                    <img
                      src={media((isPending ? a.source_image_url : a.watermarked_image_url) || a.source_image_url)}
                      alt=""
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <p className="font-serif font-semibold text-sm leading-snug truncate">{a.title}</p>
                </div>
                <div className="col-span-2">
                  <span className="font-mono text-[11px] uppercase tracking-wider text-slate-400">
                    {categoryLabel(a.category)}
                  </span>
                </div>
                <div className="col-span-2">
                  <span
                    data-testid={`admin-status-badge-${a.id}`}
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-mono uppercase tracking-wider border rounded ${
                      isPending
                        ? "bg-amber-500/10 text-amber-400 border-amber-500/20"
                        : "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                    }`}
                  >
                    {isPending ? "Pending Publish" : "Published"}
                  </span>
                </div>
                <div className="col-span-3 flex md:justify-end">
                  {isPending ? (
                    <button
                      data-testid={`admin-publish-button-${a.id}`}
                      onClick={() => handlePublish(a)}
                      disabled={publishing === a.id}
                      className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 text-white font-medium text-xs rounded-md shadow-md transition-all transform active:scale-95 focus:ring-2 focus:ring-emerald-400 focus:outline-none"
                    >
                      {publishing === a.id ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                      {publishing === a.id ? "Publishing…" : "Publish"}
                    </button>
                  ) : (
                    <Link
                      to={`/article/${a.id}`}
                      className="inline-flex items-center gap-1.5 px-3 py-2 text-slate-400 hover:text-white text-xs font-mono uppercase tracking-wider transition-colors"
                    >
                      <ExternalLink size={13} /> View Live
                    </Link>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
