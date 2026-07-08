'use client';

import { useEffect, useState } from 'react';
import { Trophy, TrendingUp, TrendingDown, Minus, Clock, Euro, Package, Star, BarChart2, ChevronDown, ChevronUp, Download } from 'lucide-react';
import { cn, euro } from '@/lib/utils';

interface Props {
  locationId: string | null;
}

interface SchichtAbschluss {
  schicht_datum: string;
  schicht_start: string;
  schicht_ende: string;
  dauer_h: number;
  umsatz: number;
  bestellungen: number;
  bestellungen_vortag: number;
  umsatz_vortag: number;
  durchschn_lieferzeit_min: number;
  on_time_rate: number;
  fahrer_aktiv: number;
  storno_rate: number;
  trinkgeld_gesamt: number;
  top_artikel: string;
  score: number;
}

const MOCK: SchichtAbschluss = {
  schicht_datum: new Date().toLocaleDateString('de-DE'),
  schicht_start: '10:00',
  schicht_ende: '22:00',
  dauer_h: 12,
  umsatz: 2840,
  bestellungen: 84,
  bestellungen_vortag: 76,
  umsatz_vortag: 2510,
  durchschn_lieferzeit_min: 32,
  on_time_rate: 89,
  fahrer_aktiv: 5,
  storno_rate: 4.2,
  trinkgeld_gesamt: 312,
  top_artikel: 'Lachs-Bowl',
  score: 88,
};

function TrendChip({ current, prev, format }: { current: number; prev: number; format?: (v: number) => string }) {
  const delta = current - prev;
  const pct = prev !== 0 ? Math.round((delta / prev) * 100) : 0;
  const fmt = format ?? ((v: number) => `${v > 0 ? '+' : ''}${v}`);
  if (pct === 0) return <span className="text-[9px] text-stone-400 flex items-center gap-0.5"><Minus className="h-2.5 w-2.5" /> Wie gestern</span>;
  if (pct > 0) return <span className="text-[9px] text-matcha-600 flex items-center gap-0.5"><TrendingUp className="h-2.5 w-2.5" />+{pct}% vs. gestern</span>;
  return <span className="text-[9px] text-red-500 flex items-center gap-0.5"><TrendingDown className="h-2.5 w-2.5" />{pct}% vs. gestern</span>;
}

