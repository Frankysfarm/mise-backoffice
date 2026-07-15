'use client';

import { useEffect, useState } from 'react';
import { Star, Zap, CheckCircle2, Clock, TrendingUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import { euro } from '@/lib/utils';

type Props = {
  driverId: string | null;
  locationId: string | null;
};

type ShiftScore = {
  score: number;
  deliveries: number;
  onTimePct: number;
  avgRating: number | null;
  earningsEur: number;
  trend: 'up' | 'down' | 'flat';
};

const MOCK_SCORE: ShiftScore = {
  score: 83,
  deliveries: 7,
  onTimePct: 86,
  avgRating: 4.7,
  earningsEur: 52.4,
  trend: 'up',
};

function ScoreArc({ score }: { score: number }) {
  const r = 28;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - Math.min(100, score) / 100);
  const color = score >= 80 ? '#4a7c59' : score >= 60 ? '#f59e0b' : '#ef4444';
  return (
    <svg width="72" height="72" viewBox="0 0 72 72">
      <circle cx="36" cy="36" r={r} fill="none" stroke="#e5e7eb" strokeWidth="6" />
      <circle
        cx="36" cy="36" r={r} fill="none"
        stroke={color} strokeWidth="6"
        strokeDasharray={circ}
        strokeDashoffset={offset}
        strokeLinecap="round"
        transform="rotate(-90 36 36)"
        style={{ transition: 'stroke-dashoffset 0.8s ease' }}
      />
      <text x="36" y="40" textAnchor="middle" fontSize="14" fontWeight="900" fill={color}>
        {Math.round(score)}
      </text>
      <text x="36" y="52" textAnchor="middle" fontSize="8" fill="#9ca3af">Score</text>
    </svg>
  );
}

export function FahrerPhase1701LiveSchichtPerformanceScore({ driverId, locationId }: Props) {
  const [data, setData] = useState<ShiftScore | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!driverId) {
      setData(MOCK_SCORE);
      return;
    }

    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        const r = await fetch(
          `/api/delivery/driver/score?driver_id=${encodeURIComponent(driverId)}${locationId ? `&location_id=${encodeURIComponent(locationId)}` : ''}`,
        );
        if (!r.ok) throw new Error('fetch failed');
        const d = await r.json();
        if (!cancelled) {
          setData({
            score: d.score ?? d.gesamtScore ?? MOCK_SCORE.score,
            deliveries: d.deliveries ?? d.lieferungen ?? MOCK_SCORE.deliveries,
            onTimePct: d.onTimePct ?? d.puenktlichkeit ?? MOCK_SCORE.onTimePct,
            avgRating: d.avgRating ?? d.bewertung ?? MOCK_SCORE.avgRating,
            earningsEur: d.earningsEur ?? d.einnahmen ?? MOCK_SCORE.earningsEur,
            trend: d.trend ?? MOCK_SCORE.trend,
          });
        }
      } catch {
        if (!cancelled) setData(MOCK_SCORE);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    const iv = setInterval(load, 60_000);
    return () => { cancelled = true; clearInterval(iv); };
  }, [driverId, locationId]);

  if (!data && loading) return null;
  const d = data ?? MOCK_SCORE;

  const kpis = [
    { icon: CheckCircle2, label: 'Lieferungen', value: String(d.deliveries), color: 'text-matcha-600' },
    { icon: Clock,        label: 'Pünktlich',   value: `${d.onTimePct}%`,    color: d.onTimePct >= 80 ? 'text-matcha-600' : 'text-amber-600' },
    { icon: Star,         label: 'Bewertung',   value: d.avgRating != null ? String(d.avgRating.toFixed(1)) : '—', color: 'text-amber-500' },
    { icon: Zap,          label: 'Einnahmen',   value: euro(d.earningsEur),  color: 'text-blue-600' },
  ];

  return (
    <div className="rounded-xl border bg-card overflow-hidden">
      <div className="flex items-center gap-2 border-b bg-muted/30 px-4 py-2.5">
        <TrendingUp className="h-4 w-4 text-matcha-600" />
        <span className="font-display text-sm font-bold uppercase tracking-wider">
          Live-Schicht-Performance
        </span>
        {d.trend === 'up' && <span className="text-[10px] font-bold text-matcha-700">↑ Trend</span>}
        {d.trend === 'down' && <span className="text-[10px] font-bold text-red-600">↓ Trend</span>}
      </div>

      <div className="flex items-center gap-4 p-4">
        <ScoreArc score={d.score} />
        <div className="grid grid-cols-2 gap-x-4 gap-y-2 flex-1">
          {kpis.map(({ icon: Icon, label, value, color }) => (
            <div key={label} className="flex items-center gap-1.5">
              <Icon className={cn('h-3.5 w-3.5 shrink-0', color)} />
              <div>
                <div className={cn('text-sm font-bold tabular-nums', color)}>{value}</div>
                <div className="text-[10px] text-muted-foreground">{label}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
