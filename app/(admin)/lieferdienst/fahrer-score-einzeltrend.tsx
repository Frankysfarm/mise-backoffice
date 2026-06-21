'use client';

import React, { useEffect, useState } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ReferenceLine, ResponsiveContainer, Legend,
} from 'recharts';
import { ChevronDown, ChevronUp, TrendingUp, Users } from 'lucide-react';
import { cn } from '@/lib/utils';

interface DriverOption {
  id: string;
  name: string | null;
  grade: string;
  score: number;
}

interface FactorPoint {
  week: string;
  score: number;
  pünktlichkeit: number;
  bewertung: number;
  effizienz: number;
  zuverl: number;
}

interface Props {
  locationId: string | null;
}

const GRADE_BADGE: Record<string, string> = {
  'A+': 'bg-emerald-100 text-emerald-800',
  'A':  'bg-green-100 text-green-800',
  'B':  'bg-blue-100 text-blue-800',
  'C':  'bg-amber-100 text-amber-800',
  'D':  'bg-red-100 text-red-800',
};

/* Lieferdienst: Collapsible Einzel-Fahrer-Score-Trend mit 4 Haupt-Faktoren.
   Vergleich Composite-Score + Faktor-Linien über 8 Wochen. */
export function LieferdienstFahrerScoreEinzeltrend({ locationId }: Props) {
  const [open, setOpen]             = useState(false);
  const [showFactors, setShowFactors] = useState(false);
  const [drivers, setDrivers]       = useState<DriverOption[]>([]);
  const [selectedId, setSelectedId] = useState<string>('');
  const [points, setPoints]         = useState<FactorPoint[]>([]);
  const [loading, setLoading]       = useState(false);

  useEffect(() => {
    if (!locationId) return;
    const load = async () => {
      try {
        const r = await fetch(
          `/api/delivery/admin/driver-score?location_id=${encodeURIComponent(locationId)}&action=leaderboard&limit=30`,
        );
        if (!r.ok) return;
        const d = await r.json();
        const opts: DriverOption[] = (d.entries ?? []).map((e: Record<string, unknown>) => ({
          id:    String(e.driverId ?? ''),
          name:  (e.driverName as string | null) ?? null,
          grade: String(e.grade ?? 'D'),
          score: Number(e.compositeScore ?? 0),
        }));
        setDrivers(opts);
        if (opts.length > 0 && !selectedId) setSelectedId(opts[0].id);
      } catch { /* silent */ }
    };
    load();
  }, [locationId, selectedId]);

  useEffect(() => {
    if (!open || !locationId || !selectedId) return;
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      try {
        const r = await fetch(
          `/api/delivery/admin/driver-score?location_id=${encodeURIComponent(locationId)}&action=history&driver_id=${encodeURIComponent(selectedId)}&weeks=8`,
        );
        if (!r.ok || cancelled) return;
        const d = await r.json();
        const pts: FactorPoint[] = (d.rows ?? []).map((row: Record<string, unknown>) => ({
          week:           String(row.periodStart ?? '').slice(5),
          score:          Number(row.compositeScore ?? 0),
          pünktlichkeit:  Number(row.fPunctuality ?? 0),
          bewertung:      Number(row.fRating ?? 0),
          effizienz:      Number(row.fEfficiency ?? 0),
          zuverl:         Number(row.fReliability ?? 0),
        }));
        if (!cancelled) setPoints(pts);
      } catch { /* silent */ }
      finally { if (!cancelled) setLoading(false); }
    };

    load();
    const t = setInterval(load, 10 * 60_000);
    return () => { cancelled = true; clearInterval(t); };
  }, [open, locationId, selectedId]);

  if (!locationId) return null;

  const selected = drivers.find((d) => d.id === selectedId);

  return (
    <div className="rounded-xl border border-stone-200 bg-white overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-stone-50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-matcha-600" />
          <span className="font-semibold text-stone-800 text-sm">Fahrer Score-Einzeltrend</span>
          {selected && (
            <span className={cn(
              'text-xs font-bold px-1.5 py-0.5 rounded',
              GRADE_BADGE[selected.grade] ?? GRADE_BADGE['D'],
            )}>
              Note {selected.grade}
            </span>
          )}
        </div>
        {open ? <ChevronUp className="h-4 w-4 text-stone-400" /> : <ChevronDown className="h-4 w-4 text-stone-400" />}
      </button>

      {open && (
        <div className="border-t border-stone-100 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-stone-400" />
              <select
                value={selectedId}
                onChange={(e) => setSelectedId(e.target.value)}
                className="text-sm border border-stone-200 rounded-lg px-2 py-1 bg-white focus:outline-none focus:ring-1 focus:ring-matcha-400"
              >
                {drivers.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name ?? d.id.slice(0, 8)} — Note {d.grade} ({Math.round(d.score)} Pkt)
                  </option>
                ))}
              </select>
            </div>
            <button
              onClick={() => setShowFactors((v) => !v)}
              className="text-xs text-stone-500 hover:text-stone-700 border border-stone-200 rounded px-2 py-0.5"
            >
              {showFactors ? 'Nur Score' : '+ Faktoren'}
            </button>
          </div>

          {loading ? (
            <div className="h-40 flex items-center justify-center text-stone-400 text-sm">Lade…</div>
          ) : points.length === 0 ? (
            <div className="h-40 flex items-center justify-center text-stone-400 text-sm">
              Noch keine Verlaufsdaten — Snapshot läuft täglich 02:50 UTC
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={points} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="week" tick={{ fontSize: 11 }} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} width={28} />
                <Tooltip formatter={(val: unknown) => [`${Number(val).toFixed(1)}`]} />
                {showFactors && <Legend wrapperStyle={{ fontSize: 10 }} />}
                <ReferenceLine y={75} stroke="#d1d5db" strokeDasharray="4 2" label={{ value: 'A', fontSize: 9, fill: '#9ca3af' }} />
                <ReferenceLine y={45} stroke="#fecaca" strokeDasharray="4 2" label={{ value: 'D', fontSize: 9, fill: '#f87171' }} />
                <Line type="monotone" dataKey="score" name="Gesamt" stroke="#4ade80" strokeWidth={2.5} dot={{ r: 3 }} />
                {showFactors && <>
                  <Line type="monotone" dataKey="pünktlichkeit" name="Pünktlichkeit" stroke="#60a5fa" strokeWidth={1.5} strokeDasharray="4 2" dot={false} />
                  <Line type="monotone" dataKey="bewertung" name="Bewertung" stroke="#f59e0b" strokeWidth={1.5} strokeDasharray="4 2" dot={false} />
                  <Line type="monotone" dataKey="effizienz" name="Effizienz" stroke="#a78bfa" strokeWidth={1.5} strokeDasharray="4 2" dot={false} />
                  <Line type="monotone" dataKey="zuverl" name="Zuverl." stroke="#f87171" strokeWidth={1.5} strokeDasharray="4 2" dot={false} />
                </>}
              </LineChart>
            </ResponsiveContainer>
          )}

          {points.length >= 2 && (() => {
            const d = points.at(-1)!.score - points.at(-2)!.score;
            return (
              <p className={cn(
                'text-xs font-medium',
                d > 2 ? 'text-emerald-600' : d < -2 ? 'text-red-600' : 'text-stone-500',
              )}>
                {d > 2 ? `↑ +${d.toFixed(1)} Punkte zur Vorwoche` :
                 d < -2 ? `↓ ${d.toFixed(1)} Punkte zur Vorwoche` :
                 'Score stabil zur Vorwoche'}
              </p>
            );
          })()}
        </div>
      )}
    </div>
  );
}
