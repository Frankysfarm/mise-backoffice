'use client';

import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, ChevronDown, ChevronUp, MessageSquare, Minus, TrendingDown, TrendingUp } from 'lucide-react';
import { cn } from '@/lib/utils';

interface FahrerFeedback {
  fahrer_id: string;
  name: string;
  avg_sterne: number;
  anzahl_bewertungen: number;
  trend: 'steigend' | 'fallend' | 'stabil';
  trend_delta: number;
  alert: boolean;
  rang: number;
}

interface ApiData {
  fahrer: FahrerFeedback[];
  team_durchschnitt: number;
}

const MOCK: ApiData = {
  team_durchschnitt: 4.2,
  fahrer: [
    { fahrer_id: 'f1', name: 'Max Müller',   avg_sterne: 4.8, anzahl_bewertungen: 12, trend: 'steigend', trend_delta: 0.3,  alert: false, rang: 1 },
    { fahrer_id: 'f2', name: 'Lena Schmidt',  avg_sterne: 4.2, anzahl_bewertungen: 8,  trend: 'stabil',   trend_delta: 0.0,  alert: false, rang: 2 },
    { fahrer_id: 'f3', name: 'Tom Becker',    avg_sterne: 3.1, anzahl_bewertungen: 5,  trend: 'fallend',  trend_delta: -0.6, alert: true,  rang: 3 },
  ],
};

function starColor(avg: number) {
  if (avg >= 4.5) return 'text-green-600';
  if (avg >= 3.5) return 'text-amber-600';
  return 'text-red-600';
}

function Stars({ value }: { value: number }) {
  return (
    <span className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map(i => (
        <svg key={i} className={cn('h-3 w-3', value >= i ? 'fill-amber-400 text-amber-400' : 'fill-muted text-muted')} viewBox="0 0 24 24">
          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
        </svg>
      ))}
    </span>
  );
}

interface Props { locationId: string | null }

export function DispatchPhase2144FeedbackScoreBoard({ locationId }: Props) {
  const [open, setOpen]       = useState(true);
  const [data, setData]       = useState<ApiData>(MOCK);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!locationId) return;
    setLoading(true);
    try {
      const r = await fetch(`/api/delivery/admin/fahrer-feedback-score?location_id=${locationId}`, { cache: 'no-store' });
      if (r.ok) setData(await r.json());
    } catch { /* use mock */ } finally { setLoading(false); }
  }, [locationId]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const id = setInterval(load, 30 * 60 * 1000);
    return () => clearInterval(id);
  }, [load]);

  const alertList = data.fahrer.filter(f => f.alert);
  const hasAlert  = alertList.length > 0;

  return (
    <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
      <button
        className="w-full flex items-center gap-2 px-4 py-2.5 border-b hover:bg-muted/30 transition-colors"
        onClick={() => setOpen(o => !o)}
      >
        <MessageSquare className="h-4 w-4 text-amber-500 shrink-0" />
        <span className="text-xs font-bold uppercase tracking-wider flex-1 text-left">Feedback-Score-Board</span>
        {hasAlert && (
          <span className="flex items-center gap-1 text-[9px] font-bold text-red-600 bg-red-100 border border-red-200 rounded-full px-2 py-0.5">
            <AlertTriangle className="h-2.5 w-2.5" />{alertList.length} NIEDRIG
          </span>
        )}
        {loading && <span className="text-[9px] text-muted-foreground">…</span>}
        {open ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />}
      </button>

      {open && (
        <div className="p-3 space-y-3">
          <div className="rounded-lg bg-muted/30 border px-3 py-2 flex items-center gap-3">
            <div>
              <p className="text-[9px] text-muted-foreground uppercase tracking-wide">Team-Ø Bewertung</p>
              <p className={cn('text-xl font-black tabular-nums', starColor(data.team_durchschnitt))}>
                ★ {data.team_durchschnitt.toFixed(1)}
              </p>
            </div>
            <div className="ml-auto text-right">
              <p className="text-[9px] text-muted-foreground">Ziel: ≥ 4.0</p>
            </div>
          </div>

          {hasAlert && (
            <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 flex items-start gap-2">
              <AlertTriangle className="h-3.5 w-3.5 text-red-600 mt-0.5 shrink-0" />
              <p className="text-[11px] text-red-700 font-medium leading-snug">
                {alertList.map(f => f.name).join(', ')} — Bewertung unter 3.5 ★. Coaching empfohlen.
              </p>
            </div>
          )}

          <div className="space-y-2">
            {data.fahrer.map(f => (
              <div key={f.fahrer_id} className={cn(
                'rounded-lg border p-2.5 space-y-1',
                f.alert ? 'bg-red-50 border-red-200' : 'bg-muted/10',
              )}>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-muted-foreground font-bold w-4 shrink-0">#{f.rang}</span>
                  <span className="text-[11px] font-semibold flex-1 truncate">{f.name}</span>
                  <div className="flex items-center gap-1.5">
                    {f.trend === 'steigend' && <TrendingUp   className="h-3 w-3 text-green-500" />}
                    {f.trend === 'fallend'  && <TrendingDown className="h-3 w-3 text-red-500" />}
                    {f.trend === 'stabil'   && <Minus        className="h-3 w-3 text-muted-foreground" />}
                    <span className={cn('text-sm font-black tabular-nums', starColor(f.avg_sterne))}>
                      {f.avg_sterne.toFixed(1)}
                    </span>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <Stars value={f.avg_sterne} />
                  <span className="text-[9px] text-muted-foreground">{f.anzahl_bewertungen} Bewertung{f.anzahl_bewertungen !== 1 ? 'en' : ''}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
