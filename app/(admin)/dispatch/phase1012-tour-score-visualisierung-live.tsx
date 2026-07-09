'use client';

import { useEffect, useState, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { TrendingUp, TrendingDown, Minus, Trophy, MapPin, Clock, ChevronDown, ChevronUp, Star, AlertTriangle, Loader2 } from 'lucide-react';

/**
 * Phase 1012 — Tour-Score-Visualisierung Live (Dispatch)
 *
 * Live-Score-Visualisierung für alle aktiven Touren:
 * - Score-Gauge je Fahrer (SVG-Halbkreis, 0–100)
 * - Trend-Pfeile vs. letzter Tour
 * - Stopp-Fortschritt und Zonen-Info
 * - SLA-Ampel (grün/amber/rot)
 * Polling: 60s. Fallback: Mock-Daten.
 */

interface TourScore {
  fahrer_id: string;
  fahrer_name: string;
  tour_id: string;
  zone: string | null;
  score: number;           // 0–100
  score_trend: number;     // delta vs. vorherige Tour
  stopps_gesamt: number;
  stopps_offen: number;
  sla_status: 'ok' | 'gefaehrdet' | 'verletzt';
  eta_min_verbleibend: number | null;
  bewertung_akt: number | null;
}

interface ApiResponse {
  touren: TourScore[];
  location_id: string | null;
  generiert_am: string;
}

const MOCK: ApiResponse = {
  touren: [
    { fahrer_id: 'f1', fahrer_name: 'M. Bauer', tour_id: 't1', zone: 'A', score: 88, score_trend: +4, stopps_gesamt: 4, stopps_offen: 2, sla_status: 'ok', eta_min_verbleibend: 18, bewertung_akt: 4.8 },
    { fahrer_id: 'f2', fahrer_name: 'L. Huber', tour_id: 't2', zone: 'B', score: 62, score_trend: -7, stopps_gesamt: 3, stopps_offen: 2, sla_status: 'gefaehrdet', eta_min_verbleibend: 34, bewertung_akt: 4.2 },
    { fahrer_id: 'f3', fahrer_name: 'K. Stein', tour_id: 't3', zone: 'C', score: 41, score_trend: -15, stopps_gesamt: 5, stopps_offen: 4, sla_status: 'verletzt', eta_min_verbleibend: 52, bewertung_akt: 3.9 },
    { fahrer_id: 'f4', fahrer_name: 'A. König', tour_id: 't4', zone: 'A', score: 95, score_trend: +2, stopps_gesamt: 2, stopps_offen: 0, sla_status: 'ok', eta_min_verbleibend: null, bewertung_akt: 4.9 },
  ],
  location_id: null,
  generiert_am: new Date().toISOString(),
};

interface Props {
  locationId: string | null;
}

function scoreColor(score: number): { arc: string; text: string; bg: string } {
  if (score >= 80) return { arc: '#22c55e', text: 'text-matcha-700 dark:text-matcha-300', bg: 'bg-matcha-50 dark:bg-matcha-900/20' };
  if (score >= 60) return { arc: '#f59e0b', text: 'text-amber-700 dark:text-amber-300', bg: 'bg-amber-50 dark:bg-amber-900/20' };
  return { arc: '#ef4444', text: 'text-red-700 dark:text-red-300', bg: 'bg-red-50 dark:bg-red-900/20' };
}

function slaStyle(sla: string) {
  if (sla === 'ok')         return { badge: 'bg-matcha-100 dark:bg-matcha-800 text-matcha-700 dark:text-matcha-200', label: 'SLA OK' };
  if (sla === 'gefaehrdet') return { badge: 'bg-amber-100 dark:bg-amber-800 text-amber-700 dark:text-amber-200', label: 'Gefährdet' };
  return { badge: 'bg-red-100 dark:bg-red-800 text-red-700 dark:text-red-200', label: 'Verletzt' };
}

function ScoreGauge({ score, color }: { score: number; color: string }) {
  const r = 28;
  const cx = 36;
  const cy = 36;
  const startAngle = -Math.PI;
  const endAngle = 0;
  const pct = score / 100;
  const sweepAngle = (endAngle - startAngle) * pct + startAngle;
  const sx = cx + r * Math.cos(startAngle);
  const sy = cy + r * Math.sin(startAngle);
  const ex = cx + r * Math.cos(sweepAngle);
  const ey = cy + r * Math.sin(sweepAngle);
  const large = pct > 0.5 ? 1 : 0;
  const trackPath = `M ${cx + r * Math.cos(startAngle)} ${cy + r * Math.sin(startAngle)} A ${r} ${r} 0 1 1 ${cx + r * Math.cos(endAngle)} ${cy + r * Math.sin(endAngle)}`;
  const arcPath = pct > 0.001
    ? `M ${sx} ${sy} A ${r} ${r} 0 ${large} 1 ${ex} ${ey}`
    : '';

  return (
    <svg width={72} height={44} className="overflow-visible">
      {/* Track */}
      <path d={trackPath} fill="none" stroke="currentColor" strokeWidth={6} strokeLinecap="round" className="text-muted/30" />
      {/* Arc */}
      {arcPath && <path d={arcPath} fill="none" stroke={color} strokeWidth={6} strokeLinecap="round" />}
      {/* Score text */}
      <text x={cx} y={cy + 8} textAnchor="middle" fontSize="14" fontWeight="900" fill="currentColor" className="font-mono">
        {score}
      </text>
    </svg>
  );
}

export function DispatchPhase1012TourScoreVisualisierungLive({ locationId }: Props) {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(true);

  const load = useCallback(async () => {
    try {
      const url = locationId
        ? `/api/delivery/dispatch/tour-scores?location_id=${locationId}`
        : '/api/delivery/dispatch/tour-scores';
      const res = await fetch(url, { cache: 'no-store' });
      if (!res.ok) throw new Error('api');
      const json = await res.json();
      setData(json);
    } catch {
      setData(MOCK);
    } finally {
      setLoading(false);
    }
  }, [locationId]);

  useEffect(() => {
    load();
    const iv = setInterval(load, 60_000);
    return () => clearInterval(iv);
  }, [load]);

  const touren = data?.touren ?? MOCK.touren;
  const aktivTouren = touren.filter(t => t.stopps_offen > 0);
  const verletzt = touren.filter(t => t.sla_status === 'verletzt').length;
  const avgScore = touren.length > 0 ? Math.round(touren.reduce((s, t) => s + t.score, 0) / touren.length) : 0;

  return (
    <div className="rounded-xl border bg-card text-card-foreground shadow-sm overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/30 transition"
      >
        <div className="flex items-center gap-2">
          <Trophy className="h-4 w-4 text-amber-500" />
          <span className="text-sm font-bold">Tour-Score-Visualisierung Live</span>
          {loading && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
          <span className="text-[10px] rounded-full bg-muted px-2 py-0.5 font-mono tabular-nums text-muted-foreground">
            Ø {avgScore}
          </span>
          {verletzt > 0 && (
            <span className="text-[10px] rounded-full bg-red-100 dark:bg-red-900 px-2 py-0.5 font-bold text-red-700 dark:text-red-300 flex items-center gap-1">
              <AlertTriangle className="h-2.5 w-2.5" /> {verletzt}× SLA verletzt
            </span>
          )}
        </div>
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>

      {open && (
        <div className="px-4 pb-4">
          {touren.length === 0 ? (
            <p className="text-sm text-muted-foreground py-2">Keine aktiven Touren.</p>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {touren.map(t => {
                const col = scoreColor(t.score);
                const sla = slaStyle(t.sla_status);
                const stoppProgress = t.stopps_gesamt > 0
                  ? Math.round(((t.stopps_gesamt - t.stopps_offen) / t.stopps_gesamt) * 100)
                  : 100;
                return (
                  <div key={t.tour_id} className={cn('rounded-xl border p-3 flex gap-3', col.bg)}>
                    {/* Gauge */}
                    <div className="shrink-0 flex flex-col items-center">
                      <ScoreGauge score={t.score} color={col.arc} />
                      <div className={cn('text-[9px] font-bold mt-0.5', col.text)}>Score</div>
                    </div>

                    {/* Details */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-1">
                        <div>
                          <div className="text-sm font-bold truncate">{t.fahrer_name}</div>
                          {t.zone && (
                            <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                              <MapPin className="h-2.5 w-2.5" /> Zone {t.zone}
                            </div>
                          )}
                        </div>
                        <div className="flex flex-col items-end gap-1">
                          <span className={cn('text-[9px] font-black rounded-full px-1.5 py-0.5', sla.badge)}>
                            {sla.label}
                          </span>
                          {/* Trend */}
                          <div className={cn('flex items-center gap-0.5 text-[10px] font-bold',
                            t.score_trend > 0 ? 'text-matcha-600 dark:text-matcha-400' : t.score_trend < 0 ? 'text-red-600 dark:text-red-400' : 'text-zinc-400',
                          )}>
                            {t.score_trend > 0 ? <TrendingUp className="h-3 w-3" /> : t.score_trend < 0 ? <TrendingDown className="h-3 w-3" /> : <Minus className="h-3 w-3" />}
                            {t.score_trend > 0 ? '+' : ''}{t.score_trend}
                          </div>
                        </div>
                      </div>

                      {/* Stopp-Fortschritt */}
                      <div className="mt-2">
                        <div className="flex items-center justify-between text-[9px] text-muted-foreground mb-0.5">
                          <span>Stopps</span>
                          <span className="font-bold tabular-nums">{t.stopps_gesamt - t.stopps_offen}/{t.stopps_gesamt}</span>
                        </div>
                        <div className="h-1.5 rounded-full bg-black/10 dark:bg-white/10 overflow-hidden">
                          <div
                            className={cn('h-full rounded-full transition-all', t.sla_status === 'verletzt' ? 'bg-red-500' : t.sla_status === 'gefaehrdet' ? 'bg-amber-500' : 'bg-matcha-500')}
                            style={{ width: `${stoppProgress}%` }}
                          />
                        </div>
                      </div>

                      {/* ETA + Bewertung */}
                      <div className="mt-1.5 flex items-center gap-3 text-[9px] text-muted-foreground">
                        {t.eta_min_verbleibend !== null && (
                          <span className="flex items-center gap-0.5">
                            <Clock className="h-2.5 w-2.5" /> ~{t.eta_min_verbleibend} Min
                          </span>
                        )}
                        {t.bewertung_akt !== null && (
                          <span className="flex items-center gap-0.5">
                            <Star className="h-2.5 w-2.5" /> {t.bewertung_akt.toFixed(1)}
                          </span>
                        )}
                        {t.stopps_offen === 0 && (
                          <span className="text-matcha-600 dark:text-matcha-400 font-bold">Tour abgeschlossen</span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
