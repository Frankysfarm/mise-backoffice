'use client';
import { useEffect, useState } from 'react';
import { BarChart, Bar, Cell, XAxis, Tooltip, ResponsiveContainer, LineChart, Line, YAxis } from 'recharts';
import { TrendingUp, TrendingDown, Euro, Clock, Star, Package, Bike, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';

interface KpiKarte {
  label: string;
  wert: string;
  einheit: string;
  trend: number;
  ziel: string;
  status: 'gut' | 'ok' | 'kritisch';
}

interface StundenDaten {
  stunde: string;
  bestellungen: number;
  umsatz: number;
}

interface ApiData {
  kpis: KpiKarte[];
  stunden_verlauf: StundenDaten[];
  aktuell: {
    aktive_fahrer: number;
    offene_bestellungen: number;
    ø_lieferzeit_min: number;
    tages_umsatz_eur: number;
  };
}

const MOCK: ApiData = {
  kpis: [
    { label: 'Lieferzeit Ø', wert: '28', einheit: 'min', trend: -3, ziel: '≤30 min', status: 'gut' },
    { label: 'Pünktlichkeit', wert: '87', einheit: '%', trend: 2, ziel: '≥90%', status: 'ok' },
    { label: 'Tagesumsatz', wert: '1.248', einheit: '€', trend: 12, ziel: '≥1.500€', status: 'ok' },
    { label: 'Kundenbewertung', wert: '4.6', einheit: '★', trend: 0, ziel: '≥4.5★', status: 'gut' },
    { label: 'Storno-Quote', wert: '3.2', einheit: '%', trend: -0.5, ziel: '≤5%', status: 'gut' },
    { label: 'Auslastung', wert: '74', einheit: '%', trend: 8, ziel: '≥70%', status: 'gut' },
  ],
  stunden_verlauf: [
    { stunde: '11', bestellungen: 8, umsatz: 210 },
    { stunde: '12', bestellungen: 24, umsatz: 640 },
    { stunde: '13', bestellungen: 31, umsatz: 820 },
    { stunde: '14', bestellungen: 18, umsatz: 480 },
    { stunde: '15', bestellungen: 12, umsatz: 310 },
    { stunde: '16', bestellungen: 9, umsatz: 240 },
    { stunde: '17', bestellungen: 22, umsatz: 590 },
    { stunde: '18', bestellungen: 38, umsatz: 980 },
    { stunde: '19', bestellungen: 42, umsatz: 1120 },
    { stunde: '20', bestellungen: 29, umsatz: 760 },
  ],
  aktuell: {
    aktive_fahrer: 6,
    offene_bestellungen: 14,
    ø_lieferzeit_min: 28,
    tages_umsatz_eur: 1248,
  },
};

function TrendBadge({ trend, einheit }: { trend: number; einheit: string }) {
  if (trend === 0) return (
    <span className="flex items-center gap-0.5 text-[10px] text-gray-400">
      <Minus size={9} /> ±0
    </span>
  );
  const positive = trend > 0;
  return (
    <span className={cn('flex items-center gap-0.5 text-[10px] font-medium', positive ? 'text-green-600' : 'text-red-500')}>
      {positive ? <TrendingUp size={9} /> : <TrendingDown size={9} />}
      {positive ? '+' : ''}{trend}{einheit !== '%' && einheit !== '€' ? '' : einheit}
    </span>
  );
}

const STATUS_COLORS: Record<KpiKarte['status'], string> = {
  gut: 'border-green-200 bg-green-50',
  ok: 'border-amber-200 bg-amber-50',
  kritisch: 'border-red-200 bg-red-50',
};

const BAR_COLORS = ['#16a34a', '#22c55e', '#4ade80', '#86efac', '#bbf7d0', '#dcfce7', '#16a34a', '#22c55e', '#4ade80', '#86efac'];

export function SmartStatsCockpit({ locationId }: { locationId?: string | null }) {
  const [data, setData] = useState<ApiData | null>(null);
  const [tab, setTab] = useState<'bestellungen' | 'umsatz'>('bestellungen');

  useEffect(() => {
    const load = () =>
      fetch(`/api/delivery/admin/smart-stats?location_id=${locationId ?? ''}`)
        .then(r => r.json())
        .then((d: ApiData) => setData(d))
        .catch(() => setData(MOCK));

    if (!locationId) { setData(MOCK); return; }
    load();
    const iv = setInterval(load, 60_000);
    return () => clearInterval(iv);
  }, [locationId]);

  if (!data) return null;

  return (
    <div className="space-y-3">
      {/* Live Statusleiste */}
      <div className="grid grid-cols-4 gap-2">
        <div className="bg-matcha-50 border border-matcha-200 rounded-xl p-3 text-center">
          <Bike size={16} className="text-matcha-600 mx-auto mb-1" />
          <div className="text-xl font-black text-matcha-800">{data.aktuell.aktive_fahrer}</div>
          <div className="text-[10px] text-matcha-600">Aktive Fahrer</div>
        </div>
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-center">
          <Package size={16} className="text-blue-600 mx-auto mb-1" />
          <div className="text-xl font-black text-blue-800">{data.aktuell.offene_bestellungen}</div>
          <div className="text-[10px] text-blue-600">Offen</div>
        </div>
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-center">
          <Clock size={16} className="text-amber-600 mx-auto mb-1" />
          <div className="text-xl font-black text-amber-800">{data.aktuell.ø_lieferzeit_min}'</div>
          <div className="text-[10px] text-amber-600">Ø Lieferzeit</div>
        </div>
        <div className="bg-green-50 border border-green-200 rounded-xl p-3 text-center">
          <Euro size={16} className="text-green-600 mx-auto mb-1" />
          <div className="text-xl font-black text-green-800">{(data.aktuell.tages_umsatz_eur).toLocaleString('de-DE')}</div>
          <div className="text-[10px] text-green-600">Umsatz heute</div>
        </div>
      </div>

      {/* KPI-Grid */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-4 py-2.5 border-b border-gray-100">
          <h3 className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Heutige KPIs</h3>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 divide-x divide-y divide-gray-100">
          {data.kpis.map(kpi => (
            <div key={kpi.label} className={cn('p-3 border', STATUS_COLORS[kpi.status])}>
              <div className="flex items-start justify-between mb-1">
                <span className="text-[10px] text-gray-500 font-medium">{kpi.label}</span>
                <TrendBadge trend={kpi.trend} einheit={kpi.einheit} />
              </div>
              <div className="flex items-baseline gap-0.5">
                <span className={cn(
                  'text-2xl font-black tabular-nums',
                  kpi.status === 'gut' && 'text-green-700',
                  kpi.status === 'ok' && 'text-amber-700',
                  kpi.status === 'kritisch' && 'text-red-700',
                )}>{kpi.wert}</span>
                <span className="text-xs text-gray-500">{kpi.einheit}</span>
              </div>
              <div className="text-[9px] text-gray-400 mt-0.5">Ziel: {kpi.ziel}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Stunden-Verlauf Chart */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Tagesverlauf</h3>
          <div className="flex gap-1">
            {(['bestellungen', 'umsatz'] as const).map(t => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={cn(
                  'text-[10px] px-2 py-0.5 rounded-full transition-colors font-medium',
                  tab === t ? 'bg-matcha-600 text-white' : 'text-gray-500 hover:bg-gray-100'
                )}
              >
                {t === 'bestellungen' ? 'Bestellungen' : 'Umsatz €'}
              </button>
            ))}
          </div>
        </div>
        <div className="h-32">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data.stunden_verlauf} barSize={18}>
              <XAxis dataKey="stunde" tick={{ fontSize: 10, fill: '#6b7280' }} tickLine={false} axisLine={false} />
              <Tooltip
                contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid #e5e7eb', boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}
                labelFormatter={(l: string) => `${l}:00 Uhr`}
                formatter={(v: number) => tab === 'umsatz' ? [`${v} €`, 'Umsatz'] : [v, 'Bestellungen']}
              />
              <Bar dataKey={tab} radius={[3, 3, 0, 0]}>
                {data.stunden_verlauf.map((_, i) => (
                  <Cell key={i} fill={BAR_COLORS[i % BAR_COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
