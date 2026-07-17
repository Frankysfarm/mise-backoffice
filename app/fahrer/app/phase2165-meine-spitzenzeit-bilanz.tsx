'use client';

import { useEffect, useState } from 'react';
import { Zap, TrendingUp, TrendingDown, ChevronDown, ChevronUp, Trophy } from 'lucide-react';
import { cn } from '@/lib/utils';

type SpitzenzeitData = {
  auftraege_spitze: number;
  auftraege_normal: number;
  peak_score: number;
  trend_7tage: number;
};

function scoreColor(score: number): string {
  if (score >= 80) return 'text-emerald-600';
  if (score >= 60) return 'text-amber-600';
  return 'text-red-600';
}

function motivationText(score: number): string {
  if (score >= 80) return 'Hervorragend! Du bist in der Stoßzeit top dabei.';
  if (score >= 60) return 'Solide — noch mehr Einsatz in der Rush-Hour zahlt sich aus!';
  return 'Tipp: Plane deine Schicht für 12–14 Uhr & 18–21 Uhr ein — da verdient man am meisten.';
}

export function FahrerPhase2165MeineSpitzenzeitBilanz({
  driverId,
  locationId,
  isOnline,
}: {
  driverId: string | null;
  locationId: string | null;
  isOnline: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<SpitzenzeitData | null>(null);
  const [teamAvg, setTeamAvg] = useState<number | null>(null);

  useEffect(() => {
    if (!isOnline || !driverId || !locationId) return;
    const load = () =>
      fetch(`/api/delivery/admin/fahrer-spitzenzeit?location_id=${locationId}`)
        .then((r) => r.json())
        .then((d) => {
          const drivers: SpitzenzeitData[] = d.drivers ?? [];
          const me = (d.drivers ?? []).find((f: { fahrer_id: string }) => f.fahrer_id === driverId);
          if (me) {
            setData({
              auftraege_spitze: me.auftraege_spitze,
              auftraege_normal: me.auftraege_normal,
              peak_score: me.peak_score,
              trend_7tage: me.trend_7tage,
            });
          }
          if (drivers.length) {
            const avg = Math.round(
              drivers.reduce((s, f) => s + f.peak_score, 0) / drivers.length,
            );
            setTeamAvg(avg);
          }
        })
        .catch(() => {});
    load();
    const t = setInterval(load, 60 * 60 * 1000);
    return () => clearInterval(t);
  }, [isOnline, driverId, locationId]);

  if (!isOnline || !data) return null;

  const improving = data.peak_score > data.trend_7tage;
  const badge = data.peak_score >= 80;

  return (
    <div className="rounded-xl border border-border bg-card text-sm">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-4 py-3"
      >
        <div className="flex items-center gap-2 font-semibold">
          <Zap className="h-4 w-4 text-amber-500" />
          Meine Spitzenzeit-Bilanz
          {badge && (
            <span className="rounded-full bg-amber-400/20 px-2 py-0.5 text-xs font-semibold text-amber-600">
              ⚡ Rush-Hour-Profi
            </span>
          )}
        </div>
        {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
      </button>

      {open && (
        <div className="border-t border-border px-4 pb-4 pt-3 space-y-3">
          <div className="flex items-end gap-2">
            <span className={cn('text-3xl font-bold tabular-nums', scoreColor(data.peak_score))}>
              {data.peak_score}
            </span>
            <span className="text-muted-foreground mb-1">% Peak-Score</span>
            {improving ? (
              <TrendingUp className="h-4 w-4 text-emerald-500 mb-1" />
            ) : (
              <TrendingDown className="h-4 w-4 text-red-400 mb-1" />
            )}
          </div>

          <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
            <div
              className={cn(
                'h-full rounded-full transition-all',
                data.peak_score >= 80
                  ? 'bg-emerald-500'
                  : data.peak_score >= 60
                  ? 'bg-amber-400'
                  : 'bg-red-500',
              )}
              style={{ width: `${data.peak_score}%` }}
            />
          </div>

          <div className="grid grid-cols-3 gap-2 text-xs">
            <div className="rounded-lg bg-muted/50 p-2 text-center">
              <div className="font-bold text-amber-600 text-base">{data.auftraege_spitze}</div>
              <div className="text-muted-foreground">Stoßzeit</div>
            </div>
            <div className="rounded-lg bg-muted/50 p-2 text-center">
              <div className="font-bold text-foreground text-base">{data.auftraege_normal}</div>
              <div className="text-muted-foreground">Normalzeit</div>
            </div>
            {teamAvg !== null && (
              <div className="rounded-lg bg-muted/50 p-2 text-center">
                <div className="font-bold text-primary text-base">{teamAvg}%</div>
                <div className="text-muted-foreground">Team-Ø</div>
              </div>
            )}
          </div>

          <div className="flex items-start gap-2 rounded-lg bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
            <Trophy className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-500" />
            <span>{motivationText(data.peak_score)}</span>
          </div>
        </div>
      )}
    </div>
  );
}
