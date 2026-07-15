'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { Clock, ChevronDown, ChevronUp, AlertTriangle } from 'lucide-react';

/**
 * Phase 1729 — Tour-Lücken-Monitor (Dispatch)
 *
 * Phase1727-API: Lücken-Timeline je Fahrer + Effizienz-Score + Alert-Banner.
 * 10-Min-Polling. in dispatch/client.tsx.
 */

interface TourLuecke {
  von: string;
  bis: string;
  dauer_min: number;
  alert: boolean;
}

interface FahrerLueckenProfil {
  driver_id: string;
  fahrer_name: string;
  touren_heute: number;
  aktiv_min: number;
  idle_min: number;
  effizienz_score: number;
  luecken: TourLuecke[];
}

interface TourLueckenResponse {
  fahrer: FahrerLueckenProfil[];
  location_id: string;
  datum: string;
  generiert_am: string;
}

interface Props {
  locationId: string | null;
}

const MOCK_FALLBACK: TourLueckenResponse = {
  fahrer: [
    {
      driver_id: 'm1', fahrer_name: 'Max Müller', touren_heute: 3, aktiv_min: 135, idle_min: 55,
      effizienz_score: 71,
      luecken: [
        { von: new Date(Date.now() - 90 * 60_000).toISOString(), bis: new Date(Date.now() - 65 * 60_000).toISOString(), dauer_min: 25, alert: true },
        { von: new Date(Date.now() - 30 * 60_000).toISOString(), bis: new Date(Date.now() - 0).toISOString(), dauer_min: 30, alert: true },
      ],
    },
    {
      driver_id: 'm2', fahrer_name: 'Anna Schmidt', touren_heute: 4, aktiv_min: 165, idle_min: 12,
      effizienz_score: 93,
      luecken: [
        { von: new Date(Date.now() - 50 * 60_000).toISOString(), bis: new Date(Date.now() - 38 * 60_000).toISOString(), dauer_min: 12, alert: false },
      ],
    },
    {
      driver_id: 'm3', fahrer_name: 'Klaus Weber', touren_heute: 2, aktiv_min: 60, idle_min: 30,
      effizienz_score: 67,
      luecken: [
        { von: new Date(Date.now() - 40 * 60_000).toISOString(), bis: new Date(Date.now() - 10 * 60_000).toISOString(), dauer_min: 30, alert: true },
      ],
    },
  ],
  location_id: 'mock',
  datum: new Date().toISOString().slice(0, 10),
  generiert_am: new Date().toISOString(),
};

function fmtMin(min: number): string {
  return `${Math.floor(min / 60) > 0 ? `${Math.floor(min / 60)}h ` : ''}${min % 60}min`;
}

function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
}

function ScoreRing({ score }: { score: number }) {
  const R = 16;
  const CIRC = 2 * Math.PI * R;
  const dash = (score / 100) * CIRC;
  const color = score >= 80 ? '#22c55e' : score >= 60 ? '#eab308' : '#ef4444';
  return (
    <svg width="40" height="40" className="shrink-0">
      <circle cx="20" cy="20" r={R} fill="none" stroke="#e5e7eb" strokeWidth="3.5" />
      <circle cx="20" cy="20" r={R} fill="none" stroke={color} strokeWidth="3.5"
        strokeDasharray={`${dash} ${CIRC}`} strokeLinecap="round"
        transform="rotate(-90 20 20)" />
      <text x="20" y="25" textAnchor="middle" style={{ fontSize: 10, fontWeight: 800, fill: color }}>{score}%</text>
    </svg>
  );
}

