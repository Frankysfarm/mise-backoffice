'use client';

import { useEffect, useState } from 'react';
import { cn, euro } from '@/lib/utils';
import { CheckCircle2, Clock, MapPin, Navigation, ChevronDown, ChevronUp, Zap } from 'lucide-react';

type StopOrder = {
  id: string;
  bestellnummer: string;
  kunde_name: string;
  kunde_adresse: string | null;
  kunde_plz: string | null;
  kunde_lat: number | null;
  kunde_lng: number | null;
  gesamtbetrag: number;
  zahlungsart?: string | null;
  bezahlt?: boolean | null;
  eta_earliest?: string | null;
  eta_latest?: string | null;
};

type Stop = {
  id: string;
  batch_id: string;
  order_id: string;
  reihenfolge: number;
  angekommen_am: string | null;
  geliefert_am: string | null;
  order: StopOrder;
};

interface Props {
  stops: Stop[];
  batchStartedAt?: string | null;
  totalEtaMin?: number | null;
}

function useTick(ms = 30_000) {
  const [, setN] = useState(0);
  useEffect(() => {
    const iv = setInterval(() => setN((n) => n + 1), ms);
    return () => clearInterval(iv);
  }, [ms]);
}

function fmtEtaTime(iso: string | null | undefined): string {
  if (!iso) return '–';
  try {
    const d = new Date(iso);
    return d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '–';
  }
}

function stopStatus(stop: Stop): 'done' | 'current' | 'upcoming' {
  if (stop.geliefert_am) return 'done';
  if (stop.angekommen_am) return 'current';
  return 'upcoming';
}

function mapsLink(lat: number | null, lng: number | null, addr: string | null): string {
  if (lat && lng) return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
  if (addr) return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(addr)}`;
  return '#';
}

export function TourRouteTiming({ stops, batchStartedAt, totalEtaMin }: Props) {
  useTick();
  const [expanded, setExpanded] = useState(true);

  const now = Date.now();
  const sorted = [...stops].sort((a, b) => a.reihenfolge - b.reihenfolge);
  const doneCount = sorted.filter((s) => s.geliefert_am).length;
  const remaining = sorted.filter((s) => !s.geliefert_am);

  if (sorted.length === 0) return null;

  const allDone = doneCount === sorted.length;

  let elapsedMin: number | null = null;
  let projectedFinishMs: number | null = null;
  if (batchStartedAt) {
    elapsedMin = Math.round((now - new Date(batchStartedAt).getTime()) / 60_000);
    if (totalEtaMin) {
      projectedFinishMs = new Date(batchStartedAt).getTime() + totalEtaMin * 60_000;
    }
  }

  const progressPct = sorted.length > 0 ? (doneCount / sorted.length) * 100 : 0;

  const statusColor = allDone ? 'bg-matcha-600' : doneCount > 0 ? 'bg-blue-600' : 'bg-zinc-700';

  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setExpanded((e) => !e)}
        className="w-full flex items-center gap-3 px-4 py-3"
      >
        <div className={cn('h-7 w-7 rounded-xl flex items-center justify-center shrink-0', statusColor)}>
          {allDone ? (
            <CheckCircle2 size={14} className="text-white" />
          ) : (
            <MapPin size={14} className="text-white" />
          )}
        </div>
        <div className="flex-1 text-left">
          <div className="text-xs font-black text-matcha-50 uppercase tracking-wider">
            Route · {doneCount}/{sorted.length} Stopps
          </div>
          {projectedFinishMs && !allDone && (
            <div className="text-[10px] text-matcha-400">
              Fertig ca. {fmtEtaTime(new Date(projectedFinishMs).toISOString())}
              {elapsedMin !== null && ` · ${elapsedMin} Min unterwegs`}
            </div>
          )}
        </div>
        {expanded ? (
          <ChevronUp size={16} className="text-matcha-400 shrink-0" />
        ) : (
          <ChevronDown size={16} className="text-matcha-400 shrink-0" />
        )}
      </button>

      {/* Progress bar */}
      <div className="px-4 pb-2">
        <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
          <div
            className={cn('h-full rounded-full transition-all duration-700', allDone ? 'bg-matcha-500' : 'bg-blue-500')}
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </div>

      {/* Stop list */}
      {expanded && (
        <div className="border-t border-white/10 divide-y divide-white/5">
          {sorted.map((stop, i) => {
            const s = stopStatus(stop);
            const o = stop.order;
            const isCurrent = s === 'current';
            const isDone = s === 'done';
            const addr = [o.kunde_adresse, o.kunde_plz].filter(Boolean).join(', ');
            const navUrl = mapsLink(o.kunde_lat, o.kunde_lng, addr);
            const needsPay = !o.bezahlt && (o.zahlungsart === 'bar' || o.zahlungsart === 'ec');

            return (
              <div
                key={stop.id}
                className={cn(
                  'flex items-start gap-3 px-4 py-3 transition-colors',
                  isCurrent ? 'bg-blue-900/30' : isDone ? 'opacity-50' : '',
                )}
              >
                {/* Step number */}
                <div className={cn(
                  'h-6 w-6 rounded-full flex items-center justify-center shrink-0 mt-0.5 text-[10px] font-black',
                  isDone ? 'bg-matcha-600 text-white' :
                  isCurrent ? 'bg-blue-500 text-white ring-2 ring-blue-400/50' :
                  'bg-white/10 text-matcha-400',
                )}>
                  {isDone ? <CheckCircle2 size={11} className="text-white" /> : i + 1}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-xs font-bold text-matcha-100 truncate">{o.kunde_name}</span>
                    {isCurrent && (
                      <span className="text-[9px] bg-blue-500 text-white rounded-full px-1.5 py-0.5 font-bold">
                        JETZT
                      </span>
                    )}
                    {needsPay && (
                      <span className="text-[9px] bg-amber-400 text-amber-900 rounded-full px-1.5 py-0.5 font-bold">
                        {o.zahlungsart === 'bar' ? 'BAR' : 'EC'}
                      </span>
                    )}
                  </div>
                  <div className="text-[10px] text-matcha-400 truncate mt-0.5">{addr || '–'}</div>
                  <div className="flex items-center gap-3 mt-1">
                    <span className="text-[10px] text-matcha-300 font-semibold">
                      {euro(o.gesamtbetrag)}
                    </span>
                    {o.eta_latest && (
                      <span className="text-[10px] text-matcha-400 flex items-center gap-0.5">
                        <Clock size={9} />
                        bis {fmtEtaTime(o.eta_latest)}
                      </span>
                    )}
                  </div>
                </div>

                {/* Nav button (only for upcoming/current) */}
                {!isDone && (
                  <a
                    href={navUrl}
                    target="_blank"
                    rel="noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className={cn(
                      'shrink-0 flex items-center gap-1 rounded-lg px-2 py-1.5 text-[10px] font-bold transition-colors',
                      isCurrent
                        ? 'bg-blue-500 text-white'
                        : 'bg-white/10 text-matcha-300 hover:bg-white/20',
                    )}
                  >
                    <Navigation size={10} />
                    Navi
                  </a>
                )}
              </div>
            );
          })}

          {allDone && (
            <div className="px-4 py-3 flex items-center gap-2 bg-matcha-900/30">
              <Zap size={14} className="text-matcha-400" />
              <span className="text-xs font-bold text-matcha-300">
                Alle {sorted.length} Stopps abgeschlossen
                {elapsedMin !== null ? ` in ${elapsedMin} Min` : ''}!
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
