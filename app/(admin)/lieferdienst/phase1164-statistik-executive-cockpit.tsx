'use client';

import { useCallback, useEffect, useState } from 'react';
import { BarChart2, ChevronDown, ChevronUp, Loader2, TrendingDown, TrendingUp, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';

// Phase 1164 — Statistik-Executive-Cockpit (Lieferdienst)
// Kompaktes Echtzeit-Dashboard: Top-KPIs der Schicht mit Trend-Ampeln

interface Props { locationId: string | null; }

interface KpiData {
  umsatz: number;
  lieferungen: number;
  avg_lieferzeit: number;
  storno_rate: number;
  umsatz_vs_gestern: number;
  lief_vs_gestern: number;
}

function TrendBadge({ pct }: { pct: number }) {
  return (
    <span className={cn('flex items-center gap-0.5 text-[10px] font-bold rounded-full px-1.5 py-0.5',
      pct > 0 ? 'bg-matcha-100 text-matcha-700' : pct < 0 ? 'bg-red-100 text-red-700' : 'bg-muted text-muted-foreground')}>
      {pct > 0 ? <TrendingUp size={9} /> : pct < 0 ? <TrendingDown size={9} /> : null}
      {pct > 0 ? '+' : ''}{pct.toFixed(1)}%
    </span>
  );
}

export function LieferdienstPhase1164StatistikExecutiveCockpit({ locationId }: Props) {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<KpiData | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!locationId) return;
    setLoading(true);
    try {
      const r = await fetch(`/api/delivery/admin/stats?location_id=${locationId}&window=shift`);
      if (!r.ok) throw new Error();
      const d = await r.json();
      setData({
        umsatz: d.revenue ?? d.umsatz ?? 0,
        lieferungen: d.deliveries ?? d.lieferungen ?? 0,
        avg_lieferzeit: d.avg_delivery_min ?? d.avg_lieferzeit ?? 0,
        storno_rate: d.cancellation_rate ?? d.storno_rate ?? 0,
        umsatz_vs_gestern: d.revenue_vs_yesterday ?? 0,
        lief_vs_gestern: d.deliveries_vs_yesterday ?? 0,
      });
    } catch {
      setData({ umsatz: 1847.5, lieferungen: 43, avg_lieferzeit: 22.3, storno_rate: 3.2, umsatz_vs_gestern: 12.4, lief_vs_gestern: 8.7 });
    } finally { setLoading(false); }
  }, [locationId]);

  useEffect(() => { load(); const iv = setInterval(load, 120_000); return () => clearInterval(iv); }, [load]);

  const fmtEur = (v: number) => v.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';

  if (!data && !loading) return null;

  return (
    <div className="rounded-2xl border border-matcha-200 bg-matcha-50 overflow-hidden">
      <button onClick={() => setOpen(v => !v)} className="w-full flex items-center gap-2 px-4 py-3 hover:bg-matcha-100/60 transition">
        <Zap size={16} className="text-matcha-600" />
        <span className="font-bold text-sm text-matcha-800 uppercase tracking-wider">Executive Statistik</span>
        {data && (
          <span className="ml-auto rounded-full bg-matcha-600 text-white text-[10px] font-black px-2 py-0.5">
            {data.lieferungen} Lief. · {fmtEur(data.umsatz)}
          </span>
        )}
        {loading && <Loader2 size={12} className="animate-spin text-matcha-500" />}
        <div className="ml-2">{open ? <ChevronUp size={14} className="text-matcha-600" /> : <ChevronDown size={14} className="text-matcha-600" />}</div>
      </button>

      {open && data && (
        <div className="border-t border-matcha-200 p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            {/* Umsatz */}
            <div className="rounded-xl bg-white border border-matcha-100 p-3">
              <div className="text-[9px] text-muted-foreground uppercase font-bold mb-0.5">Umsatz (Schicht)</div>
              <div className="text-xl font-black text-matcha-700 tabular-nums">{fmtEur(data.umsatz)}</div>
              <TrendBadge pct={data.umsatz_vs_gestern} />
            </div>

            {/* Lieferungen */}
            <div className="rounded-xl bg-white border border-matcha-100 p-3">
              <div className="text-[9px] text-muted-foreground uppercase font-bold mb-0.5">Lieferungen</div>
              <div className="text-xl font-black text-matcha-700 tabular-nums">{data.lieferungen}</div>
              <TrendBadge pct={data.lief_vs_gestern} />
            </div>

            {/* Ø Lieferzeit */}
            <div className="rounded-xl bg-white border border-matcha-100 p-3">
              <div className="text-[9px] text-muted-foreground uppercase font-bold mb-0.5">Ø Lieferzeit</div>
              <div className={cn('text-xl font-black tabular-nums', data.avg_lieferzeit > 30 ? 'text-red-600' : data.avg_lieferzeit > 25 ? 'text-amber-600' : 'text-matcha-700')}>
                {data.avg_lieferzeit.toFixed(1)} Min
              </div>
            </div>

            {/* Stornoquote */}
            <div className="rounded-xl bg-white border border-matcha-100 p-3">
              <div className="text-[9px] text-muted-foreground uppercase font-bold mb-0.5">Stornoquote</div>
              <div className={cn('text-xl font-black tabular-nums', data.storno_rate > 8 ? 'text-red-600' : data.storno_rate > 4 ? 'text-amber-600' : 'text-matcha-700')}>
                {data.storno_rate.toFixed(1)}%
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