export function LieferdienstPhase835SchichtAbschlussCockpit({ locationId }: Props) {
  const [data, setData] = useState<SchichtAbschluss | null>(null);
  const [expanded, setExpanded] = useState(true);

  const load = async () => {
    try {
      const params = new URLSearchParams();
      if (locationId) params.set('location_id', locationId);
      const res = await fetch(`/api/delivery/shifts?action=abschluss_cockpit&${params}`, { cache: 'no-store' });
      if (!res.ok) throw new Error();
      const json = await res.json();
      if (json.umsatz != null) { setData(json); return; }
    } catch { /* noop */ }
    setData(MOCK);
  };

  useEffect(() => {
    load();
    const iv = setInterval(load, 120_000);
    return () => clearInterval(iv);
  }, [locationId]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!data) return null;

  const scoreLabel = data.score >= 85 ? { text: 'Hervorragend', cls: 'bg-matcha-500' }
    : data.score >= 70 ? { text: 'Gut', cls: 'bg-amber-400' }
    : { text: 'Verbesserungspotenzial', cls: 'bg-red-500' };

  return (
    <div className="rounded-2xl border border-stone-200 bg-white overflow-hidden">
      <button
        className="w-full flex items-center gap-2 px-4 py-3 border-b bg-gradient-to-r from-stone-50 to-matcha-50 hover:from-stone-100 hover:to-matcha-100 transition-colors"
        onClick={() => setExpanded((v) => !v)}
      >
        <Trophy className="h-4 w-4 text-matcha-600" />
        <span className="text-sm font-bold text-stone-800">Schicht-Abschluss-Cockpit</span>
        <span className="text-[10px] text-stone-500 ml-1">{data.schicht_datum}</span>
        <span className={cn('ml-auto text-[10px] font-bold text-white rounded-full px-2 py-0.5', scoreLabel.cls)}>
          {scoreLabel.text} · {data.score}/100
        </span>
        {expanded ? <ChevronUp className="h-4 w-4 text-stone-400 ml-1" /> : <ChevronDown className="h-4 w-4 text-stone-400 ml-1" />}
      </button>

      {expanded && (
        <>
          {/* Score Bar */}
          <div className="px-4 pt-4 pb-2">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] text-stone-500">Schicht-Score</span>
              <span className="text-[10px] text-stone-400">{data.schicht_start} – {data.schicht_ende} · {data.dauer_h}h</span>
            </div>
            <div className="h-2.5 bg-stone-100 rounded-full overflow-hidden">
              <div
                className={cn('h-full rounded-full transition-all duration-700', scoreLabel.cls)}
                style={{ width: `${data.score}%` }}
              />
            </div>
          </div>

          {/* Haupt-KPIs */}
          <div className="grid grid-cols-2 gap-2 px-4 pb-4">
            {[
              {
                icon: Euro,
                label: 'Umsatz',
                value: euro(data.umsatz),
                sub: <TrendChip current={data.umsatz} prev={data.umsatz_vortag} />,
                highlight: true,
              },
              {
                icon: Package,
                label: 'Bestellungen',
                value: String(data.bestellungen),
                sub: <TrendChip current={data.bestellungen} prev={data.bestellungen_vortag} />,
                highlight: false,
              },
              {
                icon: Clock,
                label: 'Ø Lieferzeit',
                value: `${data.durchschn_lieferzeit_min} Min`,
                sub: <span className={cn('text-[9px]', data.durchschn_lieferzeit_min <= 35 ? 'text-matcha-600' : 'text-amber-600')}>{data.durchschn_lieferzeit_min <= 35 ? 'Im Ziel' : 'Über Ziel'}</span>,
                highlight: false,
              },
              {
                icon: Star,
                label: 'Pünktlichkeit',
                value: `${data.on_time_rate}%`,
                sub: <span className={cn('text-[9px]', data.on_time_rate >= 85 ? 'text-matcha-600' : 'text-amber-600')}>{data.on_time_rate >= 85 ? 'Ziel erreicht' : 'Ziel verfehlt'}</span>,
                highlight: false,
              },
            ].map((kpi) => {
              const Icon = kpi.icon;
              return (
                <div key={kpi.label} className={cn('rounded-xl border p-3', kpi.highlight ? 'bg-matcha-50 border-matcha-100' : 'bg-stone-50 border-stone-100')}>
                  <div className="flex items-center gap-1.5 mb-1">
                    <Icon className={cn('h-3.5 w-3.5', kpi.highlight ? 'text-matcha-600' : 'text-stone-400')} />
                    <span className="text-[9px] text-stone-500">{kpi.label}</span>
                  </div>
                  <div className={cn('text-xl font-black tabular-nums', kpi.highlight ? 'text-matcha-800' : 'text-stone-800')}>
                    {kpi.value}
                  </div>
                  <div className="mt-0.5">{kpi.sub}</div>
                </div>
              );
            })}
          </div>

          {/* Weitere Metriken */}
          <div className="border-t border-stone-100 px-4 py-3 grid grid-cols-3 gap-3">
            <div className="text-center">
              <div className="text-xs font-black text-stone-800">{data.fahrer_aktiv}</div>
              <div className="text-[9px] text-stone-400">Fahrer aktiv</div>
            </div>
            <div className="text-center">
              <div className="text-xs font-black text-stone-800">{data.storno_rate}%</div>
              <div className="text-[9px] text-stone-400">Storno-Rate</div>
            </div>
            <div className="text-center">
              <div className="text-xs font-black text-stone-800">{euro(data.trinkgeld_gesamt)}</div>
              <div className="text-[9px] text-stone-400">Trinkgeld</div>
            </div>
          </div>

          {/* Top-Artikel */}
          <div className="border-t border-stone-100 px-4 py-2.5 flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <BarChart2 className="h-3.5 w-3.5 text-stone-400" />
              <span className="text-[10px] text-stone-500">Top-Artikel: <strong className="text-stone-700">{data.top_artikel}</strong></span>
            </div>
            <button className="flex items-center gap-1 text-[9px] font-bold text-matcha-600 hover:text-matcha-800 transition-colors">
              <Download className="h-2.5 w-2.5" />
              CSV
            </button>
          </div>
        </>
      )}
    </div>
  );
}
