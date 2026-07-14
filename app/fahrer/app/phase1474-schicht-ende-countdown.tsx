'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { Clock, CheckCircle2, AlertTriangle } from 'lucide-react';

// Phase 1474 — Schicht-Ende-Countdown (Fahrer-App)
// Wenn Schichtende naht: Restzeit + ob noch eine Tour sinnvoll + Empfehlung.
// Polling /api/delivery/admin/schicht-ende-prognose 10 Min.
// isOnline-Guard. Mock-Fallback.

interface Props {
  driverId: string;
  isOnline: boolean;
  locationId: string | null;
}

interface Prognose {
  minuten_bis_schichtende: number;
  offene_stopps: number;
  noch_eine_tour_sinnvoll: boolean;
  empfehlung: string;
}

function buildMock(): Prognose {
  return {
    minuten_bis_schichtende: 38,
    offene_stopps: 5,
    noch_eine_tour_sinnvoll: true,
    empfehlung: 'Noch 5 offene Stopps — ca. 38 Min. Eine weitere Tour ist sinnvoll.',
  };
}

function formatMinuten(min: number): string {
  if (min <= 0) return 'Jetzt';
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h > 0) return `${h}h ${m}min`;
  return `${m} Min`;
}

export function FahrerPhase1474SchichtEndeCountdown({ driverId, isOnline, locationId }: Props) {
  const [data, setData] = useState<Prognose>(buildMock());
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (!isOnline || !locationId) return;

    async function load() {
      try {
        const res = await fetch(
          `/api/delivery/admin/schicht-ende-prognose?location_id=${locationId}`,
          { cache: 'no-store' },
        );
        if (res.ok) {
          const json = await res.json();
          if (json?.minuten_bis_schichtende != null) setData(json as Prognose);
        }
      } catch {
        // keep mock
      }
    }

    load();
    const iv = setInterval(load, 10 * 60_000);
    return () => clearInterval(iv);
  }, [driverId, isOnline, locationId]);

  if (!mounted || !isOnline) return null;

  const min = data.minuten_bis_schichtende;
  const isKritisch = min <= 15 && min > 0;
  const isDone = min <= 0 && data.offene_stopps === 0;

  const bgCls = isDone
    ? 'bg-emerald-900/80 border-emerald-700/60'
    : isKritisch
    ? 'bg-rose-900/80 border-rose-700/60'
    : 'bg-slate-800/80 border-slate-700/60';

  const Icon = isDone ? CheckCircle2 : isKritisch ? AlertTriangle : Clock;
  const iconCls = isDone ? 'text-emerald-400' : isKritisch ? 'text-rose-400' : 'text-blue-400';

  return (
    <section className={cn('rounded-2xl border p-4 space-y-3', bgCls)}>
      <div className="flex items-center gap-2">
        <Icon className={cn('h-5 w-5 shrink-0', iconCls)} />
        <span className="text-xs font-bold text-white/80 uppercase tracking-wider">Schicht-Ende-Prognose</span>
      </div>

      <div className="flex items-end gap-4">
        <div>
          <div className="text-[10px] text-white/50 uppercase tracking-wide">Restzeit</div>
          <div className={cn('text-3xl font-black tabular-nums', iconCls)}>
            {formatMinuten(min)}
          </div>
        </div>
        <div>
          <div className="text-[10px] text-white/50 uppercase tracking-wide">Offene Stopps</div>
          <div className="text-3xl font-black tabular-nums text-white">{data.offene_stopps}</div>
        </div>
        <div className="ml-auto">
          <div className="text-[10px] text-white/50 uppercase tracking-wide">Noch eine Tour?</div>
          <div className={cn('text-sm font-bold', data.noch_eine_tour_sinnvoll ? 'text-emerald-400' : 'text-rose-400')}>
            {data.noch_eine_tour_sinnvoll ? '✓ Ja' : '✗ Nein'}
          </div>
        </div>
      </div>

      <p className="text-xs text-white/70 leading-relaxed">{data.empfehlung}</p>

      {isDone && (
        <div className="text-xs font-bold text-emerald-400 text-center pt-1">
          ✓ Alle Stopps abgeschlossen — Schicht kann beendet werden
        </div>
      )}
    </section>
  );
}
