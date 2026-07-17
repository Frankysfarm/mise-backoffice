'use client';

import { useCallback, useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, Lightbulb, MessageSquare, Minus, TrendingDown, TrendingUp } from 'lucide-react';
import { cn } from '@/lib/utils';

interface FahrerFeedback {
  fahrer_id: string;
  name: string;
  avg_sterne: number;
  anzahl_bewertungen: number;
  trend: 'steigend' | 'fallend' | 'stabil';
  trend_delta: number;
  alert: boolean;
}

interface ApiData {
  fahrer: FahrerFeedback[];
  team_durchschnitt: number;
}

const MOCK: ApiData = {
  team_durchschnitt: 4.2,
  fahrer: [
    { fahrer_id: 'f1', name: 'Max Müller',   avg_sterne: 4.8, anzahl_bewertungen: 12, trend: 'steigend', trend_delta: 0.3,  alert: false },
    { fahrer_id: 'f2', name: 'Lena Schmidt',  avg_sterne: 4.2, anzahl_bewertungen: 8,  trend: 'stabil',   trend_delta: 0.0,  alert: false },
    { fahrer_id: 'f3', name: 'Tom Becker',    avg_sterne: 3.1, anzahl_bewertungen: 5,  trend: 'fallend',  trend_delta: -0.6, alert: true  },
  ],
};

function tipp(avg: number, trend: string): string {
  if (avg >= 4.8) return 'Hervorragend! Du gehörst zu den bestbewerteten Fahrern heute.';
  if (avg >= 4.5) return 'Sehr gute Bewertungen! Weiter so — Freundlichkeit und Pünktlichkeit zahlen sich aus.';
  if (trend === 'fallend') return 'Deine Bewertung sinkt — achte auf freundliche Kommunikation und pünktliche Lieferung.';
  if (avg >= 3.5) return 'Solide Bewertung. Ein Lächeln und kurze Wartezeiten können Kunden begeistern.';
  return 'Bewertung unter 3.5 — sprich mit deinem Teamleiter für Coaching-Tipps.';
}

function starColor(avg: number) {
  if (avg >= 4.5) return 'text-green-600';
  if (avg >= 3.5) return 'text-amber-600';
  return 'text-red-600';
}

function Stars({ value }: { value: number }) {
  return (
    <span className="flex gap-1">
      {[1, 2, 3, 4, 5].map(i => (
        <svg key={i} className={cn('h-4 w-4', value >= i ? 'fill-amber-400 text-amber-400' : 'fill-muted text-muted')} viewBox="0 0 24 24">
          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
        </svg>
      ))}
    </span>
  );
}

interface Props {
  driverId: string | null;
  locationId: string | null;
  isOnline: boolean;
}

export function FahrerPhase2145MeinFeedbackScore({ driverId, locationId, isOnline }: Props) {
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
    const id = setInterval(load, 60 * 60 * 1000);
    return () => clearInterval(id);
  }, [load]);

  if (!isOnline) return null;

  const mein = data.fahrer.find(f => f.fahrer_id === driverId) ?? data.fahrer[0];
  if (!mein) return null;

  const vsTeam = Math.round((mein.avg_sterne - data.team_durchschnitt) * 10) / 10;

  return (
    <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
      <button
        className="w-full flex items-center gap-2 px-4 py-2.5 border-b hover:bg-muted/30 transition-colors"
        onClick={() => setOpen(o => !o)}
      >
        <MessageSquare className="h-4 w-4 text-amber-500 shrink-0" />
        <span className="text-xs font-bold uppercase tracking-wider flex-1 text-left">Mein Feedback-Score</span>
        <span className={cn('text-xs font-black tabular-nums', starColor(mein.avg_sterne))}>★ {mein.avg_sterne.toFixed(1)}</span>
        {loading && <span className="text-[9px] text-muted-foreground">…</span>}
        {open ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />}
      </button>

      {open && (
        <div className="p-3 space-y-3">
          <div className="flex items-center gap-3">
            <div>
              <p className="text-[9px] text-muted-foreground uppercase tracking-wide">Ø Bewertung heute</p>
              <p className={cn('text-3xl font-black tabular-nums', starColor(mein.avg_sterne))}>{mein.avg_sterne.toFixed(1)}</p>
              <Stars value={mein.avg_sterne} />
            </div>
            <div className="ml-auto text-right space-y-0.5">
              <p className="text-[9px] text-muted-foreground">Team-Ø ★ {data.team_durchschnitt.toFixed(1)}</p>
              <p className={cn('text-[10px] font-semibold', vsTeam >= 0 ? 'text-green-600' : 'text-red-600')}>
                {vsTeam >= 0 ? '+' : ''}{vsTeam} vs. Team
              </p>
              <div className="flex items-center justify-end gap-1">
                {mein.trend === 'steigend' && <TrendingUp   className="h-3 w-3 text-green-500" />}
                {mein.trend === 'fallend'  && <TrendingDown className="h-3 w-3 text-red-500" />}
                {mein.trend === 'stabil'   && <Minus        className="h-3 w-3 text-muted-foreground" />}
                <span className="text-[9px] text-muted-foreground">
                  {mein.trend === 'steigend' ? 'verbessert' : mein.trend === 'fallend' ? 'gesunken' : 'stabil'}
                </span>
              </div>
            </div>
          </div>

          <div className="rounded-lg bg-muted/20 border px-3 py-2 text-center">
            <p className="text-[9px] text-muted-foreground">Bewertungen heute</p>
            <p className="text-lg font-bold tabular-nums">{mein.anzahl_bewertungen}</p>
          </div>

          <div className="rounded-lg bg-muted/30 border px-3 py-2 flex items-start gap-2">
            <Lightbulb className="h-3.5 w-3.5 text-amber-500 mt-0.5 shrink-0" />
            <p className="text-[11px] text-muted-foreground leading-snug">{tipp(mein.avg_sterne, mein.trend)}</p>
          </div>
        </div>
      )}
    </div>
  );
}
