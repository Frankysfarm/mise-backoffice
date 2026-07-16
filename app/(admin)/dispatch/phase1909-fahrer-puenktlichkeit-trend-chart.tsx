'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { TrendingDown, TrendingUp, Minus, ChevronDown, ChevronUp, AlertTriangle } from 'lucide-react';

/**
 * Phase 1909 — Fahrer-Pünktlichkeits-Trend-Chart (Dispatch)
 *
 * Linien-Chart je Fahrer letzte 7 Tage; Trend-Pfeil + Ampel.
 * Alert-Banner >20% Rückgang; 1-Std-Polling.
 */

type TrendRichtung = 'steigend' | 'fallend' | 'stabil';

interface TagWert {
  datum: string;
  puenktlichkeit_pct: number;
}

interface FahrerTrend {
  fahrer_id: string;
  name: string;
  zeitreihe: TagWert[];
  trend: TrendRichtung;
  aktuell_pct: number;
  vorwoche_pct: number;
  abweichung_pct: number;
  alert: boolean;
}

interface ApiAntwort {
  location_id: string;
  fahrer: FahrerTrend[];
  alert_count: number;
  generiert_am: string;
}

function datumLabel(daysAgo: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - daysAgo);
  return d.toISOString().slice(0, 10);
}

const MOCK: ApiAntwort = {
  location_id: 'mock',
  fahrer: [
    {
      fahrer_id: 'f1',
      name: 'Max M.',
      zeitreihe: [6, 5, 4, 3, 2, 1, 0].map((d) => ({
        datum: datumLabel(d),
        puenktlichkeit_pct: [82, 85, 88, 84, 90, 91, 93][6 - d],
      })),
      trend: 'steigend',
      aktuell_pct: 93,
      vorwoche_pct: 82,
      abweichung_pct: 13.4,
      alert: false,
    },
    {
      fahrer_id: 'f2',
      name: 'Sara K.',
      zeitreihe: [6, 5, 4, 3, 2, 1, 0].map((d) => ({
        datum: datumLabel(d),
        puenktlichkeit_pct: [88, 82, 76, 70, 65, 62, 60][6 - d],
      })),
      trend: 'fallend',
      aktuell_pct: 60,
      vorwoche_pct: 88,
      abweichung_pct: -31.8,
      alert: true,
    },
  ],
  alert_count: 1,
  generiert_am: new Date().toISOString(),
};

function Sparkline({ daten, alert }: { daten: TagWert[]; alert: boolean }) {
  const max = Math.max(...daten.map((d) => d.puenktlichkeit_pct), 1);
  const min = Math.min(...daten.map((d) => d.puenktlichkeit_pct));
  const range = max - min || 1;
  const W = 80;
  const H = 28;
  const pts = daten.map((d, i) => {
    const x = (i / (daten.length - 1)) * W;
    const y = H - ((d.puenktlichkeit_pct - min) / range) * H;
    return `${x},${y}`;
  });
  const color = alert ? '#ef4444' : '#22c55e';
  return (
    <svg width={W} height={H} className="shrink-0 overflow-visible">
      <polyline
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinejoin="round"
        strokeLinecap="round"
        points={pts.join(' ')}
      />
    </svg>
  );
}

interface Props {
  locationId: string | null;
  className?: string;
}

export function DispatchPhase1909FahrerPuenktlichkeitTrendChart({ locationId, className }: Props) {
  const [daten, setDaten] = useState<ApiAntwort | null>(null);
  const [offen, setOffen] = useState(true);

  useEffect(() => {
    if (!locationId) return;

    const laden = async () => {
      try {
        const res = await fetch(`/api/delivery/admin/fahrer-puenktlichkeit-trend?location_id=${locationId}`);
        if (!res.ok) throw new Error('API Fehler');
        setDaten(await res.json());
      } catch {
        setDaten({ ...MOCK, location_id: locationId });
      }
    };

    laden();
    const id = setInterval(laden, 60 * 60 * 1000);
    return () => clearInterval(id);
  }, [locationId]);

  if (!locationId || !daten) return null;

  const TrendIcon = ({ trend }: { trend: TrendRichtung }) =>
    trend === 'steigend' ? (
      <TrendingUp className="h-3.5 w-3.5 text-green-500 shrink-0" />
    ) : trend === 'fallend' ? (
      <TrendingDown className="h-3.5 w-3.5 text-red-500 shrink-0" />
    ) : (
      <Minus className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
    );

  return (
    <div className={cn('rounded-2xl border bg-card shadow-sm overflow-hidden', className)}>
      <button
        onClick={() => setOffen((v) => !v)}
        className="flex w-full items-center gap-2 px-4 py-2.5 border-b hover:bg-muted/30 transition-colors"
      >
        <TrendingDown className="h-4 w-4 text-blue-500 shrink-0" />
        <span className="text-xs font-bold uppercase tracking-wider">Pünktlichkeits-Trend · 7 Tage</span>
        {daten.alert_count > 0 && (
          <span className="ml-1 text-[10px] font-bold rounded-full bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 px-2 py-0.5">
            {daten.alert_count} Alert{daten.alert_count > 1 ? 's' : ''}
          </span>
        )}
        {offen ? (
          <ChevronUp className="h-4 w-4 text-muted-foreground ml-auto shrink-0" />
        ) : (
          <ChevronDown className="h-4 w-4 text-muted-foreground ml-auto shrink-0" />
        )}
      </button>

      {offen && (
        <div className="p-4 space-y-3">
          {daten.alert_count > 0 && (
            <div className="rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/20 px-3 py-2 flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
              <p className="text-xs text-red-700 dark:text-red-300">
                {daten.alert_count} Fahrer mit Pünktlichkeitsrückgang &gt;20% vs. Vorwoche — sofort prüfen.
              </p>
            </div>
          )}

          <div className="space-y-2">
            {daten.fahrer.map((f) => (
              <div
                key={f.fahrer_id}
                className={cn(
                  'rounded-xl border px-3 py-2.5 flex items-center gap-3',
                  f.alert
                    ? 'border-red-200 dark:border-red-800 bg-red-50/50 dark:bg-red-950/10'
                    : 'bg-muted/20',
                )}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold truncate">{f.name}</span>
                    <TrendIcon trend={f.trend} />
                    {f.alert && (
                      <span className="text-[10px] font-bold rounded-full bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 px-1.5 py-0.5 shrink-0">
                        −{Math.abs(f.abweichung_pct).toFixed(0)}%
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <span
                      className={cn(
                        'text-[10px] tabular-nums font-semibold',
                        f.aktuell_pct >= 85
                          ? 'text-green-600 dark:text-green-400'
                          : f.aktuell_pct >= 70
                          ? 'text-amber-600 dark:text-amber-400'
                          : 'text-red-600 dark:text-red-400',
                      )}
                    >
                      {f.aktuell_pct}% heute
                    </span>
                    <span className="text-[10px] text-muted-foreground">vs. {f.vorwoche_pct}% Vorwoche</span>
                  </div>
                </div>
                <Sparkline daten={f.zeitreihe} alert={f.alert} />
              </div>
            ))}
          </div>

          <p className="text-[10px] text-muted-foreground text-right">
            Aktualisierung stündlich ·{' '}
            {new Date(daten.generiert_am).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
          </p>
        </div>
      )}
    </div>
  );
}