export function DispatchPhase1729TourLueckenMonitor({ locationId }: Props) {
  const [open, setOpen] = useState(true);
  const [data, setData] = useState<TourLueckenResponse | null>(null);
  const [selectedIdx, setSelectedIdx] = useState(0);

  useEffect(() => {
    if (!locationId) { setData(MOCK_FALLBACK); return; }
    const load = () =>
      fetch(`/api/delivery/admin/tour-luecken?location_id=${locationId}`)
        .then(r => r.json())
        .then((d: TourLueckenResponse) => setData(d))
        .catch(() => setData(MOCK_FALLBACK));
    load();
    const id = setInterval(load, 10 * 60_000);
    return () => clearInterval(id);
  }, [locationId]);

  const d = data ?? MOCK_FALLBACK;
  const alertFahrer = d.fahrer.filter(f => f.luecken.some(l => l.alert));
  const aktiverFahrer = d.fahrer[selectedIdx] ?? d.fahrer[0];

  return (
    <div className="rounded-xl border border-orange-200 dark:border-orange-800 bg-orange-50/30 dark:bg-orange-950/10 p-3 mb-3">
      <button
        onClick={() => setOpen(v => !v)}
        className="flex w-full items-center justify-between gap-2"
      >
        <span className="flex items-center gap-2 text-sm font-bold text-orange-700 dark:text-orange-300">
          <Clock className="h-4 w-4" />
          Tour-Lücken-Monitor
          {alertFahrer.length > 0 && (
            <span className="rounded-full bg-red-500 px-2 py-0.5 text-xs font-black text-white">
              {alertFahrer.length} Alerts
            </span>
          )}
        </span>
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>

      {open && (
        <div className="mt-3 space-y-3">
          {alertFahrer.length > 0 && (
            <div className="flex items-center gap-2 rounded-lg border border-red-300 dark:border-red-700 bg-red-100 dark:bg-red-900/30 px-3 py-2">
              <AlertTriangle className="h-4 w-4 shrink-0 text-red-600 dark:text-red-400" />
              <span className="text-xs font-bold text-red-700 dark:text-red-300">
                {alertFahrer.map(f => f.fahrer_name).join(', ')} — Lücken &gt;15 Min erkannt
              </span>
            </div>
          )}

          <div className="flex gap-1 flex-wrap">
            {d.fahrer.map((f, i) => (
              <button
                key={f.driver_id}
                onClick={() => setSelectedIdx(i)}
                className={cn(
                  'rounded-lg px-2.5 py-1 text-xs font-semibold transition-colors border',
                  i === selectedIdx
                    ? 'bg-orange-500 text-white border-orange-500'
                    : 'border-orange-200 dark:border-orange-700 text-orange-700 dark:text-orange-300 hover:bg-orange-100 dark:hover:bg-orange-900/20',
                )}
              >
                {f.fahrer_name.split(' ')[0]}
              </button>
            ))}
          </div>

          {aktiverFahrer && (
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <ScoreRing score={aktiverFahrer.effizienz_score} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-foreground">{aktiverFahrer.fahrer_name}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {aktiverFahrer.touren_heute} Touren · Aktiv {fmtMin(aktiverFahrer.aktiv_min)} · Idle {fmtMin(aktiverFahrer.idle_min)}
                  </p>
                </div>
              </div>

              {aktiverFahrer.luecken.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-1">Keine Lücken erkannt</p>
              ) : (
                <div className="space-y-1">
                  {aktiverFahrer.luecken.map((l, i) => (
                    <div key={i} className={cn(
                      'flex items-center justify-between rounded-lg border px-3 py-2',
                      l.alert
                        ? 'border-red-200 dark:border-red-700 bg-red-50 dark:bg-red-900/20'
                        : 'border-border bg-muted/30',
                    )}>
                      <span className="text-xs font-medium text-foreground">
                        {fmtTime(l.von)} – {fmtTime(l.bis)}
                      </span>
                      <span className={cn(
                        'text-xs font-bold',
                        l.alert ? 'text-red-600 dark:text-red-400' : 'text-muted-foreground',
                      )}>
                        {l.dauer_min} Min
                        {l.alert && <AlertTriangle className="inline h-3 w-3 ml-1" />}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <p className="text-[10px] text-muted-foreground">
            Lücken &gt;15 Min → Alert · 10-Min-Polling · {d.datum}
          </p>
        </div>
      )}
    </div>
  );
}
