'use client';

import React, { useState, useEffect } from 'react';
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, CartesianGrid,
} from 'recharts';
import { TrendingUp } from 'lucide-react';

interface VerlaufTag {
  datum:          string;
  bestellungen:   number | null;
  umsatzEur:      number | null;
  puenktlichkeit: number | null;
  compositeScore: number | null;
  avgDeliveryMin: number | null;
}

interface Props {
  locationId: string | null;
}

type Metrik = 'bestellungen' | 'puenktlichkeit' | 'compositeScore' | 'avgDeliveryMin';

const METRIKEN: { key: Metrik; label: string; color: string; unit: string; invertiert: boolean }[] = [
  { key: 'bestellungen',   label: 'Bestellungen',  color: '#22c55e', unit: '',    invertiert: false },
  { key: 'puenktlichkeit', label: 'Pünktlichkeit', color: '#3b82f6', unit: '%',   invertiert: false },
  { key: 'compositeScore', label: 'Score',          color: '#a855f7', unit: '',    invertiert: false },
  { key: 'avgDeliveryMin', label: 'Ø Lieferzeit',   color: '#f59e0b', unit: ' Min', invertiert: true },
];

function fmtDatum(iso: string): string {
  const d = new Date(iso);
  return `${d.getDate()}.${d.getMonth() + 1}.`;
}

export function DispatchBenchmarkVerlaufChart({ locationId }: Props) {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<VerlaufTag[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeMetrik, setActiveMetrik] = useState<Metrik>('bestellungen');

  useEffect(() => {
    if (!open || !locationId) return;
    setLoading(true);
    fetch(`/api/delivery/admin/schicht-benchmark?location_id=${locationId}&history=true&days=28`)
      .then(r => r.json())
      .then(j => { if (j.ok) setData(j.verlauf ?? []); })
      .finally(() => setLoading(false));
  }, [open, locationId]);

  const metrik = METRIKEN.find(m => m.key === activeMetrik)!;
  const chartData = data.map(d => ({
    datum: fmtDatum(d.datum),
    wert:  d[activeMetrik] !== null ? Math.round((d[activeMetrik] as number) * 10) / 10 : null,
  }));

  return (
    <div className="rounded-xl border border-stone-800 bg-stone-950 overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-2 px-4 py-3 hover:bg-stone-900 transition-colors text-left"
      >
        <TrendingUp className="w-4 h-4 text-green-400 shrink-0" />
        <span className="text-sm font-semibold text-white">Schicht-Benchmark-Verlauf (28 Tage)</span>
        <span className="ml-auto text-xs text-stone-400">{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-3">
          {/* Metrik-Toggle */}
          <div className="flex flex-wrap gap-2 pt-1">
            {METRIKEN.map(m => (
              <button
                key={m.key}
                onClick={() => setActiveMetrik(m.key)}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                  activeMetrik === m.key
                    ? 'text-white'
                    : 'bg-stone-800 text-stone-400 hover:text-white'
                }`}
                style={activeMetrik === m.key ? { backgroundColor: m.color } : undefined}
              >
                {m.label}
              </button>
            ))}
          </div>

          {loading && (
            <div className="text-xs text-stone-400 py-6 text-center animate-pulse">Lade Verlaufsdaten…</div>
          )}

          {!loading && chartData.length === 0 && (
            <div className="text-xs text-stone-500 py-6 text-center">Keine Verlaufsdaten (noch nicht berechnet)</div>
          )}

          {!loading && chartData.length > 0 && (
            <div className="h-44">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#292524" />
                  <XAxis dataKey="datum" tick={{ fontSize: 10, fill: '#78716c' }} />
                  <YAxis tick={{ fontSize: 10, fill: '#78716c' }} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#1c1917', border: '1px solid #44403c', borderRadius: 6 }}
                    labelStyle={{ color: '#d6d3d1', fontSize: 11 }}
                    itemStyle={{ color: metrik.color, fontSize: 11 }}
                    formatter={(val) => [`${Number(val)}${metrik.unit}`, metrik.label]}
                  />
                  <Line
                    type="monotone"
                    dataKey="wert"
                    stroke={metrik.color}
                    strokeWidth={2}
                    dot={false}
                    connectNulls
                    name={metrik.label}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

          {!loading && chartData.length > 0 && (
            <div className="text-[10px] text-stone-500 text-right">
              {metrik.invertiert ? 'Niedriger = besser' : 'Höher = besser'}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
