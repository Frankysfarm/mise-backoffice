'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { ChevronDown, ChevronUp, Euro, TrendingDown, TrendingUp, Minus } from 'lucide-react';

/**
 * Phase 1853 — Tour-Kosten-Widget (Dispatch)
 *
 * Zeigt aus /api/delivery/admin/tour-kosten-analyse (Phase 1846):
 *  - Kosten heute / Kosten diese Woche / Ø Kosten je Stopp
 * Trend-Pfeil gegenüber Wochenschnitt.
 * 30-Min-Polling.
 */

interface KostenData {
  heute_kosten_cents: number;
  woche_kosten_cents: number;
  heute_stopps: number;
  woche_stopps: number;
  avg_kosten_pro_stopp_cents: number;
}

const MOCK: KostenData = {
  heute_kosten_cents: 3780,
  woche_kosten_cents: 22140,
  heute_stopps: 44,
  woche_stopps: 258,
  avg_kosten_pro_stopp_cents: 86,
};

function fmt(cents: number) {
  return (cents / 100).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
}

interface Props {
  locationId: string | null;
  className?: string;
}

export function DispatchPhase1853TourKostenWidget({ locationId, className }: Props) {
  const [offen, setOffen] = useState(true);
  const [data, setData] = useState<KostenData | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!locationId) return;
    let alive = true;
    async function load() {
      setLoading(true);
      try {
        const res = await fetch(`/api/delivery/admin/tour-kosten-analyse?location_id=${locationId}`);
        if (res.ok && alive) setData(await res.json());
      } catch {
        if (alive) setData(MOCK);
      } finally {
        if (alive) setLoading(false);
      }
    }
    load();
    const id = setInterval(load, 30 * 60_000);
    return () => { alive = false; clearInterval(id); };
  }, [locationId]);

  if (!locationId) return null;
  const d = data ?? MOCK;

  // Trend: Heute-Kosten/Stopp vs. Wochen-Ø-Kosten/Stopp
  const heuteAvg = d.heute_stopps > 0 ? d.heute_kosten_cents / d.heute_stopps : 0;
  const wocheAvg = d.woche_stopps > 0 ? d.woche_kosten_cents / d.woche_stopps : 0;
  const diff = wocheAvg > 0 ? ((heuteAvg - wocheAvg) / wocheAvg) * 100 : 0;
  const trend = Math.abs(diff) < 3 ? 'flat' : diff > 0 ? 'up' : 'down';

  return (
    <div className={cn('rounded-2xl border bg-card shadow-sm overflow-hidden', className)}>
      <button
        onClick={() => setOffen((v) => !v)}
        className="flex w-full items-center gap-2 px-4 py-2.5 border-b hover:bg-muted/30 transition-colors"
      >
        <Euro className="h-4 w-4 shrink-0 text-amber-600" />
        <span className="text-xs font-bold uppercase tracking-wider">Tour-Kosten-Analyse</span>
        {loading && <span className="ml-1 text-[9px] text-muted-foreground animate-pulse">lädt…</span>}
        <div className="ml-auto flex items-center gap-1.5">
          {trend === 'up' && (
            <span className="flex items-center gap-0.5 text-[10px] font-bold text-red-500">
              <TrendingUp className="h-3 w-3" /> +{Math.abs(diff).toFixed(1)}%
            </span>
          )}
          {trend === 'down' && (
            <span className="flex items-center gap-0.5 text-[10px] font-bold text-matcha-600">
              <TrendingDown className="h-3 w-3" /> -{Math.abs(diff).toFixed(1)}%
            </span>
          )}
          {trend === 'flat' && <Minus className="h-3.5 w-3.5 text-muted-foreground" />}
          {offen ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
        </div>
      </button>

      {offen && (
        <div className="px-4 py-3">
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'Heute gesamt', val: fmt(d.heute_kosten_cents), sub: `${d.heute_stopps} Stopps`, color: 'text-foreground' },
              { label: 'Diese Woche', val: fmt(d.woche_kosten_cents), sub: `${d.woche_stopps} Stopps`, color: 'text-foreground' },
              { label: 'Ø / Stopp', val: fmt(d.avg_kosten_pro_stopp_cents), sub: '7-Tage-Ø', color: trend === 'up' ? 'text-red-600' : trend === 'down' ? 'text-matcha-600' : 'text-foreground' },
            ].map(({ label, val, sub, color }) => (
              <div key={label} className="rounded-xl border bg-muted/30 px-3 py-2.5 text-center">
                <p className="text-[9px] text-muted-foreground mb-0.5">{label}</p>
                <p className={cn('text-sm font-black tabular-nums', color)}>{val}</p>
                <p className="text-[9px] text-muted-foreground mt-0.5">{sub}</p>
              </div>
            ))}
          </div>

          <div className="mt-3 rounded-xl border bg-amber-50 dark:bg-amber-950/20 border-amber-200 px-3 py-2 flex items-center gap-2">
            <Euro className="h-3.5 w-3.5 text-amber-600 shrink-0" />
            <p className="text-[10px] font-semibold text-amber-700 dark:text-amber-300">
              {trend === 'up'
                ? `Heute ${Math.abs(diff).toFixed(1)}% teurer als Wochenschnitt — Routen-Effizienz prüfen`
                : trend === 'down'
                ? `Heute ${Math.abs(diff).toFixed(1)}% günstiger als Wochenschnitt — gute Effizienz!`
                : 'Kosten heute im Wochendurchschnitt — alles im Plan'}
            </p>
          </div>

          <p className="mt-2 text-[9px] text-muted-foreground text-right">Alle 30 Min aktualisiert · Lohn 3 €/Stopp + 0,30 €/km</p>
        </div>
      )}
    </div>
  );
}
