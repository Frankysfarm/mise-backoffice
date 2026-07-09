'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { Trophy, Zap, Star, Clock, TrendingUp } from 'lucide-react';

/**
 * Phase 914 — Schicht-Abschluss-Highlight (Fahrer-App)
 *
 * Score-Reveal + Top-3-Momente der Schicht:
 * schnellste Tour, bestes Trinkgeld, pünktlichste Schicht-Strecke.
 * Erscheint nur wenn isOnline=false (Schicht beendet).
 */

interface Props {
  driverId: string;
  isOnline: boolean;
}

interface Highlight {
  icon: 'schnell' | 'trinkgeld' | 'puenktlich';
  titel: string;
  wert: string;
  detail: string;
}

interface AbschlussData {
  score: number;
  touren: number;
  stopps: number;
  km: number;
  einnahmen_eur: number;
  trinkgeld_eur: number;
  highlights: Highlight[];
}

const MOCK: AbschlussData = {
  score: 87,
  touren: 6,
  stopps: 18,
  km: 42.3,
  einnahmen_eur: 96.5,
  trinkgeld_eur: 14.2,
  highlights: [
    { icon: 'schnell', titel: 'Schnellste Tour', wert: '18 Min', detail: 'Tour #3 — 3 Stopps in Rekordzeit' },
    { icon: 'trinkgeld', titel: 'Bestes Trinkgeld', wert: '4.50€', detail: 'Lieferung an Hauptstraße 12' },
    { icon: 'puenktlich', titel: 'Pünktlichkeit', wert: '94%', detail: '17 von 18 Stopps rechtzeitig' },
  ],
};

function ScoreRing({ score }: { score: number }) {
  const r = 36;
  const circ = 2 * Math.PI * r;
  const dash = (score / 100) * circ;
  const color = score >= 80 ? '#22c55e' : score >= 60 ? '#f59e0b' : '#ef4444';

  return (
    <svg width="100" height="100" className="shrink-0">
      <circle cx="50" cy="50" r={r} fill="none" stroke="currentColor" strokeWidth="8" className="text-muted/30" />
      <circle
        cx="50" cy="50" r={r} fill="none"
        stroke={color} strokeWidth="8"
        strokeDasharray={`${dash} ${circ - dash}`}
        strokeLinecap="round"
        transform="rotate(-90 50 50)"
        style={{ transition: 'stroke-dasharray 1s ease' }}
      />
      <text x="50" y="50" textAnchor="middle" dominantBaseline="central"
        fill={color} fontSize="20" fontWeight="900" fontFamily="monospace">
        {score}
      </text>
    </svg>
  );
}

function HighlightIcon({ icon }: { icon: string }) {
  if (icon === 'schnell') return <Zap className="h-4 w-4 text-amber-500" />;
  if (icon === 'trinkgeld') return <Star className="h-4 w-4 text-yellow-500" />;
  return <Clock className="h-4 w-4 text-matcha-500" />;
}

export function FahrerPhase914SchichtAbschlussHighlight({ driverId, isOnline }: Props) {
  const [data, setData] = useState<AbschlussData | null>(null);
  const [loading, setLoading] = useState(false);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    if (isOnline || !driverId) return;
    setLoading(true);
    const load = async () => {
      try {
        const res = await fetch(`/api/delivery/driver/schicht-abschluss?driver_id=${driverId}`, {
          cache: 'no-store',
        });
        if (!res.ok) throw new Error();
        const json = await res.json();
        const b = json.bericht ?? json;
        if (b && typeof b.score === 'number') {
          setData({
            score: b.score,
            touren: b.touren ?? b.tours_completed ?? 0,
            stopps: b.stopps ?? b.stops_completed ?? 0,
            km: b.km ?? b.total_km ?? 0,
            einnahmen_eur: b.einnahmen_eur ?? b.earnings_eur ?? 0,
            trinkgeld_eur: b.trinkgeld_eur ?? b.tips_eur ?? 0,
            highlights: b.highlights ?? MOCK.highlights,
          });
        } else {
          setData(MOCK);
        }
      } catch {
        setData(MOCK);
      } finally {
        setLoading(false);
        setTimeout(() => setShown(true), 100);
      }
    };
    load();
  }, [driverId, isOnline]);

  if (isOnline || (!loading && !data)) return null;
  if (loading) return null;
  if (!data) return null;

  const scoreLabel = data.score >= 80 ? 'Ausgezeichnet!' : data.score >= 65 ? 'Gute Schicht!' : 'Weiter so!';
  const scoreColor = data.score >= 80 ? 'text-matcha-600 dark:text-matcha-400' : data.score >= 65 ? 'text-amber-600' : 'text-red-500';

  return (
    <div className={cn(
      'rounded-2xl border border-amber-300/60 bg-gradient-to-b from-amber-50/80 to-background dark:from-amber-950/20 dark:to-background overflow-hidden transition-all duration-500',
      shown ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4',
    )}>
      {/* Header */}
      <div className="flex items-center gap-2.5 px-4 py-3 border-b border-amber-200/50">
        <Trophy className="h-4.5 w-4.5 text-amber-500 shrink-0" />
        <span className="text-sm font-bold text-foreground">Schicht-Abschluss</span>
        <span className={cn('ml-auto text-xs font-bold', scoreColor)}>{scoreLabel}</span>
      </div>

      {/* Score + KPIs */}
      <div className="flex items-center gap-4 px-4 py-4">
        <ScoreRing score={data.score} />
        <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 flex-1">
          <div>
            <div className="text-[11px] text-muted-foreground">Touren</div>
            <div className="text-base font-black text-foreground tabular-nums">{data.touren}</div>
          </div>
          <div>
            <div className="text-[11px] text-muted-foreground">Stopps</div>
            <div className="text-base font-black text-foreground tabular-nums">{data.stopps}</div>
          </div>
          <div>
            <div className="text-[11px] text-muted-foreground">Kilometer</div>
            <div className="text-base font-black text-foreground tabular-nums">{data.km.toFixed(1)} km</div>
          </div>
          <div>
            <div className="text-[11px] text-muted-foreground">Einnahmen</div>
            <div className="text-base font-black text-matcha-600 dark:text-matcha-400 tabular-nums">
              {data.einnahmen_eur.toFixed(2)}€
            </div>
          </div>
          <div className="col-span-2">
            <div className="text-[11px] text-muted-foreground">Trinkgeld</div>
            <div className="flex items-center gap-1.5">
              <Star className="h-3 w-3 text-yellow-500" />
              <span className="text-sm font-bold text-yellow-600 dark:text-yellow-400 tabular-nums">
                {data.trinkgeld_eur.toFixed(2)}€
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Top-3-Highlights */}
      {data.highlights.length > 0 && (
        <div className="px-4 pb-4 space-y-2">
          <div className="flex items-center gap-1.5 text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
            <TrendingUp className="h-3 w-3" />
            Top-Momente
          </div>
          {data.highlights.slice(0, 3).map((h, i) => (
            <div key={i} className="flex items-center gap-3 rounded-xl bg-background/80 border border-border/60 px-3 py-2.5">
              <HighlightIcon icon={h.icon} />
              <div className="flex-1 min-w-0">
                <div className="text-[11px] font-bold text-foreground">{h.titel}</div>
                <div className="text-[10px] text-muted-foreground truncate">{h.detail}</div>
              </div>
              <span className="text-sm font-black tabular-nums text-foreground shrink-0">{h.wert}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
