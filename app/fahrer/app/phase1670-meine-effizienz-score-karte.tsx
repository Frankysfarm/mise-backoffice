'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { Zap, WifiOff, Loader2, TrendingUp, TrendingDown, Minus, ChevronDown, ChevronUp } from 'lucide-react';

/**
 * Phase 1670 — Meine-Effizienz-Score-Karte (Fahrer-App)
 *
 * Phase1667-API: eigener Score (0–100) + Rang unter allen Fahrern + Verbesserungs-Tipp.
 * isOnline-Guard. 30-Min-Polling.
 */

interface FahrerEffizienz {
  driver_id: string;
  fahrer_name: string;
  score_heute: number;
  score_7d_avg: number;
  trend: 'steigend' | 'stabil' | 'fallend';
  km_pro_stopp: number;
  puenktlichkeit_pct: number;
  bewertung_avg: number;
  stopps_heute: number;
}

interface ApiResponse {
  location_id: string;
  fahrer: FahrerEffizienz[];
  generiert_am: string;
}

interface Props {
  driverId?: string | null;
  isOnline?: boolean;
}

const MOCK_RESPONSE: ApiResponse = {
  location_id: 'mock',
  fahrer: [
    { driver_id: 'self', fahrer_name: 'Ich', score_heute: 79, score_7d_avg: 76, trend: 'steigend', km_pro_stopp: 3.5, puenktlichkeit_pct: 88, bewertung_avg: 4.3, stopps_heute: 11 },
    { driver_id: 'other1', fahrer_name: 'A',  score_heute: 91, score_7d_avg: 89, trend: 'steigend', km_pro_stopp: 2.8, puenktlichkeit_pct: 96, bewertung_avg: 4.7, stopps_heute: 15 },
    { driver_id: 'other2', fahrer_name: 'B',  score_heute: 68, score_7d_avg: 72, trend: 'fallend',  km_pro_stopp: 4.6, puenktlichkeit_pct: 80, bewertung_avg: 4.0, stopps_heute: 8 },
  ],
  generiert_am: new Date().toISOString(),
};

function tip(f: FahrerEffizienz): string {
  if (f.puenktlichkeit_pct < 85) return 'Pünktlichkeit verbessern: Starke Ø-ETA einhalten → +5–10 Punkte';
  if (f.km_pro_stopp > 4.0) return 'Kürzere Routen wählen: Weniger km/Stopp → +8 Effizienz-Punkte';
  if (f.bewertung_avg < 4.3) return 'Bewertungen steigern: Freundliche Übergabe → +6 Punkte';
  return 'Weiter so! Du bist auf einem guten Weg – halte deine Leistung.';
}

function TrendIcon({ t }: { t: FahrerEffizienz['trend'] }) {
  if (t === 'steigend') return <TrendingUp className="h-4 w-4 text-matcha-500" />;
  if (t === 'fallend')  return <TrendingDown className="h-4 w-4 text-red-500" />;
  return <Minus className="h-4 w-4 text-muted-foreground" />;
}

function scoreColor(s: number) {
  if (s >= 85) return 'text-matcha-600 dark:text-matcha-400';
  if (s >= 70) return 'text-amber-600 dark:text-amber-400';
  return 'text-red-600 dark:text-red-400';
}

function scoreRingColor(s: number) {
  if (s >= 85) return '#4ade80';
  if (s >= 70) return '#f59e0b';
  return '#ef4444';
}

export function FahrerPhase1670MeineEffizienzScoreKarte({ driverId, isOnline = false }: Props) {
  const [data, setData] = useState<ApiResponse>(MOCK_RESPONSE);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(true);

  useEffect(() => {
    if (!isOnline || !driverId) return;

    async function load() {
      setLoading(true);
      try {
        const r = await fetch(`/api/delivery/admin/fahrer-effizienz?driver_id=${driverId}`);
        if (r.ok) {
          const json = await r.json() as ApiResponse;
          if (json.fahrer?.length) setData(json);
        }
      } catch {
        // Mock bleibt
      } finally {
        setLoading(false);
      }
    }

    load();
    const iv = setInterval(load, 30 * 60 * 1000);
    return () => clearInterval(iv);
  }, [driverId, isOnline]);

  if (!isOnline) {
    return (
      <div className="rounded-xl border border-border bg-card p-3 mb-3 flex items-center gap-2 text-muted-foreground">
        <WifiOff className="h-4 w-4 shrink-0" />
        <span className="text-xs">Effizienz-Score nur im Online-Modus verfügbar</span>
      </div>
    );
  }

  const me = data.fahrer.find(f => f.driver_id === driverId) ?? data.fahrer[0];
  if (!me) return null;

  const sorted = [...data.fahrer].sort((a, b) => b.score_heute - a.score_heute);
  const rang = sorted.findIndex(f => f.driver_id === me.driver_id) + 1;
  const total = sorted.length;

  const RING = 72;
  const R = 28;
  const CIRC = 2 * Math.PI * R;
  const offset = CIRC * (1 - me.score_heute / 100);

  return (
    <div className="rounded-xl border border-border bg-card p-3 mb-3">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-2 w-full text-left"
      >
        <Zap className="h-4 w-4 shrink-0 text-amber-500" />
        <span className="text-sm font-semibold flex-1 text-foreground">Mein Effizienz-Score</span>
        {loading && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>

      {open && (
        <div className="mt-3">
          <div className="flex items-center gap-4">
            {/* SVG Ring */}
            <svg width={RING} height={RING} className="shrink-0">
              <circle cx={RING / 2} cy={RING / 2} r={R} fill="none" stroke="currentColor" strokeWidth={6} className="text-muted/30" />
              <circle
                cx={RING / 2}
                cy={RING / 2}
                r={R}
                fill="none"
                stroke={scoreRingColor(me.score_heute)}
                strokeWidth={6}
                strokeDasharray={CIRC}
                strokeDashoffset={offset}
                strokeLinecap="round"
                transform={`rotate(-90 ${RING / 2} ${RING / 2})`}
                className="transition-all duration-500"
              />
              <text
                x={RING / 2}
                y={RING / 2 + 1}
                textAnchor="middle"
                dominantBaseline="middle"
                className={cn('text-[15px] font-bold fill-current', scoreColor(me.score_heute))}
                style={{ fill: scoreRingColor(me.score_heute) }}
              >
                {me.score_heute}
              </text>
            </svg>

            {/* KPIs */}
            <div className="flex-1 space-y-1">
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-muted-foreground">Trend (7d)</span>
                <div className="flex items-center gap-1">
                  <TrendIcon t={me.trend} />
                  <span className="font-medium text-foreground">Ø {me.score_7d_avg}</span>
                </div>
              </div>
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-muted-foreground">Rang</span>
                <span className="font-bold text-foreground">#{rang} / {total}</span>
              </div>
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-muted-foreground">km/Stopp</span>
                <span className="font-medium text-foreground">{me.km_pro_stopp.toFixed(1)}</span>
              </div>
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-muted-foreground">Pünktlichkeit</span>
                <span className="font-medium text-foreground">{me.puenktlichkeit_pct}%</span>
              </div>
            </div>
          </div>

          {/* Verbesserungs-Tipp */}
          <div className="mt-2 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 px-3 py-2">
            <p className="text-[11px] text-amber-700 dark:text-amber-300 leading-snug">
              💡 {tip(me)}
            </p>
          </div>

          <p className="text-[9px] text-muted-foreground mt-1.5">
            Aktualisierung alle 30 Min · Score: km 30% + Pünktl. 40% + Bewertung 30%
          </p>
        </div>
      )}
    </div>
  );
}
