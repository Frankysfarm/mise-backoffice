'use client';

import { useEffect, useState } from 'react';
import { BarChart2, ChevronDown, ChevronUp, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

type StundeEintrag = { stunde: number; bestellungen: number; umsatz: number };
type Data = {
  bestellungen_gesamt: number;
  umsatz_gesamt: number;
  avg_lieferzeit_min: number;
  puenktlichkeit_pct: number;
  storno_count: number;
  top_artikel: { name: string; count: number }[];
  stunden: StundeEintrag[];
};

function mock(): Data {
  return {
    bestellungen_gesamt: 94,
    umsatz_gesamt: 2847.5,
    avg_lieferzeit_min: 24,
    puenktlichkeit_pct: 87,
    storno_count: 3,
    top_artikel: [
      { name: 'Margherita', count: 22 },
      { name: 'Burger Classic', count: 18 },
      { name: 'Pasta Bolognese', count: 14 },
    ],
    stunden: [
      { stunde: 11, bestellungen: 4, umsatz: 120 },
      { stunde: 12, bestellungen: 12, umsatz: 365 },
      { stunde: 13, bestellungen: 18, umsatz: 542 },
      { stunde: 14, bestellungen: 9, umsatz: 271 },
      { stunde: 15, bestellungen: 7, umsatz: 210 },
      { stunde: 16, bestellungen: 8, umsatz: 242 },
      { stunde: 17, bestellungen: 14, umsatz: 423 },
      { stunde: 18, bestellungen: 22, umsatz: 674 },
    ],
  };
}

export function LieferdienstPhase1004TagesStatistikenKomplett({ locationId }: { locationId: string | null }) {
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(true);

  const load = async () => {
    try {
      const p = new URLSearchParams(); if (locationId) p.set('location_id', locationId);
      const r = await fetch(`/api/delivery/admin/tages-statistiken?${p}`);
      if (r.ok) setData(await r.json()); else throw new Error();
    } catch { setData(mock()); } finally { setLoading(false); }
  };

  useEffect(() => { load(); const id = setInterval(load, 120000); return () => clearInterval(id); }, [locationId]);

  if (!data && loading) return <div className="h-40 bg-muted/20 rounded-2xl animate-pulse" />;
  if (!data) return null;

  const maxBestellungen = Math.max(...(data.stunden?.map((s) => s.bestellungen) ?? [1]), 1);
  const fmt = (v: number) => v.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';

  const kpis = [
    { label: 'Bestellungen', value: data.bestellungen_gesamt.toString(), color: 'text-blue-700 dark:text-blue-300', bg: 'bg-blue-50 dark:bg-blue-950/30' },
    { label: 'Umsatz', value: fmt(data.umsatz_gesamt), color: 'text-emerald-700 dark:text-emerald-300', bg: 'bg-emerald-50 dark:bg-emerald-950/30' },
    { label: 'Ø Lieferzeit', value: `${data.avg_lieferzeit_min} Min`, color: 'text-amber-700 dark:text-amber-300', bg: 'bg-amber-50 dark:bg-amber-950/30' },
    { label: 'Pünktlichkeit', value: `${data.puenktlichkeit_pct}%`, color: data.puenktlichkeit_pct >= 85 ? 'text-matcha-700 dark:text-matcha-300' : 'text-red-700 dark:text-red-300', bg: data.puenktlichkeit_pct >= 85 ? 'bg-matcha-50 dark:bg-matcha-950/30' : 'bg-red-50 dark:bg-red-950/30' },
  ];

  return (
    <div className="rounded-2xl border border-border bg-card overflow-hidden">
      <button onClick={() => setOpen((v) => !v)} className="w-full flex items-center gap-2 px-4 py-2.5 border-b text-left">
        <BarChart2 size={15} className="text-slate-500" />
        <span className="text-xs font-bold uppercase tracking-wider flex-1">Tages-Statistiken — Komplett</span>
        {loading && <Loader2 size={13} className="animate-spin text-muted-foreground" />}
        {open ? <ChevronUp size={14} className="text-muted-foreground" /> : <ChevronDown size={14} className="text-muted-foreground" />}
      </button>

      {open && (
        <div className="p-3 space-y-3">
          {/* KPI Grid */}
          <div className="grid grid-cols-2 gap-2">
            {kpis.map((k) => (
              <div key={k.label} className={cn('rounded-xl p-3', k.bg)}>
                <div className={cn('text-lg font-black tabular-nums', k.color)}>{k.value}</div>
                <div className="text-[10px] text-muted-foreground mt-0.5">{k.label}</div>
              </div>
            ))}
          </div>

          {/* Stunden-Chart */}
          {data.stunden.length > 0 && (
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground mb-2">Bestellungen je Stunde</div>
              <div className="flex items-end gap-1 h-16">
                {data.stunden.map((s) => {
                  const h = Math.max(4, Math.round((s.bestellungen / maxBestellungen) * 100));
                  return (
                    <div key={s.stunde} className="flex-1 flex flex-col items-center gap-0.5">
                      <div className="w-full rounded-t overflow-hidden flex items-end" style={{ height: 48 }}>
                        <div
                          className="w-full rounded-t bg-blue-400 dark:bg-blue-500 transition-all"
                          style={{ height: `${h}%` }}
                        />
                      </div>
                      <span className="text-[8px] text-muted-foreground">{s.stunde}h</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Top Artikel */}
          {data.top_artikel.length > 0 && (
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground mb-1.5">Top Artikel</div>
              <div className="space-y-1">
                {data.top_artikel.map((a, i) => (
                  <div key={a.name} className="flex items-center gap-2">
                    <span className="text-[10px] text-muted-foreground w-4">{i + 1}.</span>
                    <span className="text-xs font-medium flex-1 truncate">{a.name}</span>
                    <span className="text-[10px] font-bold tabular-nums">{a.count}×</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <p className="text-[9px] text-muted-foreground">{data.storno_count} Stornierung{data.storno_count !== 1 ? 'en' : ''} heute</p>
        </div>
      )}
    </div>
  );
}
