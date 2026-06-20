'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { euro } from '@/lib/utils';
import { TrendingUp, TrendingDown, Users, Loader2 } from 'lucide-react';
import { Card } from '@/components/ui/card';

type DriverMetrics = {
  name: string;
  deliveries: number;
  onTimePct: number;
  avgMinutes: number;
  tipsEur: number;
  score: number;
};

const MOCK_TOP: DriverMetrics[] = [
  { name: 'Mehmet Y.', deliveries: 14, onTimePct: 93, avgMinutes: 22, tipsEur: 8.5, score: 91 },
  { name: 'Sarah K.', deliveries: 12, onTimePct: 88, avgMinutes: 24, tipsEur: 6.0, score: 85 },
  { name: 'Jonas B.', deliveries: 11, onTimePct: 82, avgMinutes: 25, tipsEur: 5.5, score: 80 },
];
const MOCK_BOT: DriverMetrics[] = [
  { name: 'Leon W.', deliveries: 5, onTimePct: 60, avgMinutes: 38, tipsEur: 1.5, score: 54 },
  { name: 'Tina R.', deliveries: 4, onTimePct: 55, avgMinutes: 41, tipsEur: 0.5, score: 49 },
  { name: 'Paul F.', deliveries: 3, onTimePct: 50, avgMinutes: 45, tipsEur: 0.0, score: 42 },
];

function ScoreBar({ pct, color }: { pct: number; color: string }) {
  return (
    <div className="h-1.5 w-full rounded-full bg-black/10 overflow-hidden">
      <div className={cn('h-full rounded-full transition-all duration-700', color)} style={{ width: `${pct}%` }} />
    </div>
  );
}

function DriverRow({ driver, rank, variant }: { driver: DriverMetrics; rank: number; variant: 'top' | 'bottom' }) {
  const isTop = variant === 'top';
  return (
    <div className={cn('flex items-center gap-3 rounded-xl border px-3 py-2.5', isTop ? 'border-matcha-200 bg-matcha-50' : 'border-red-100 bg-red-50')}>
      <div className={cn('flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-black text-white', isTop ? 'bg-matcha-500' : 'bg-red-400')}>
        {isTop ? rank : ''}
        {!isTop && <span className="text-xs">#{rank}</span>}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[13px] font-bold truncate">{driver.name}</span>
          <span className={cn('text-[11px] font-black tabular-nums', isTop ? 'text-matcha-700' : 'text-red-600')}>
            {driver.score}
          </span>
        </div>
        <ScoreBar pct={driver.score} color={isTop ? 'bg-matcha-500' : 'bg-red-400'} />
        <div className="mt-1 flex items-center gap-3 text-[10px] text-muted-foreground flex-wrap">
          <span>{driver.deliveries} Touren</span>
          <span>{driver.onTimePct}% pünktl.</span>
          <span>ø {driver.avgMinutes} Min</span>
          <span className="text-yellow-600 font-semibold">{euro(driver.tipsEur)} ★</span>
        </div>
      </div>
    </div>
  );
}

type Props = { locationId?: string };

export function LieferdienstFahrerLeistungsVergleich({ locationId }: Props) {
  const [top, setTop] = useState<DriverMetrics[]>([]);
  const [bottom, setBottom] = useState<DriverMetrics[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = () => {
      // TODO: Replace with real API once /api/delivery/admin/driver-leaderboard is available
      // fetch(`/api/delivery/admin/driver-leaderboard?location_id=${locationId}&today=true`)
      //   .then(r => r.json())
      //   .then(d => { setTop(d.top); setBottom(d.bottom); })
      //   .catch(() => { setTop(MOCK_TOP); setBottom(MOCK_BOT); })
      //   .finally(() => setLoading(false));
      setTop(MOCK_TOP);
      setBottom(MOCK_BOT);
      setLoading(false);
    };
    load();
    const id = setInterval(load, 5 * 60_000);
    return () => clearInterval(id);
  }, [locationId]);

  if (loading) {
    return (
      <div className="rounded-2xl border bg-white p-5 flex items-center gap-2">
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        <span className="text-sm text-muted-foreground">Lade Fahrer-Vergleich…</span>
      </div>
    );
  }

  return (
    <Card className="overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 border-b">
        <Users className="h-4 w-4 text-matcha-600 shrink-0" />
        <span className="text-xs font-bold uppercase tracking-wider">Fahrer-Leistungsvergleich</span>
        <span className="ml-auto text-[10px] text-muted-foreground">Heute · Mock-Daten</span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x">
        {/* Top performers */}
        <div className="p-4 space-y-2">
          <div className="flex items-center gap-1.5 mb-3">
            <TrendingUp className="h-3.5 w-3.5 text-matcha-600" />
            <span className="text-xs font-bold text-matcha-700 uppercase tracking-wide">Top Fahrer</span>
          </div>
          {top.map((d, i) => (
            <DriverRow key={d.name} driver={d} rank={i + 1} variant="top" />
          ))}
        </div>

        {/* Bottom performers */}
        <div className="p-4 space-y-2">
          <div className="flex items-center gap-1.5 mb-3">
            <TrendingDown className="h-3.5 w-3.5 text-red-500" />
            <span className="text-xs font-bold text-red-600 uppercase tracking-wide">Verbesserungsbedarf</span>
          </div>
          {bottom.map((d, i) => (
            <DriverRow key={d.name} driver={d} rank={i + 1} variant="bottom" />
          ))}
        </div>
      </div>

      <div className="px-4 py-2 border-t bg-muted/20">
        <span className="text-[10px] text-muted-foreground">
          Score: Pünktlichkeit (50%) + Touren (30%) + Trinkgeld (20%) · 5-Min-Refresh
        </span>
      </div>
    </Card>
  );
}
