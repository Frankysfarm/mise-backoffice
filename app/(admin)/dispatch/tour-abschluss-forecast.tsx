'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { Flag, Clock, CheckCircle2, AlertTriangle, TrendingUp } from 'lucide-react';

type BatchStop = {
  id: string;
  order_id: string;
  reihenfolge: number;
  geliefert_am: string | null;
};

type Batch = {
  id: string;
  status: string;
  fahrer_id: string | null;
  startzeit?: string | null;
  total_eta_min: number | null;
  total_distance_km: number | null;
  zone: string | null;
  fahrer: { vorname: string; nachname: string } | null;
  stops: BatchStop[];
};

interface Props {
  batches: Batch[];
}

type ForecastRow = {
  batchId: string;
  driverName: string;
  zone: string | null;
  completedStops: number;
  totalStops: number;
  elapsedMin: number;
  etaMin: number | null;
  remainMin: number | null;
  finishAt: Date | null;
  confidence: 'hoch' | 'mittel' | 'niedrig';
  status: 'pünktlich' | 'leichte Verspätung' | 'Verspätung';
};

function formatTime(d: Date): string {
  return d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
}

export function DispatchTourAbschlussForecast({ batches }: Props) {
  const [, setTick] = useState(0);
  useEffect(() => {
    const iv = setInterval(() => setTick((n) => n + 1), 20_000);
    return () => clearInterval(iv);
  }, []);

  const now = Date.now();

  const active = batches.filter(b =>
    ['unterwegs', 'on_route', 'aktiv', 'assigned', 'gestartet'].includes(b.status)
  );

  if (active.length === 0) return null;

  const rows: ForecastRow[] = active.map(b => {
    const completedStops = b.stops.filter(s => s.geliefert_am != null).length;
    const totalStops = b.stops.length;
    const startMs = b.startzeit ? new Date(b.startzeit).getTime() : null;
    const elapsedMin = startMs ? (now - startMs) / 60_000 : 0;
    const etaMin = b.total_eta_min;

    // Remaining: proportional to stops left
    let remainMin: number | null = null;
    if (etaMin !== null && totalStops > 0) {
      const doneFraction = completedStops / totalStops;
      const elapsedOfEta = elapsedMin / etaMin;
      if (doneFraction < 1) {
        const speedFactor = doneFraction > 0 ? elapsedOfEta / doneFraction : 1;
        remainMin = Math.max(0, (1 - doneFraction) * etaMin * speedFactor);
      } else {
        remainMin = 0;
      }
    }

    const finishAt = remainMin !== null
      ? new Date(now + remainMin * 60_000)
      : etaMin !== null && startMs
      ? new Date(startMs + etaMin * 60_000)
      : null;

    const confidence: ForecastRow['confidence'] =
      completedStops === 0 ? 'niedrig' : completedStops >= Math.ceil(totalStops / 2) ? 'hoch' : 'mittel';

    const latenessFactor = etaMin && elapsedMin > 0 && totalStops > 0
      ? (elapsedMin / etaMin) - (completedStops / totalStops)
      : 0;

    const status: ForecastRow['status'] =
      latenessFactor > 0.25 ? 'Verspätung' :
      latenessFactor > 0.1 ? 'leichte Verspätung' :
      'pünktlich';

    const driverName = b.fahrer
      ? `${b.fahrer.vorname} ${b.fahrer.nachname[0]}.`
      : 'Fahrer';

    return {
      batchId: b.id,
      driverName,
      zone: b.zone,
      completedStops,
      totalStops,
      elapsedMin: Math.floor(elapsedMin),
      etaMin,
      remainMin: remainMin !== null ? Math.ceil(remainMin) : null,
      finishAt,
      confidence,
      status,
    };
  });

  rows.sort((a, b) => {
    const order = ['Verspätung', 'leichte Verspätung', 'pünktlich'];
    return order.indexOf(a.status) - order.indexOf(b.status);
  });

  const statusStyle = {
    'pünktlich':         { bg: 'bg-matcha-50',  border: 'border-matcha-200',  text: 'text-matcha-700',  dot: 'bg-matcha-500'  },
    'leichte Verspätung':{ bg: 'bg-amber-50',   border: 'border-amber-200',   text: 'text-amber-700',   dot: 'bg-amber-500'   },
    'Verspätung':        { bg: 'bg-red-50',     border: 'border-red-200',     text: 'text-red-700',     dot: 'bg-red-500'     },
  };

  const confidenceLabel = { hoch: '↑', mittel: '~', niedrig: '?' };

  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Flag size={14} className="text-muted-foreground" />
        <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
          Tour-Abschluss-Prognose
        </span>
        <span className="ml-auto rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold text-muted-foreground">
          {active.length} Tour{active.length !== 1 ? 'en' : ''}
        </span>
      </div>

      <div className="space-y-2">
        {rows.map(r => {
          const st = statusStyle[r.status];
          return (
            <div key={r.batchId} className={cn('rounded-lg border px-3 py-2.5 space-y-1.5', st.bg, st.border)}>
              {/* Row header */}
              <div className="flex items-center gap-2">
                <span className={cn('h-2 w-2 rounded-full shrink-0', st.dot)} />
                <span className="text-xs font-bold">{r.driverName}</span>
                {r.zone && (
                  <span className="text-[9px] rounded-full bg-white/70 border px-1.5 py-0.5 font-bold">
                    Zone {r.zone}
                  </span>
                )}
                <span className={cn('ml-auto text-[10px] font-bold', st.text)}>
                  {r.status}
                </span>
              </div>

              {/* Stop progress */}
              <div className="flex items-center gap-2">
                <div className="flex-1 h-1.5 rounded-full bg-white/60 overflow-hidden">
                  <div
                    className={cn('h-full rounded-full transition-all duration-700',
                      r.status === 'pünktlich' ? 'bg-matcha-400' :
                      r.status === 'leichte Verspätung' ? 'bg-amber-400' :
                      'bg-red-400'
                    )}
                    style={{ width: r.totalStops > 0 ? `${Math.round((r.completedStops / r.totalStops) * 100)}%` : '0%' }}
                  />
                </div>
                <span className="text-[9px] font-bold tabular-nums text-muted-foreground shrink-0">
                  {r.completedStops}/{r.totalStops} Stopps
                </span>
              </div>

              {/* Time info */}
              <div className="flex items-center gap-3 text-[10px]">
                <div className="flex items-center gap-1">
                  <Clock size={10} className="text-muted-foreground" />
                  <span className="text-muted-foreground">{r.elapsedMin} Min vergangen</span>
                </div>
                {r.remainMin !== null && (
                  <div className={cn('flex items-center gap-1', st.text)}>
                    <TrendingUp size={10} />
                    <span className="font-bold">~{r.remainMin} Min verbleibend</span>
                  </div>
                )}
                {r.finishAt && (
                  <div className="ml-auto flex items-center gap-1">
                    <Flag size={10} className={st.text} />
                    <span className={cn('font-bold tabular-nums', st.text)}>
                      Fertig ~{formatTime(r.finishAt)}
                    </span>
                    <span className="text-muted-foreground">
                      {confidenceLabel[r.confidence]}
                    </span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="text-[9px] text-muted-foreground">
        ↑ hohe · ~ mittlere · ? niedrige Konfidenz · aktualisiert alle 20 Sek
      </div>
    </div>
  );
}
