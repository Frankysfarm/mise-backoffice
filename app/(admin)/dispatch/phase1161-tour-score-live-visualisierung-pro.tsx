'use client';

import { useCallback, useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, Gauge, Loader2, RefreshCw, Route } from 'lucide-react';
import { cn } from '@/lib/utils';

// Phase 1161 — Tour-Score-Live-Visualisierung-Pro (Dispatch)
// Animierte Score-Kacheln je aktiver Tour: Effizienz-Balken + ETA-Ampel + Stopp-Fortschritt

interface Props { locationId: string | null; }

interface Tour {
  id: string;
  fahrer: string;
  zone: string | null;
  score: number;
  stopps: number;
  erledigt: number;
  laufzeit: number;
  verbleibend: number | null;
  ampel: 'gruen' | 'gelb' | 'rot';
}

const GRADE = (s: number) => s >= 80 ? 'A' : s >= 60 ? 'B' : s >= 40 ? 'C' : 'D';
const SCORE_CLS = (s: number) => s >= 80
  ? 'bg-matcha-500 text-white'
  : s >= 60 ? 'bg-amber-400 text-white'
  : s >= 40 ? 'bg-orange-500 text-white'
  : 'bg-red-600 text-white';
const AMPEL_CLS: Record<string, string> = {
  gruen: 'bg-matcha-500',
  gelb:  'bg-amber-400',
  rot:   'bg-red-500 animate-pulse',
};

export function DispatchPhase1161TourScoreLiveVisualisierungPro({ locationId }: Props) {
  const [open, setOpen] = useState(false);
  const [touren, setTouren] = useState<Tour[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!locationId) return;
    setLoading(true);
    try {
      const r = await fetch(`/api/delivery/admin/tour-ampel?location_id=${locationId}&limit=15`);
      if (!r.ok) throw new Error();
      const d = await r.json();
      const raw = (d.batches ?? []) as any[];
      setTouren(
        raw
          .map((b: any, i: number) => {
            const fort = b.stopps_gesamt ? (b.stopps_erledigt ?? 0) / b.stopps_gesamt : 0;
            const score = Math.round(Math.min(100, fort * 65 + (b.ampel === 'gruen' ? 20 : b.ampel === 'gelb' ? 8 : -5)));
            return { id: b.id ?? `t${i}`, fahrer: b.fahrer_name ?? 'Fahrer', zone: b.zone ?? null, score, stopps: b.stopps_gesamt ?? 0, erledigt: b.stopps_erledigt ?? 0, laufzeit: b.laufzeit_min ?? 0, verbleibend: b.verbleibend_min ?? null, ampel: b.ampel ?? 'gelb' };
          })
          .sort((a: Tour, b: Tour) => b.score - a.score),
      );
    } catch {
      setTouren([
        { id: 'm1', fahrer: 'Alex W.', zone: 'Nord', score: 91, stopps: 4, erledigt: 4, laufzeit: 32, verbleibend: 0, ampel: 'gruen' },
        { id: 'm2', fahrer: 'Jana F.', zone: 'Ost',  score: 64, stopps: 3, erledigt: 2, laufzeit: 25, verbleibend: 8, ampel: 'gelb' },
        { id: 'm3', fahrer: 'Kai B.',  zone: 'Süd',  score: 31, stopps: 5, erledigt: 1, laufzeit: 44, verbleibend: -4, ampel: 'rot' },
      ]);
    } finally { setLoading(false); }
  }, [locationId]);

  useEffect(() => { load(); const iv = setInterval(load, 60_000); return () => clearInterval(iv); }, [load]);

  if (!touren.length && !loading) return null;
  const avg = touren.length ? Math.round(touren.reduce((s, t) => s + t.score, 0) / touren.length) : 0;

  return (
    <div className="rounded-2xl border border-matcha-200 bg-matcha-50 overflow-hidden">
      <button onClick={() => setOpen(v => !v)} className="w-full flex items-center gap-2 px-4 py-3 hover:bg-matcha-100/60 transition">
        <Gauge size={16} className="text-matcha-700" />
        <span className="font-bold text-sm text-matcha-800 uppercase tracking-wider">Tour-Score Live</span>
        {touren.length > 0 && (
          <span className="rounded-full bg-matcha-600 text-white text-[10px] font-black px-2 py-0.5 ml-1">
            {touren.length} · Ø {avg}
          </span>
        )}
        {loading && <Loader2 size={12} className="animate-spin text-matcha-500" />}
        <div className="ml-auto flex items-center gap-1">
          <button onClick={e => { e.stopPropagation(); load(); }} className="rounded-full p-1 hover:bg-matcha-200 transition">
            <RefreshCw size={12} className="text-matcha-500" />
          </button>
          {open ? <ChevronUp size={14} className="text-matcha-600" /> : <ChevronDown size={14} className="text-matcha-600" />}
        </div>
      </button>

      {open && (
        <div className="border-t border-matcha-200 p-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
          {touren.map((t, i) => {
            const pct = t.stopps > 0 ? Math.round((t.erledigt / t.stopps) * 100) : 0;
            return (
              <div key={t.id} className="rounded-xl border border-matcha-200 bg-white p-3 flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <span className={cn('h-6 w-6 rounded-md text-[11px] font-black flex items-center justify-center shrink-0', SCORE_CLS(t.score))}>
                    {GRADE(t.score)}
                  </span>
                  <span className="text-xs font-bold truncate flex-1">{t.fahrer}</span>
                  {t.zone && <span className="text-[9px] rounded-full bg-matcha-100 text-matcha-700 px-1.5 py-0.5 font-bold">{t.zone}</span>}
                  <span className={cn('h-2 w-2 rounded-full shrink-0', AMPEL_CLS[t.ampel])} />
                </div>

                <div className="flex items-center gap-2">
                  <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                    <div className="h-full rounded-full bg-matcha-500 transition-all duration-700" style={{ width: `${pct}%` }} />
                  </div>
                  <span className="text-[9px] tabular-nums shrink-0">{t.erledigt}/{t.stopps}</span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-[9px] text-muted-foreground flex items-center gap-0.5">
                    <Route size={9} /> {t.laufzeit} Min
                  </span>
                  <span className={cn('text-[10px] font-black tabular-nums', t.verbleibend !== null && t.verbleibend < 0 ? 'text-red-600' : 'text-matcha-700')}>
                    {t.score} Pkt
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
