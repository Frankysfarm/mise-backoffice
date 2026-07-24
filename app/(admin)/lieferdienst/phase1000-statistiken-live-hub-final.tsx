'use client';

import { useEffect, useState, useCallback } from 'react';
import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { TrendingUp, TrendingDown, Minus, AlertTriangle, ChevronDown, ChevronUp, Activity } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Phase 1000 — Statistiken Live Hub Final
 * 8 KPI-Kacheln (Bestellungen/Umsatz/Lieferzeit/Pünktlichkeit/Bewertung/Fahrer/SLA/Storno)
 * Ampel-Farbkodierung; Trend-Pfeile vs. Vortag; Stundenverlauf-BarChart 2-Modi;
 * Alert-Strip; Zonen-Top-3; 3-Min-Polling
 */

interface KpiData {
  bestellungen: number;
  bestellungen_trend: number;
  umsatz_eur: number;
  umsatz_trend: number;
  avg_lieferzeit_min: number;
  lieferzeit_trend: number;
  pünktlichkeit_pct: number;
  pünktlichkeit_trend: number;
  bewertung: number;
  bewertung_trend: number;
  aktive_fahrer: number;
  sla_rate_pct: number;
  storno_pct: number;
  storno_trend: number;
}

interface StundenBucket {
  stunde: string;
  bestellungen: number;
  umsatz_eur: number;
}

interface Zone {
  name: string;
  bestellungen: number;
  avg_lieferzeit_min: number;
}

interface ApiResponse {
  kpis: KpiData;
  stunden: StundenBucket[];
  zonen: Zone[];
  location_id: string;
  aktualisiert_um: string;
}

const MOCK: ApiResponse = {
  kpis: {
    bestellungen: 47, bestellungen_trend: 12,
    umsatz_eur: 1287.50, umsatz_trend: 8,
    avg_lieferzeit_min: 28, lieferzeit_trend: -3,
    pünktlichkeit_pct: 84, pünktlichkeit_trend: 5,
    bewertung: 4.7, bewertung_trend: 0.1,
    aktive_fahrer: 4,
    sla_rate_pct: 91, storno_pct: 2.1, storno_trend: -0.5,
  },
  stunden: [
    { stunde: '11', bestellungen: 3, umsatz_eur: 89 },
    { stunde: '12', bestellungen: 8, umsatz_eur: 213 },
    { stunde: '13', bestellungen: 11, umsatz_eur: 302 },
    { stunde: '14', bestellungen: 6, umsatz_eur: 155 },
    { stunde: '15', bestellungen: 4, umsatz_eur: 102 },
    { stunde: '16', bestellungen: 5, umsatz_eur: 132 },
    { stunde: '17', bestellungen: 10, umsatz_eur: 295 },
  ],
  zonen: [
    { name: 'Mitte', bestellungen: 18, avg_lieferzeit_min: 24 },
    { name: 'Nord', bestellungen: 14, avg_lieferzeit_min: 31 },
    { name: 'Ost', bestellungen: 15, avg_lieferzeit_min: 28 },
  ],
  location_id: 'mock',
  aktualisiert_um: new Date().toISOString(),
};

function fmtEur(n: number) {
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(n);
}

function TrendIcon({ val, invertGood }: { val: number; invertGood?: boolean }) {
  const positive = invertGood ? val < 0 : val > 0;
  const neutral = Math.abs(val) < 0.1;
  if (neutral) return <Minus className="w-3 h-3 text-stone-400" />;
  return positive
    ? <TrendingUp className="w-3 h-3 text-emerald-500" />
    : <TrendingDown className="w-3 h-3 text-red-500" />;
}

type AmpelColor = 'gruen' | 'gelb' | 'rot';

interface KpiCard {
  label: string;
  value: string;
  trend: number;
  invertGood?: boolean;
  ampel: AmpelColor;
}

const AMPEL_STYLE: Record<AmpelColor, { bg: string; border: string; text: string }> = {
  gruen: { bg: 'bg-emerald-50', border: 'border-emerald-100', text: 'text-emerald-700' },
  gelb:  { bg: 'bg-yellow-50',  border: 'border-yellow-100',  text: 'text-yellow-700'  },
  rot:   { bg: 'bg-red-50',     border: 'border-red-100',     text: 'text-red-700'     },
};

