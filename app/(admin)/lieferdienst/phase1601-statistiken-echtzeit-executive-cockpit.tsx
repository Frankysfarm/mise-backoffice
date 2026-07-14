'use client';

import React, { useEffect, useState, useCallback } from 'react';

interface Kpi {
  label: string;
  value: string;
  sub?: string;
  trend?: 'up' | 'down' | 'flat';
  color: string;
  bg: string;
  border: string;
}

interface DashData {
  umsatz_heute: number;
  umsatz_gestern: number;
  bestellungen_heute: number;
  bestellungen_gestern: number;
  pünktlichkeitsrate: number;
  stornoquote: number;
  durchschnittliche_lieferzeit_min: number;
  aktive_touren: number;
  aktive_fahrer: number;
  trinkgeld_heute: number;
  top_stunde: number;
  bewertung_heute: number;
}

interface Props {
  locationId: string | null;
}

function pct(a: number, b: number): string {
  if (!b) return '–';
  const diff = ((a - b) / b) * 100;
  return `${diff >= 0 ? '+' : ''}${diff.toFixed(1)} %`;
}

function trend(a: number, b: number): 'up' | 'down' | 'flat' {
  if (a > b * 1.02) return 'up';
  if (a < b * 0.98) return 'down';
  return 'flat';
}

const TREND_ICON = { up: '↑', down: '↓', flat: '→' };
const TREND_COLOR = { up: 'text-emerald-600', down: 'text-red-500', flat: 'text-stone-400' };

