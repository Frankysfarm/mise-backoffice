'use client';

import { useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { cn } from '@/lib/utils';
import { BarChart3, TrendingUp, Clock, Users, Euro, Package, Star, ChevronDown, ChevronUp } from 'lucide-react';

interface Props {
  locationId: string;
}

interface StatData {
  bestellungenHeute: number;
  bestellungenGestern: number;
  umsatzHeute: number;
  umsatzGestern: number;
  durchschnittlEta: number;
  onTimeRate: number;
  aktiveFahrer: number;
  stornoquote: number;
  bewertungDurchschnitt: number;
  bewertungAnzahl: number;
  stundenVerlauf: { stunde: string; bestellungen: number; umsatz: number }[];
}

const MOCK: StatData = {
  bestellungenHeute: 47,
  bestellungenGestern: 43,
  umsatzHeute: 1248.5,
  umsatzGestern: 1089.2,
  durchschnittlEta: 32,
  onTimeRate: 0.82,
  aktiveFahrer: 4,
  stornoquote: 0.06,
  bewertungDurchschnitt: 4.7,
  bewertungAnzahl: 38,
  stundenVerlauf: [
    { stunde: '11', bestellungen: 3, umsatz: 82.5 },
    { stunde: '12', bestellungen: 8, umsatz: 212.0 },
    { stunde: '13', bestellungen: 11, umsatz: 298.3 },
    { stunde: '14', bestellungen: 6, umsatz: 159.0 },
    { stunde: '15', bestellungen: 4, umsatz: 106.5 },
    { stunde: '16', bestellungen: 5, umsatz: 132.7 },
    { stunde: '17', bestellungen: 10, umsatz: 257.5 },
  ],
};

function fmtEur(v: number) {
  return v.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
}

function delta(today: number, yesterday: number): { sign: string; pct: number; up: boolean } {
  if (yesterday === 0) return { sign: '+', pct: 100, up: true };
  const pct = Math.round(((today - yesterday) / yesterday) * 100);
  return { sign: pct >= 0 ? '+' : '', pct, up: pct >= 0 };
}

export function StatistikLiveHub({ locationId }: Props) {
  const [data, setData] = useState<StatData | null>(null);
  const [expanded, setExpanded] = useState(true);

  const load = async () => {
    try {
      const res = await fetch(
        `/api/delivery/stats?location_id=${locationId}&action=live_stats`,
        { cache: 'no-store' },
      );
      if (!res.ok) throw new Error();
      const json = await res.json();
      if (json.stats) { setData(json.stats); return; }
    } catch { /* noop */ }
    setData(MOCK);
  };

  useEffect(() => {
    load();
    const iv = setInterval(load, 120_000);
    return () => clearInterval(iv);
  }, [locationId]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!data) return null;

  const bestellDelta = delta(data.bestellungenHeute, data.bestellungenGestern);
  const umsatzDelta = delta(data.umsatzHeute, data.umsatzGestern);
  const maxBestellungen = Math.max(...data.stundenVerlauf.map((s) => s.bestellungen), 1);

  const kpis = [
    {
      label: 'Bestellungen',
      value: data.bestellungenHeute.toString(),
      sub: `${bestellDelta.sign}${bestellDelta.pct}% vs. gestern`,
      icon: Package,
      iconBg: 'bg-blue-100',
      iconText: 'text-blue-600',
      up: bestellDelta.up,
    },
    {
      label: 'Umsatz',
      value: fmtEur(data.umsatzHeute),
      sub: `${umsatzDelta.sign}${umsatzDelta.pct}% vs. gestern`,
      icon: Euro,
      iconBg: 'bg-matcha-100',
      iconText: 'text-matcha-600',
      up: umsatzDelta.up,
    },
    {
      label: 'Ø ETA',
      value: `${data.durchschnittlEta} Min`,
      sub: `${Math.round(data.onTimeRate * 100)}% pünktlich`,
      icon: Clock,
      iconBg: 'bg-amber-100',
      iconText: 'text-amber-600',
      up: data.onTimeRate >= 0.8,
    },
    {
      label: 'Bewertung',
      value: data.bewertungDurchschnitt.toFixed(1),
      sub: `${data.bewertungAnzahl} Bewertungen`,
      icon: Star,
      iconBg: 'bg-yellow-100',
      iconText: 'text-yellow-600',
      up: data.bewertungDurchschnitt >= 4.5,
    },
    {
      label: 'Aktive Fahrer',
      value: data.aktiveFahrer.toString(),
      sub: `Storno ${(data.stornoquote * 100).toFixed(1)}%`,
      icon: Users,
      iconBg: 'bg-purple-100',
      iconText: 'text-purple-600',
      up: data.stornoquote < 0.08,
    },
  ];

  return (
    <div className="rounded-2xl border border-stone-200 bg-white overflow-hidden">
      <button
        className="w-full flex items-center gap-3 px-5 py-4 border-b border-stone-100 hover:bg-stone-50 transition-colors"
        onClick={() => setExpanded((v) => !v)}
      >
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-matcha-100 text-matcha-700 shrink-0">
          <BarChart3 className="h-4 w-4" />
        </div>
        <div className="flex-1 text-left">
          <div className="text-sm font-bold text-stone-800">Statistik Live-Hub</div>
          <div className="text-[11px] text-stone-400">
            {data.bestellungenHeute} Bestellungen · {fmtEur(data.umsatzHeute)} heute
          </div>
        </div>
        {expanded ? <ChevronUp className="h-4 w-4 text-stone-400" /> : <ChevronDown className="h-4 w-4 text-stone-400" />}
      </button>

      {expanded && (
        <div className="p-4 space-y-4">
          {/* KPI Grid */}
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {kpis.map((kpi) => (
              <div key={kpi.label} className="rounded-xl bg-stone-50 p-3 flex gap-3 items-start">
                <div className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-lg mt-0.5', kpi.iconBg)}>
                  <kpi.icon className={cn('h-4 w-4', kpi.iconText)} />
                </div>
                <div className="min-w-0">
                  <div className="text-[10px] text-stone-400 font-semibold uppercase tracking-wide">{kpi.label}</div>
                  <div className="text-base font-black text-stone-800 tabular-nums leading-tight">{kpi.value}</div>
                  <div className={cn('text-[10px] font-medium', kpi.up ? 'text-matcha-600' : 'text-red-500')}>{kpi.sub}</div>
                </div>
              </div>
            ))}
          </div>

          {/* Stundenverlauf Chart */}
          {data.stundenVerlauf.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp className="h-3.5 w-3.5 text-matcha-600" />
                <span className="text-[11px] font-bold uppercase tracking-wider text-stone-500">
                  Bestellungen nach Stunde
                </span>
              </div>
              <ResponsiveContainer width="100%" height={80}>
                <BarChart data={data.stundenVerlauf} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                  <XAxis dataKey="stunde" tick={{ fontSize: 9, fill: '#78716c' }} axisLine={false} tickLine={false} />
                  <Tooltip
                    contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid #e7e5e4' }}
                    formatter={(val: number) => [val, 'Bestellungen']}
                  />
                  <Bar dataKey="bestellungen" radius={[3, 3, 0, 0]} maxBarSize={20}>
                    {data.stundenVerlauf.map((entry, idx) => (
                      <Cell
                        key={idx}
                        fill={entry.bestellungen === maxBestellungen ? '#4ade80' : '#d1fae5'}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