export function LieferdienstPhase1000StatistikenLiveHubFinal({ locationId }: { locationId?: string | null }) {
  const [open, setOpen] = useState(true);
  const [data, setData] = useState<ApiResponse>(MOCK);
  const [chartMode, setChartMode] = useState<'bestellungen' | 'umsatz'>('bestellungen');

  const load = useCallback(async () => {
    if (!locationId) return;
    try {
      const r = await fetch(`/api/delivery/lieferdienst/statistiken-live-hub?location_id=${locationId}`, { cache: 'no-store' });
      if (r.ok) setData(await r.json());
    } catch {}
  }, [locationId]);

  useEffect(() => {
    load();
    const id = setInterval(load, 3 * 60_000);
    return () => clearInterval(id);
  }, [load]);

  const { kpis } = data;

  const cards: KpiCard[] = [
    { label: 'Bestellungen', value: `${kpis.bestellungen}`, trend: kpis.bestellungen_trend, ampel: kpis.bestellungen >= 30 ? 'gruen' : 'gelb' },
    { label: 'Umsatz', value: fmtEur(kpis.umsatz_eur), trend: kpis.umsatz_trend, ampel: kpis.umsatz_eur >= 800 ? 'gruen' : 'gelb' },
    { label: 'Ø Lieferzeit', value: `${kpis.avg_lieferzeit_min}min`, trend: kpis.lieferzeit_trend, invertGood: true, ampel: kpis.avg_lieferzeit_min <= 30 ? 'gruen' : kpis.avg_lieferzeit_min <= 40 ? 'gelb' : 'rot' },
    { label: 'Pünktlichkeit', value: `${kpis.pünktlichkeit_pct}%`, trend: kpis.pünktlichkeit_trend, ampel: kpis.pünktlichkeit_pct >= 85 ? 'gruen' : kpis.pünktlichkeit_pct >= 70 ? 'gelb' : 'rot' },
    { label: 'Bewertung', value: `★ ${kpis.bewertung.toFixed(1)}`, trend: kpis.bewertung_trend, ampel: kpis.bewertung >= 4.5 ? 'gruen' : kpis.bewertung >= 4.0 ? 'gelb' : 'rot' },
    { label: 'Aktive Fahrer', value: `${kpis.aktive_fahrer}`, trend: 0, ampel: kpis.aktive_fahrer >= 3 ? 'gruen' : kpis.aktive_fahrer >= 2 ? 'gelb' : 'rot' },
    { label: 'SLA-Rate', value: `${kpis.sla_rate_pct}%`, trend: 0, ampel: kpis.sla_rate_pct >= 90 ? 'gruen' : kpis.sla_rate_pct >= 75 ? 'gelb' : 'rot' },
    { label: 'Storno-Quote', value: `${kpis.storno_pct.toFixed(1)}%`, trend: kpis.storno_trend, invertGood: true, ampel: kpis.storno_pct <= 3 ? 'gruen' : kpis.storno_pct <= 6 ? 'gelb' : 'rot' },
  ];

  const alerts: string[] = [];
  if (kpis.avg_lieferzeit_min > 40) alerts.push(`Ø Lieferzeit ${kpis.avg_lieferzeit_min}min — Kapazität prüfen`);
  if (kpis.pünktlichkeit_pct < 70) alerts.push(`Pünktlichkeit nur ${kpis.pünktlichkeit_pct}% — SLA gefährdet`);
  if (kpis.storno_pct > 6) alerts.push(`Storno-Quote ${kpis.storno_pct.toFixed(1)}% kritisch`);

  const nowH = new Date().getHours();

  return (
    <div className="rounded-xl border border-stone-200 bg-white shadow-sm mb-2">
      <button className="w-full flex items-center justify-between px-4 py-3 text-left" onClick={() => setOpen(o => !o)}>
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-blue-600" />
          <span className="text-sm font-bold text-char">Statistiken Live Hub</span>
          {alerts.length > 0 && (
            <span className="px-1.5 py-0.5 rounded bg-red-100 text-red-700 text-[10px] font-bold flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" />{alerts.length} Alert{alerts.length > 1 ? 's' : ''}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-stone-400">{kpis.bestellungen} Bestellungen heute</span>
          {open ? <ChevronUp className="w-4 h-4 text-stone-400" /> : <ChevronDown className="w-4 h-4 text-stone-400" />}
        </div>
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-4 border-t border-stone-100 pt-3">
          {/* Alert-Strip */}
          {alerts.length > 0 && (
            <div className="space-y-1.5">
              {alerts.map((a, i) => (
                <div key={i} className="flex items-center gap-2 text-xs text-red-700 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                  {a}
                </div>
              ))}
            </div>
          )}

          {/* KPI-Grid */}
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {cards.map(c => {
              const s = AMPEL_STYLE[c.ampel];
              return (
                <div key={c.label} className={cn('rounded-lg border p-2.5', s.bg, s.border)}>
                  <div className={cn('text-base font-black tabular-nums', s.text)}>{c.value}</div>
                  <div className="flex items-center gap-1 mt-0.5">
                    <span className="text-[10px] text-stone-500 flex-1">{c.label}</span>
                    <TrendIcon val={c.trend} invertGood={c.invertGood} />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Stundenverlauf-Chart */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-stone-500">Stundenverlauf</span>
              <div className="flex gap-1">
                {(['bestellungen', 'umsatz'] as const).map(m => (
                  <button key={m} onClick={() => setChartMode(m)}
                    className={cn('text-[10px] font-semibold px-2 py-0.5 rounded transition-colors',
                      chartMode === m ? 'bg-blue-600 text-white' : 'bg-stone-100 text-stone-500')}>
                    {m === 'bestellungen' ? 'Bestellungen' : 'Umsatz'}
                  </button>
                ))}
              </div>
            </div>
            <div className="h-32">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.stunden} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
                  <XAxis dataKey="stunde" tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                  <Tooltip
                    formatter={(v: number) => chartMode === 'umsatz' ? fmtEur(v) : `${v} Bestellungen`}
                    contentStyle={{ fontSize: 11, borderRadius: 8 }}
                  />
                  <Bar dataKey={chartMode === 'bestellungen' ? 'bestellungen' : 'umsatz_eur'} radius={[4, 4, 0, 0]}>
                    {data.stunden.map((b, i) => (
                      <Cell key={i} fill={parseInt(b.stunde) === nowH ? '#3b82f6' : '#93c5fd'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Zonen-Ranking */}
          {data.zonen.length > 0 && (
            <div>
              <div className="text-[10px] font-semibold text-stone-400 uppercase tracking-wide mb-2">Top Zonen</div>
              <div className="space-y-1.5">
                {data.zonen.sort((a, b) => b.bestellungen - a.bestellungen).map((z, i) => (
                  <div key={z.name} className="flex items-center gap-2">
                    <span className="text-[10px] text-stone-400 w-4 shrink-0">{i + 1}.</span>
                    <span className="text-xs font-semibold text-char flex-1">{z.name}</span>
                    <span className="text-[11px] text-stone-500">{z.bestellungen} Bestellungen</span>
                    <span className="text-[11px] text-stone-400">{z.avg_lieferzeit_min}min Ø</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