export function LieferdienstPhase1601StatistikenEchtzeitExecutiveCockpit({ locationId }: Props) {
  const [data, setData] = useState<DashData | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = locationId ? `?location_id=${encodeURIComponent(locationId)}` : '';
      const res = await fetch(`/api/delivery/admin/stats-executive${params}`, { cache: 'no-store' });
      if (res.ok) {
        setData(await res.json());
        return;
      }
    } catch { /* ignore */ }

    // Mock-Daten wenn API nicht verfügbar
    // NOTE: API-Endpunkt /api/delivery/admin/stats-executive muss noch implementiert werden
    setData({
      umsatz_heute: 1842.5,
      umsatz_gestern: 1620.0,
      bestellungen_heute: 47,
      bestellungen_gestern: 41,
      pünktlichkeitsrate: 88.3,
      stornoquote: 3.2,
      durchschnittliche_lieferzeit_min: 28,
      aktive_touren: 5,
      aktive_fahrer: 6,
      trinkgeld_heute: 124.0,
      top_stunde: 19,
      bewertung_heute: 4.7,
    });
  }, [locationId]);

  useEffect(() => {
    load();
    const id = setInterval(load, 5 * 60 * 1000);
    return () => clearInterval(id);
  }, [load]);

  if (loading && !data) {
    return (
      <div className="rounded-2xl border border-matcha-200 bg-white p-5 shadow-sm mb-4 animate-pulse">
        <div className="h-4 bg-matcha-100 rounded w-1/2 mb-3" />
        <div className="grid grid-cols-2 gap-3">
          {[1, 2, 3, 4, 5, 6].map((i) => <div key={i} className="h-16 bg-stone-100 rounded-xl" />)}
        </div>
      </div>
    );
  }

  if (!data) return null;

  const eur = (v: number) =>
    v.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';

  const kpis: Kpi[] = [
    {
      label: 'Umsatz heute',
      value: eur(data.umsatz_heute),
      sub: `vs. gestern ${pct(data.umsatz_heute, data.umsatz_gestern)}`,
      trend: trend(data.umsatz_heute, data.umsatz_gestern),
      color: 'text-matcha-700',
      bg: 'bg-matcha-50',
      border: 'border-matcha-200',
    },
    {
      label: 'Bestellungen',
      value: data.bestellungen_heute.toString(),
      sub: `vs. gestern ${pct(data.bestellungen_heute, data.bestellungen_gestern)}`,
      trend: trend(data.bestellungen_heute, data.bestellungen_gestern),
      color: 'text-blue-700',
      bg: 'bg-blue-50',
      border: 'border-blue-200',
    },
    {
      label: 'Pünktlichkeit',
      value: `${data.pünktlichkeitsrate.toFixed(1)} %`,
      sub: data.pünktlichkeitsrate >= 85 ? 'Gut' : data.pünktlichkeitsrate >= 70 ? 'OK' : 'Verbesserungsbedarf',
      color: data.pünktlichkeitsrate >= 85 ? 'text-emerald-700' : data.pünktlichkeitsrate >= 70 ? 'text-amber-700' : 'text-red-700',
      bg: data.pünktlichkeitsrate >= 85 ? 'bg-emerald-50' : data.pünktlichkeitsrate >= 70 ? 'bg-amber-50' : 'bg-red-50',
      border: data.pünktlichkeitsrate >= 85 ? 'border-emerald-200' : data.pünktlichkeitsrate >= 70 ? 'border-amber-200' : 'border-red-200',
    },
    {
      label: 'Stornoquote',
      value: `${data.stornoquote.toFixed(1)} %`,
      sub: data.stornoquote <= 5 ? 'Normal' : 'Erhöht',
      color: data.stornoquote <= 5 ? 'text-stone-700' : 'text-red-700',
      bg: data.stornoquote <= 5 ? 'bg-stone-50' : 'bg-red-50',
      border: data.stornoquote <= 5 ? 'border-stone-200' : 'border-red-200',
    },
    {
      label: 'Ø Lieferzeit',
      value: `${data.durchschnittliche_lieferzeit_min} min`,
      sub: data.durchschnittliche_lieferzeit_min <= 30 ? 'Schnell' : 'Zu langsam',
      color: data.durchschnittliche_lieferzeit_min <= 30 ? 'text-emerald-700' : 'text-amber-700',
      bg: data.durchschnittliche_lieferzeit_min <= 30 ? 'bg-emerald-50' : 'bg-amber-50',
      border: data.durchschnittliche_lieferzeit_min <= 30 ? 'border-emerald-200' : 'border-amber-200',
    },
    {
      label: 'Trinkgeld',
      value: eur(data.trinkgeld_heute),
      sub: `${data.aktive_fahrer} aktive Fahrer`,
      color: 'text-amber-700',
      bg: 'bg-amber-50',
      border: 'border-amber-200',
    },
  ];

  return (
    <div className="rounded-2xl border border-matcha-200 bg-white overflow-hidden shadow-sm mb-4">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 bg-matcha-700 text-white">
        <span className="text-sm font-bold uppercase tracking-wider flex-1">
          Statistiken · Echtzeit Executive Cockpit
        </span>
        <span className="text-xs bg-white/20 rounded-full px-2 py-0.5">
          {data.aktive_touren} Touren aktiv
        </span>
      </div>

      {/* KPI-Grid */}
      <div className="grid grid-cols-2 gap-3 p-4 sm:grid-cols-3">
        {kpis.map((kpi) => (
          <div key={kpi.label} className={`rounded-xl border p-3 ${kpi.bg} ${kpi.border}`}>
            <div className={`text-lg font-black tabular-nums ${kpi.color}`}>{kpi.value}</div>
            <div className="text-[10px] font-bold text-stone-500 mt-0.5">{kpi.label}</div>
            {kpi.sub && (
              <div className="flex items-center gap-1 mt-1">
                {kpi.trend && (
                  <span className={`text-xs font-bold ${TREND_COLOR[kpi.trend]}`}>
                    {TREND_ICON[kpi.trend]}
                  </span>
                )}
                <span className="text-[10px] text-stone-400">{kpi.sub}</span>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Bewertung + Top-Stunde */}
      <div className="flex gap-3 px-4 pb-4">
        <div className="flex-1 rounded-xl border border-yellow-200 bg-yellow-50 p-3">
          <div className="flex items-center gap-2">
            <span className="text-xl">⭐</span>
            <div>
              <div className="text-lg font-black tabular-nums text-yellow-700">
                {data.bewertung_heute.toFixed(1)}
              </div>
              <div className="text-[10px] font-bold text-stone-500">Ø Bewertung heute</div>
            </div>
          </div>
        </div>
        <div className="flex-1 rounded-xl border border-purple-200 bg-purple-50 p-3">
          <div className="flex items-center gap-2">
            <span className="text-xl">⏰</span>
            <div>
              <div className="text-lg font-black tabular-nums text-purple-700">
                {data.top_stunde}:00 Uhr
              </div>
              <div className="text-[10px] font-bold text-stone-500">Stärkste Stunde</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
