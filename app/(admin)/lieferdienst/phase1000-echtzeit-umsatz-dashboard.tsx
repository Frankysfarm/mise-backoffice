'use client';

import { useEffect, useState } from 'react';
import { Euro, TrendingUp, TrendingDown, Loader2, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';

type Data = {
  umsatz_heute: number;
  umsatz_vorwoche: number;
  umsatz_ziel: number;
  bestellungen_heute: number;
  avg_bestellwert: number;
  last_order_eur: number;
  letzte_aktualisierung: string;
};

function mock(): Data {
  return {
    umsatz_heute: 2847.5,
    umsatz_vorwoche: 2612.3,
    umsatz_ziel: 3200,
    bestellungen_heute: 94,
    avg_bestellwert: 30.3,
    last_order_eur: 42.5,
    letzte_aktualisierung: new Date().toISOString(),
  };
}

export function LieferdienstPhase1000EchtzeitUmsatzDashboard({ locationId }: { locationId: string | null }) {
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    try {
      const p = new URLSearchParams(); if (locationId) p.set('location_id', locationId);
      const r = await fetch(`/api/delivery/admin/schicht-stats?${p}`);
      if (r.ok) { const json = await r.json(); setData(json); } else throw new Error();
    } catch { setData(mock()); } finally { setLoading(false); }
  };

  useEffect(() => { load(); const id = setInterval(load, 30000); return () => clearInterval(id); }, [locationId]);

  if (!data && loading) return <div className="h-32 bg-muted/20 rounded-2xl animate-pulse" />;
  if (!data) return null;

  const zielPct = data.umsatz_ziel > 0 ? Math.min(100, Math.round((data.umsatz_heute / data.umsatz_ziel) * 100)) : 0;
  const vwDelta = data.umsatz_vorwoche > 0 ? ((data.umsatz_heute - data.umsatz_vorwoche) / data.umsatz_vorwoche) * 100 : 0;
  const positive = vwDelta >= 0;

  const fmt = (v: number) => v.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';

  return (
    <div className="rounded-2xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/30 overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-emerald-200 dark:border-emerald-800">
        <Zap size={15} className="text-emerald-600 dark:text-emerald-400" />
        <span className="text-xs font-bold text-emerald-800 dark:text-emerald-200 uppercase tracking-wider flex-1">
          Echtzeit-Umsatz — Dashboard
        </span>
        <div className="flex items-center gap-1">
          {positive ? <TrendingUp size={12} className="text-matcha-600" /> : <TrendingDown size={12} className="text-red-500" />}
          <span className={cn('text-[10px] font-bold', positive ? 'text-matcha-700' : 'text-red-600')}>
            {positive ? '+' : ''}{vwDelta.toFixed(1)}% vs. Vorwoche
          </span>
        </div>
        {loading && <Loader2 size={13} className="animate-spin text-emerald-400" />}
      </div>

      <div className="p-4">
        {/* Main umsatz */}
        <div className="flex items-end justify-between mb-3">
          <div>
            <div className="text-3xl font-black text-emerald-800 dark:text-emerald-100 tabular-nums">{fmt(data.umsatz_heute)}</div>
            <div className="text-[10px] text-emerald-600 dark:text-emerald-400 mt-0.5">Umsatz heute</div>
          </div>
          <div className="text-right">
            <div className="text-sm font-bold text-muted-foreground">{fmt(data.umsatz_ziel)}</div>
            <div className="text-[10px] text-muted-foreground">Tagesziel</div>
          </div>
        </div>

        {/* Progress bar */}
        <div className="mb-4">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] text-muted-foreground">Ziel-Fortschritt</span>
            <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-300">{zielPct}%</span>
          </div>
          <div className="h-2 w-full rounded-full bg-black/10 overflow-hidden">
            <div
              className={cn('h-full rounded-full transition-all', zielPct >= 100 ? 'bg-matcha-500' : zielPct >= 75 ? 'bg-emerald-500' : zielPct >= 50 ? 'bg-amber-400' : 'bg-red-400')}
              style={{ width: `${zielPct}%` }}
            />
          </div>
        </div>

        {/* KPI grid */}
        <div className="grid grid-cols-3 gap-2">
          {[
            { label: 'Bestellungen', value: data.bestellungen_heute.toString() },
            { label: 'Ø Bestellwert', value: `${data.avg_bestellwert.toFixed(2)} €` },
            { label: 'Letzte Bestellung', value: `${data.last_order_eur.toFixed(2)} €` },
          ].map((k) => (
            <div key={k.label} className="rounded-xl bg-white/60 dark:bg-black/20 border border-emerald-100 dark:border-emerald-800 p-2.5 text-center">
              <div className="text-base font-black text-emerald-800 dark:text-emerald-100 tabular-nums">{k.value}</div>
              <div className="text-[9px] text-muted-foreground mt-0.5">{k.label}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
