'use client';

import { useState, useEffect, useCallback } from 'react';
import { TrendingUp, TrendingDown, Package, Clock, Star, Euro, Route, Users, BarChart3, Target } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

/**
 * Phase 4000 — Statistiken-Dashboard
 * Schicht-KPIs, Tages-/Wochenvergleich, Top-Fahrer, Zonen-Ertrag;
 * 30-Sek-Polling; Mock-Fallback.
 */

interface KpiKarte {
  label: string;
  wert: string;
  delta: number | null;
  einheit: string;
  ziel?: string;
  gut: boolean;
}

interface TopFahrer {
  id: string;
  name: string;
  touren: number;
  bewertung: number;
  umsatz: number;
  puenktlichkeit: number;
}

interface ZoneKpi {
  zone: string;
  bestellungen: number;
  umsatz: number;
  avg_lieferzeit: number;
}

interface DashboardData {
  kpis: KpiKarte[];
  top_fahrer: TopFahrer[];
  zonen: ZoneKpi[];
  schicht_fortschritt: number;
  schicht_ziel: number;
  aktualisiert: string;
}

const MOCK: DashboardData = {
  kpis: [
    { label: 'Bestellungen heute',  wert: '47',      delta: 8,    einheit: '',    ziel: 'Ziel: 60',  gut: true },
    { label: 'Umsatz (Schicht)',     wert: '1.284',   delta: 12,   einheit: '€',   ziel: 'Ziel: 1.500€', gut: true },
    { label: 'Ø Lieferzeit',         wert: '26',      delta: -3,   einheit: 'Min', ziel: 'Ziel: ≤30', gut: true },
    { label: 'Pünktlichkeitsrate',   wert: '87',      delta: 2,    einheit: '%',   ziel: 'Ziel: ≥90%', gut: false },
    { label: 'Aktive Fahrer',        wert: '5',       delta: null, einheit: '',    gut: true },
    { label: 'Storno-Rate',          wert: '3.2',     delta: -0.8, einheit: '%',   ziel: 'Ziel: ≤5%', gut: true },
    { label: 'Ø Bewertung',          wert: '4.6',     delta: 0.1,  einheit: '★',   ziel: 'Ziel: ≥4.5', gut: true },
    { label: 'Touren gesamt',        wert: '18',      delta: 4,    einheit: '',    gut: true },
  ],
  top_fahrer: [
    { id: 'f1', name: 'Max K.',    touren: 6,  bewertung: 4.9, umsatz: 312, puenktlichkeit: 96 },
    { id: 'f2', name: 'Tim R.',    touren: 5,  bewertung: 4.8, umsatz: 268, puenktlichkeit: 91 },
    { id: 'f3', name: 'Sara M.',   touren: 4,  bewertung: 4.7, umsatz: 224, puenktlichkeit: 85 },
    { id: 'f4', name: 'Jonas B.',  touren: 3,  bewertung: 4.2, umsatz: 180, puenktlichkeit: 68 },
  ],
  zonen: [
    { zone: 'Mitte',     bestellungen: 18, umsatz: 486, avg_lieferzeit: 23 },
    { zone: 'Nord',      bestellungen: 12, umsatz: 324, avg_lieferzeit: 28 },
    { zone: 'West',      bestellungen: 10, umsatz: 270, avg_lieferzeit: 31 },
    { zone: 'Ost',       bestellungen:  7, umsatz: 204, avg_lieferzeit: 26 },
  ],
  schicht_fortschritt: 47,
  schicht_ziel: 60,
  aktualisiert: new Date().toLocaleTimeString('de-DE'),
};

