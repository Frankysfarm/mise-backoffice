'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { Euro, Target, TrendingUp, Clock, ChevronDown, ChevronUp, Star } from 'lucide-react';

interface Props {
  driverId: string;
  locationId?: string | null;
}

interface BilanzData {
  verdienstHeute: number;
  zielHeute: number;
  trinkgeldHeute: number;
  stoppsHeute: number;
  durchschnittTrinkgeld: number;
  schichtDauerMin: number;
  verdienstProStunde: number;
  zielErreichtPct: number;
  prognoseGesamtverdienst: number;
  schichtEnde?: string | null;
}

const MOCK: BilanzData = {
  verdienstHeute: 68.5,
  zielHeute: 100,
  trinkgeldHeute: 12.4,
  stoppsHeute: 9,
  durchschnittTrinkgeld: 1.38,
  schichtDauerMin: 245,
  verdienstProStunde: 16.8,
  zielErreichtPct: 68.5,
  prognoseGesamtverdienst: 105.2,
  schichtEnde: null,
};

function fmtEur(v: number) {
  return v.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
}

function fmtMin(min: number) {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h > 0 ? `${h} Std ${m} Min` : `${m} Min`;
}

export function FahrerPhase835SchichtBilanzCockpit({ driverId, locationId }: Props) {
  const [data, setData] = useState<BilanzData | null>(null);
  const [expanded, setExpanded] = useState(true);

  const load = async () => {
    try {
      const res = await fetch(
        `/api/delivery/driver?driver_id=${driverId}&location_id=${locationId ?? ''}&action=schicht_bilanz`,
        { cache: 'no-store' },
      );
      if (!res.ok) throw new Error();
      const json = await res.json();
      if (json.bilanz) { setData(json.bilanz); return; }
    } catch { /* noop */ }
    setData(MOCK);
  };

  useEffect(() => {
    load();
    const iv = setInterval(load, 120_000);
    return () => clearInterval(iv);
  }, [driverId]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!data) return null;

  const pct = Math.min(100, Math.round(data.zielErreichtPct));
  const zielFarbe = pct >= 100 ? 'bg-matcha-500' : pct >= 70 ? 'bg-amber-400' : 'bg-red-400';
  const pctText = pct >= 100 ? 'text-matcha-700' : pct >= 70 ? 'text-amber-700' : 'text-red-700';

  return (
    <div className="rounded-2xl border border-stone-200 bg-white overflow-hidden">
      <button
        className="w-full flex items-center gap-3 px-4 py-3 bg-stone-50 border-b border-stone-100 hover:bg-stone-100 transition-colors"
        onClick={() => setExpanded((v) => !v)}
      >
        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-amber-100 text-amber-700 shrink-0">
          <Euro className="h-3.5 w-3.5" />
        </div>
        <div className="flex-1 text-left">
          <div className="text-sm font-bold text-stone-800">Schicht-Bilanz</div>
          <div className="text-[11px] text-stone-500">
            {fmtEur(data.verdienstHeute)} von {fmtEur(data.zielHeute)} Ziel
          </div>
        </div>
        <span className={cn('text-[11px] font-black px-2 py-0.5 rounded-full', pctText, pct >= 100 ? 'bg-matcha-50' : pct >= 70 ? 'bg-amber-50' : 'bg-red-50')}>
          {pct}%
        </span>
        {expanded ? <ChevronUp className="h-4 w-4 text-stone-400" /> : <ChevronDown className="h-4 w-4 text-stone-400" />}
      </button>

      {expanded && (
        <div className="p-4 space-y-4">
          {/* Progress bar */}
          <div>
            <div className="flex justify-between text-[11px] text-stone-500 mb-1.5">
              <span>Ziel-Fortschritt</span>
              <span className={cn('font-bold', pctText)}>{pct}%</span>
            </div>
            <div className="h-3 rounded-full bg-stone-100 overflow-hidden">
              <div
                className={cn('h-full rounded-full transition-all duration-700', zielFarbe)}
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>

          {/* KPI Grid */}
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-xl bg-amber-50 p-3">
              <div className="text-[10px] font-semibold text-amber-600 uppercase tracking-wide mb-0.5">Verdienst</div>
              <div className="text-lg font-black text-amber-800 tabular-nums">{fmtEur(data.verdienstHeute)}</div>
            </div>
            <div className="rounded-xl bg-matcha-50 p-3">
              <div className="text-[10px] font-semibold text-matcha-600 uppercase tracking-wide mb-0.5">Prognose</div>
              <div className="text-lg font-black text-matcha-800 tabular-nums">{fmtEur(data.prognoseGesamtverdienst)}</div>
            </div>
            <div className="rounded-xl bg-blue-50 p-3">
              <div className="text-[10px] font-semibold text-blue-600 uppercase tracking-wide mb-0.5">Trinkgeld</div>
              <div className="text-lg font-black text-blue-800 tabular-nums">{fmtEur(data.trinkgeldHeute)}</div>
            </div>
            <div className="rounded-xl bg-stone-50 p-3">
              <div className="text-[10px] font-semibold text-stone-500 uppercase tracking-wide mb-0.5">Ø / Stopp</div>
              <div className="text-lg font-black text-stone-700 tabular-nums">{fmtEur(data.durchschnittTrinkgeld)}</div>
            </div>
          </div>

          {/* Stats row */}
          <div className="flex items-center gap-3 border-t border-stone-100 pt-3">
            <div className="flex items-center gap-1.5 text-[11px] text-stone-600">
              <Clock className="h-3.5 w-3.5 text-stone-400" />
              <span>{fmtMin(data.schichtDauerMin)}</span>
            </div>
            <div className="flex items-center gap-1.5 text-[11px] text-stone-600">
              <TrendingUp className="h-3.5 w-3.5 text-stone-400" />
              <span>{fmtEur(data.verdienstProStunde)}/h</span>
            </div>
            <div className="flex items-center gap-1.5 text-[11px] text-stone-600">
              <Target className="h-3.5 w-3.5 text-stone-400" />
              <span>{data.stoppsHeute} Stopps</span>
            </div>
            {pct >= 100 && (
              <div className="ml-auto flex items-center gap-1 text-[11px] font-bold text-matcha-600">
                <Star className="h-3.5 w-3.5 fill-matcha-500 text-matcha-500" />
                Ziel erreicht!
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
