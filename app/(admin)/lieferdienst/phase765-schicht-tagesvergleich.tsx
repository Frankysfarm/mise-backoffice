'use client';

import { useCallback, useEffect, useState } from 'react';
import { TrendingUp, TrendingDown, Minus, CalendarDays, ChevronDown, ChevronUp } from 'lucide-react';

interface Props {
  locationId: string | null;
}

interface TagKpi {
  umsatz_eur: number;
  touren: number;
  trinkgeld_eur: number;
  lieferungen: number;
}

interface VergleichDaten {
  heute: TagKpi;
  gestern: TagKpi;
}

const MOCK: VergleichDaten = {
  heute: { umsatz_eur: 1240.50, touren: 38, trinkgeld_eur: 89.40, lieferungen: 42 },
  gestern: { umsatz_eur: 1105.80, touren: 34, trinkgeld_eur: 72.10, lieferungen: 37 },
};

function delta(heute: number, gestern: number) {
  if (gestern === 0) return null;
  return Math.round(((heute - gestern) / gestern) * 100);
}

function TrendIcon({ pct }: { pct: number | null }) {
  if (pct === null) return <Minus className="h-3 w-3 text-muted-foreground" />;
  if (pct > 0) return <TrendingUp className="h-3 w-3 text-emerald-500" />;
  if (pct < 0) return <TrendingDown className="h-3 w-3 text-red-500" />;
  return <Minus className="h-3 w-3 text-muted-foreground" />;
}

function TrendBadge({ pct }: { pct: number | null }) {
  if (pct === null) return null;
  const cls = pct > 0 ? 'text-emerald-600 dark:text-emerald-400' : pct < 0 ? 'text-red-500' : 'text-muted-foreground';
  return (
    <span className={`text-[9px] font-bold tabular-nums ${cls}`}>
      {pct > 0 ? '+' : ''}{pct}%
    </span>
  );
}

export function LieferdienstPhase765SchichtTagesvergleich({ locationId }: Props) {
  const [data, setData] = useState<VergleichDaten | null>(null);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(true);

  const laden = useCallback(async () => {
    if (!locationId) { setData(MOCK); setLoading(false); return; }
    try {
      const res = await fetch(
        `/api/delivery/admin/schicht-tagesvergleich?location_id=${locationId}`,
        { cache: 'no-store' },
      );
      if (res.ok) {
        const json = await res.json();
        if (json.heute && json.gestern) { setData(json); return; }
      }
    } catch { /* fallback */ }
    setData(MOCK);
  }, [locationId]);

  useEffect(() => {
    laden().finally(() => setLoading(false));
    const id = setInterval(laden, 5 * 60_000);
    return () => clearInterval(id);
  }, [laden]);

  if (loading || !data) return null;

  const kpis = [
    { label: 'Umsatz', heute: `${data.heute.umsatz_eur.toFixed(2)} €`, gestern: `${data.gestern.umsatz_eur.toFixed(2)} €`, pct: delta(data.heute.umsatz_eur, data.gestern.umsatz_eur) },
    { label: 'Touren', heute: String(data.heute.touren), gestern: String(data.gestern.touren), pct: delta(data.heute.touren, data.gestern.touren) },
    { label: 'Lieferungen', heute: String(data.heute.lieferungen), gestern: String(data.gestern.lieferungen), pct: delta(data.heute.lieferungen, data.gestern.lieferungen) },
    { label: 'Trinkgeld', heute: `${data.heute.trinkgeld_eur.toFixed(2)} €`, gestern: `${data.gestern.trinkgeld_eur.toFixed(2)} €`, pct: delta(data.heute.trinkgeld_eur, data.gestern.trinkgeld_eur) },
  ];

  return (
    <div className="rounded-xl border bg-card shadow-sm p-4">
      <button onClick={() => setOpen((o) => !o)} className="flex w-full items-center justify-between mb-0">
        <div className="flex items-center gap-2">
          <CalendarDays className="h-4 w-4 text-indigo-500" />
          <span className="text-sm font-semibold">Heute vs. Gestern</span>
        </div>
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>

      {open && (
        <>
          <div className="mt-3 grid grid-cols-2 gap-2 text-xs mb-2">
            <div className="font-semibold text-muted-foreground">KPI</div>
            <div className="grid grid-cols-3 gap-1 font-semibold text-muted-foreground text-[10px]">
              <span>Heute</span><span>Gestern</span><span>Δ</span>
            </div>
          </div>

          <div className="space-y-1.5">
            {kpis.map((k) => (
              <div key={k.label} className="grid grid-cols-2 gap-2 items-center">
                <span className="text-xs text-foreground">{k.label}</span>
                <div className="grid grid-cols-3 gap-1 items-center">
                  <span className="text-xs font-bold tabular-nums">{k.heute}</span>
                  <span className="text-[10px] text-muted-foreground tabular-nums">{k.gestern}</span>
                  <div className="flex items-center gap-0.5">
                    <TrendIcon pct={k.pct} />
                    <TrendBadge pct={k.pct} />
                  </div>
                </div>
              </div>
            ))}
          </div>

          <p className="text-[9px] text-muted-foreground mt-3">Heute (Schichtbeginn) vs. gestern gleiche Zeit · 5-Min Update</p>
        </>
      )}
    </div>
  );
}