export function LieferdienstStatistikenDashboard({ locationId }: { locationId?: string | null }) {
  const [data, setData] = useState<DashboardData>(MOCK);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!locationId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/delivery/stats?location_id=${locationId}&scope=shift`);
      if (res.ok) {
        const d = await res.json();
        if (d?.kpis) setData(d);
      }
    } catch { /* Mock-Fallback */ }
    setLoading(false);
  }, [locationId]);

  useEffect(() => { load(); const id = setInterval(load, 30000); return () => clearInterval(id); }, [load]);

  const maxUmsatz = Math.max(...data.zonen.map(z => z.umsatz), 1);
  const maxBestellungen = Math.max(...data.zonen.map(z => z.bestellungen), 1);
  const schichtPct = Math.min(100, Math.round((data.schicht_fortschritt / data.schicht_ziel) * 100));

  return (
    <div className="space-y-4">
      {/* Schicht-Fortschritt Header */}
      <div className="rounded-xl border border-matcha-200 bg-matcha-50 dark:bg-matcha-950/20 overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-2.5 bg-matcha-100/60 dark:bg-matcha-900/20">
          <BarChart3 className="h-4 w-4 text-matcha-700 dark:text-matcha-400 shrink-0" />
          <span className="font-display text-xs font-black uppercase tracking-wider text-foreground">Statistiken-Dashboard</span>
          {loading && <span className="ml-1 h-1.5 w-1.5 rounded-full bg-matcha-500 animate-pulse" />}
          <span className="ml-auto text-[10px] text-muted-foreground">Akt. {data.aktualisiert}</span>
        </div>
        <div className="px-4 py-3">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-bold text-foreground">Schicht-Ziel</span>
            <span className="text-xs font-black tabular-nums text-matcha-700 dark:text-matcha-400">{data.schicht_fortschritt} / {data.schicht_ziel} Bestellungen</span>
          </div>
          <div className="h-3 w-full rounded-full bg-matcha-200 dark:bg-matcha-800 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-700 ${schichtPct >= 90 ? 'bg-emerald-500' : schichtPct >= 70 ? 'bg-matcha-500' : 'bg-amber-400'}`}
              style={{ width: `${schichtPct}%` }}
            />
          </div>
          <div className="flex justify-between mt-0.5 text-[9px] text-muted-foreground">
            <span>{schichtPct}% erreicht</span>
            <span>Noch {data.schicht_ziel - data.schicht_fortschritt} fehlen</span>
          </div>
        </div>
      </div>

      {/* KPI-Grid */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {data.kpis.map(kpi => (
          <div key={kpi.label} className={`rounded-xl border p-3 ${kpi.gut ? 'border-matcha-200 bg-matcha-50 dark:bg-matcha-950/20' : 'border-amber-200 bg-amber-50 dark:bg-amber-950/20'}`}>
            <div className="text-[9px] uppercase tracking-wide text-muted-foreground mb-1">{kpi.label}</div>
            <div className="flex items-end gap-1">
              <span className={`font-display text-lg font-black tabular-nums leading-none ${kpi.gut ? 'text-matcha-700 dark:text-matcha-400' : 'text-amber-700 dark:text-amber-400'}`}>
                {kpi.wert}
              </span>
              <span className="text-[10px] text-muted-foreground mb-0.5">{kpi.einheit}</span>
            </div>
            {kpi.delta !== null && (
              <div className={`flex items-center gap-0.5 text-[9px] font-bold mt-0.5 ${kpi.delta > 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                {kpi.delta > 0 ? <TrendingUp className="h-2.5 w-2.5" /> : <TrendingDown className="h-2.5 w-2.5" />}
                {kpi.delta > 0 ? '+' : ''}{kpi.delta}{kpi.einheit}
              </div>
            )}
            {kpi.ziel && <div className="text-[8px] text-muted-foreground mt-0.5">{kpi.ziel}</div>}
          </div>
        ))}
      </div>

      {/* Top-Fahrer */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-2 border-b bg-muted/30">
          <Users className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Top Fahrer · Heute</span>
        </div>
        <div className="divide-y divide-slate-100 dark:divide-slate-800">
          {data.top_fahrer.map((f, i) => (
            <div key={f.id} className="flex items-center gap-3 px-4 py-2.5">
              <div className={`shrink-0 rounded-full h-6 w-6 flex items-center justify-center text-[10px] font-black ${i === 0 ? 'bg-amber-400 text-amber-900' : i === 1 ? 'bg-slate-300 text-slate-700' : i === 2 ? 'bg-orange-300 text-orange-900' : 'bg-muted text-muted-foreground'}`}>
                {i + 1}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-bold text-foreground truncate">{f.name}</div>
                <div className="flex items-center gap-2 text-[9px] text-muted-foreground">
                  <span>{f.touren} Touren</span>
                  <span>★ {f.bewertung.toFixed(1)}</span>
                  <span className={f.puenktlichkeit >= 85 ? 'text-emerald-600' : 'text-amber-600'}>{f.puenktlichkeit}% pünktlich</span>
                </div>
              </div>
              <div className="shrink-0 text-right">
                <div className="text-xs font-black text-matcha-700 dark:text-matcha-400 tabular-nums">{f.umsatz} €</div>
                <div className="text-[9px] text-muted-foreground">Umsatz</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Zonen-Ertrag */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-2 border-b bg-muted/30">
          <Route className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Zonen-Ertrag · Schicht</span>
        </div>
        <div className="divide-y divide-slate-100 dark:divide-slate-800">
          {data.zonen.map(z => (
            <div key={z.zone} className="flex items-center gap-3 px-4 py-2.5">
              <div className="shrink-0 rounded-lg bg-muted px-2 py-0.5 text-[10px] font-bold text-muted-foreground min-w-[52px] text-center">
                {z.zone}
              </div>
              <div className="flex-1 min-w-0">
                {/* Umsatz-Balken */}
                <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden mb-0.5">
                  <div
                    className="h-full rounded-full bg-matcha-500 dark:bg-matcha-400 transition-all duration-700"
                    style={{ width: `${Math.round((z.umsatz / maxUmsatz) * 100)}%` }}
                  />
                </div>
                <div className="flex items-center gap-2 text-[9px] text-muted-foreground">
                  <span>{z.bestellungen} Bestellungen</span>
                  <span>Ø {z.avg_lieferzeit} Min Lieferzeit</span>
                </div>
              </div>
              <div className="shrink-0 text-right">
                <div className="text-xs font-black tabular-nums text-matcha-700 dark:text-matcha-400">{z.umsatz} €</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
