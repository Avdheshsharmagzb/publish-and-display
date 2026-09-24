import { ShieldCheck } from "lucide-react";

export const WatermarkBadge = ({ label = "Watermarked" }) => (
  <div
    data-testid="watermark-overlay"
    className="absolute bottom-3 right-3 px-3 py-1 bg-black/75 backdrop-blur-md text-white font-mono text-[10px] uppercase tracking-widest border border-white/20 rounded shadow-lg flex items-center gap-1.5 pointer-events-none select-none z-10"
  >
    <ShieldCheck size={12} className="text-emerald-400" />
    {label}
  </div>
);
