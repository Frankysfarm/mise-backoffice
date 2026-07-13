'use client';

// Phase 1234 — Tour-Qualitäts-Abzeichen (Fahrer-App)
// Zeigt Erfolgsquote der letzten 10 Stopps + persönliches Qualitäts-Badge
// Props: driverId, isOnline · 90s-Polling

import { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, Award, CheckCircle2, XCircle, Clock, Star } from 'lucide-react';
import { cn } from '@/lib/utils';

interface StoppErgebnis {
  stopp_id: string;
  adresse: string;
  status: 'erfolgreich' | 'nicht_erreicht' | 'verzoegert';
  delta_min: number;
}

interface QualitaetsData {
  letzte_stopps: StoppErgebnis[];
  erfolgsquote_pct: number;
  badge: 'gold' | 'silber' | 'bronze' | 'im_aufbau';
  badge_label: string;
  punkte_heute: number;
}

const BADGE_COLORS = {
  gold: { bg: 'bg-amber-50 dark:bg-amber-900/20 border-amber-300 dark:border-amber-700', text: 'text-amber-600 dark:text-amber-400', ring: 'ring-amber-400' },
  silber: { bg: 'bg-slate-50 dark:bg-slate-900/20 border-slate-300 dark:border-slate-600', text: 'text-slate-600 dark:text-slate-300', ring: 'ring-slate-400' },
  bronze: { bg: 'bg-orange-50 dark:bg-orange-900/20 border-orange-300 dark:border-orange-700', text: 'text-orange-600 dark:text-orange-400', ring: 'ring-orange-400' },
  im_aufbau: { bg: 'bg-muted/30 border-border', text: 'text-muted-foreground', ring: 'ring-border' },
};

const BADGE_STARS = { gold: 3, silber: 2, bronze: 1, im_aufbau: 0 };

function mockData(): QualitaetsData {
  return {
    letzte_stopps: [
      { stopp_id: '1', adresse: 'Hauptstr. 12', status: 'erfolgreich', delta_min: -2 },
      { stopp_id: '2', adresse: 'Gartenweg 5', status: 'erfolgreich', delta_min: 1 },
      { stopp_id: '3', adresse: 'Marktplatz 3', status: 'verzoegert', delta_min: 8 },
      { stopp_id: '4', adresse: 'Ringstr. 44', status: 'erfolgreich', delta_min: 0 },
      { stopp_id: '5', adresse: 'Schulstr. 7', status: 'nicht_erreicht', delta_min: 15 },
    ],
    erfolgsquote_pct: 80,
    badge: 'silber',
    badge_label: 'Silber-Fahrer',
    punkte_heute: 47,
  };
}

function badge(pct: number): QualitaetsData['badge'] {
  if (pct >= 95) return 'gold';
  if (pct >= 85) return 'silber';
  if (pct >= 70) return 'bronze';
  return 'im_aufbau';
}

const STATUS_ICON = {
  erfolgreich: <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />,
  nicht_erreicht: <XCircle className="h-3.5 w-3.5 text-red-500" />,
  verzoegert: <Clock className="h-3.5 w-3.5 text-amber-500" />,
};

export function FahrerPhase1234TourQualitaetsAbzeichen({
  driverId,
  isOnline,
}: {
  driverId: string;
  isOnline: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<QualitaetsData | null>(null);

  useEffect(() => {
    if (!driverId || !isOnline) return;
    let cancelled = false;

    async function load() {
      try {
        const res = await fetch(`/api/delivery/driver/tour-qualitaet?driver_id=${driverId}`);
        if (!res.ok) throw new Error();
        const json = await res.json();
        if (!cancelled && json) setData(json);
        else if (!cancelled) setData(mockData());
      } catch {
        if (!cancelled) setData(mockData());
      }
    }

    load();
    const id = setInterval(load, 90000);
    return () => { cancelled = true; clearInterval(id); };
  }, [driverId, isOnline]);

  if (!isOnline) return null;

  const d = data ?? mockData();
  const b = badge(d.erfolgsquote_pct);
  const colors = BADGE_COLORS[b];
  const stars = BADGE_STARS[b];

  return (
    <div className={cn('rounded-xl border bg-white dark:bg-zinc-900 shadow-sm overflow-hidden', colors.bg)}>
      <button
        onClick={() => setOpen((p) => !p)}
        className="w-full flex items-center gap-2 px-4 py-3 text-left hover:bg-muted/10 transition"
      >
        <Award className={cn('h-4 w-4 shrink-0', colors.text)} />
        <span className="font-bold text-sm text-foreground flex-1">Tour-Qualität</span>
        <div className="flex items-center gap-0.5">
          {Array.from({ length: 3 }).map((_, i) => (
            <Star
              key={i}
              className={cn('h-3 w-3', i < stars ? 'fill-current ' + colors.text : 'text-muted-foreground/30')}
            />
          ))}
        </div>
        <span className={cn('text-xs font-bold ml-2', colors.text)}>{d.erfolgsquote_pct}%</span>
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-3">
          {/* Badge */}
          <div className={cn('flex items-center gap-3 rounded-lg border px-3 py-2', colors.bg, `ring-1 ${colors.ring}`)}>
            <Award className={cn('h-6 w-6', colors.text)} />
            <div>
              <div className={cn('text-sm font-black', colors.text)}>{d.badge_label}</div>
              <div className="text-[10px] text-muted-foreground">{d.punkte_heute} Punkte heute</div>
            </div>
            <div className="ml-auto text-right">
              <div className={cn('text-xl font-black tabular-nums', colors.text)}>{d.erfolgsquote_pct}%</div>
              <div className="text-[10px] text-muted-foreground">Erfolgsquote</div>
            </div>
          </div>

          {/* Letzte Stopps */}
          <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Letzte Stopps</div>
          <div className="space-y-1">
            {d.letzte_stopps.map((s) => (
              <div key={s.stopp_id} className="flex items-center gap-2 text-xs">
                {STATUS_ICON[s.status]}
                <span className="flex-1 truncate text-foreground">{s.adresse}</span>
                <span className={cn(
                  'tabular-nums text-[11px] font-bold',
                  s.status === 'erfolgreich' ? 'text-emerald-600 dark:text-emerald-400' : s.status === 'verzoegert' ? 'text-amber-500' : 'text-red-500',
                )}>
                  {s.delta_min > 0 ? `+${s.delta_min} Min` : s.delta_min < 0 ? `${s.delta_min} Min` : 'pünktlich'}
                </span>
              </div>
            ))}
          </div>

          <div className="text-[10px] text-muted-foreground">
            Gold ≥95% · Silber ≥85% · Bronze ≥70%
          </div>
        </div>
      )}
    </div>
  );
}
