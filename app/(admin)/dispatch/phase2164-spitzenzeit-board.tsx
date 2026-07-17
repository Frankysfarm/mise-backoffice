'use client';

import { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, Zap, AlertTriangle, TrendingUp, TrendingDown, Users } from 'lucide-react';
import { cn } from '@/lib/utils';

type FahrerSpitzenzeit = {
  fahrer_id: string;
  name: string;
  auftraege_spitze: number;
  auftraege_normal: number;
  peak_score: number;
  trend_7tage: number;
};

function ampel(score: number): { color: string; label: string; bar: string } {
  if (score >= 80) return { color: 'text-emerald-600', label: 'Stark', bar: 'bg-emerald-500' };
  if (score >= 60) return { color: 'text-amber-600', label: 'OK', bar: 'bg-amber-400' };
  return { color: 'text-red-600', label: 'Schwach', bar: 'bg-red-500' };
}

export function DispatchPhase2164SpitzenzeitBoard({ locationId }: { locationId: string | null }) {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<FahrerSpitzenzeit[]>([]);

  useEffect(() => {
    if (!locationId) return;
    const load = () =>
      fetch(`/api/delivery/admin/fahrer-spitzenzeit?location_id=${locationId}`)
        .then((r) => r.json())
        .then((d) => setData(d.drivers ?? []))
        .catch(() => {});
    load();
    const t = setInterval(load, 30 * 60 * 1000);
    return () => clearInterval(t);
  }, [locationId]);

  const alerts = data.filter((d) => d.peak_score < 60);
  const teamAvg = data.length
    ? Math.round(data.reduce((s, d) => s + d.peak_score, 0) / data.length)
    : 0;

  if (!data.length) return null;

  return (
    <div className="rounded-xl border border-border bg-card text-sm">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-4 py-3"
      >
        <div className="flex items-center gap-2 font-semibold">
          <Zap className="h-4 w-4 text-amber-500" />
          Spitzenzeit-Performance
          {alerts.length > 0 && (
            <span className="ml-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-xs font-medium text-amber-600">
              {alerts.length} unter 60%
            </span>
          )}
        </div>
        {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
      </button>

      {open && (
        <div className="border-t border-border px-4 pb-4 pt-3 space-y-3">
          <div className="text-xs text-muted-foreground">
            Ø Team Peak-Score: <span className="font-semibold text-foreground">{teamAvg}%</span>
            <span className="ml-2 text-muted-foreground">· Stoßzeiten: 12–14 Uhr & 18–21 Uhr</span>
          </div>

          {alerts.length > 0 && (
            <div className="flex items-start gap-2 rounded-lg bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-400">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>
                {alerts.length} Fahrer mit niedrigem Peak-Score — Verstärkung in Stoßzeiten empfehlen?
              </span>
            </div>
          )}

          <div className="space-y-2">
            {[...data].sort((a, b) => b.peak_score - a.peak_score).map((d) => {
              const a = ampel(d.peak_score);
              const improving = d.peak_score > d.trend_7tage;

              return (
                <div key={d.fahrer_id} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1.5">
                      <span className="font-medium">{d.name}</span>
                      {improving ? (
                        <TrendingUp className="h-3 w-3 text-emerald-500" />
                      ) : (
                        <TrendingDown className="h-3 w-3 text-red-400" />
                      )}
                      <span className="text-muted-foreground">
                        ({d.auftraege_spitze} Stoßzeit · {d.auftraege_normal} Normal)
                      </span>
                    </div>
                    <span className={cn('font-semibold', a.color)}>{d.peak_score}%</span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className={cn('h-full rounded-full transition-all', a.bar)}
                      style={{ width: `${d.peak_score}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex items-start gap-2 rounded-lg bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
            <Users className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
            <span>Tipp: Fahrer mit Peak-Score &lt;60% gezielt für 12–14 & 18–21 Uhr einplanen.</span>
          </div>
        </div>
      )}
    </div>
  );
}
