'use client';

// Phase 1259 — Tages-Rangliste (Fahrer-App)
// Fahrer sieht eigene Platzierung (Stopps/h) vs. anonymisierte Kollegen
// Props: driverId, isOnline, locationId · isOnline-Guard · 15-Min-Polling

import { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, Trophy, Loader2, Star } from 'lucide-react';
import { cn } from '@/lib/utils';

interface RanglistenEintrag {
  rang: number;
  name: string;
  stopps_heute: number;
  stopps_pro_stunde: number;
  ist_eigener_fahrer: boolean;
}

interface ApiResponse {
  eintraege: RanglistenEintrag[];
  eigener_rang: number | null;
  gesamt_fahrer: number;
  driver_id: string;
  location_id: string;
  generiert_am: string;
}

const RANG_STYLE: Record<number, { medal: string; bg: string }> = {
  1: { medal: '🥇', bg: 'bg-yellow-50 dark:bg-yellow-950/30 border-yellow-200 dark:border-yellow-800' },
  2: { medal: '🥈', bg: 'bg-slate-50 dark:bg-slate-900/30 border-slate-200 dark:border-slate-700' },
  3: { medal: '🥉', bg: 'bg-orange-50 dark:bg-orange-950/20 border-orange-200 dark:border-orange-800' },
};

export function FahrerPhase1259TagesRangliste({
  driverId,
  isOnline,
  locationId,
}: {
  driverId: string;
  isOnline: boolean;
  locationId?: string | null;
}) {
  const [open, setOpen] = useState(true);
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchData = () => {
    if (!isOnline || !driverId) return;
    setLoading(true);
    const locParam = locationId ? `&location_id=${locationId}` : '';
    fetch(`/api/delivery/driver/tages-rangliste?driver_id=${driverId}${locParam}`)
      .then(r => r.json())
      .then((d: ApiResponse) => setData(d))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchData();
    const id = setInterval(fetchData, 15 * 60_000);
    return () => clearInterval(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [driverId, isOnline, locationId]);

  if (!isOnline) return null;

  const eigenerRang = data?.eigener_rang;
  const headerBg =
    eigenerRang === 1 ? 'bg-gradient-to-r from-yellow-400 to-amber-500' :
    eigenerRang === 2 ? 'bg-gradient-to-r from-slate-400 to-slate-500' :
    eigenerRang === 3 ? 'bg-gradient-to-r from-orange-400 to-amber-500' :
    'bg-gradient-to-r from-violet-500 to-indigo-500';

  return (
    <div className="rounded-xl border border-white/10 overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className={cn('w-full flex items-center gap-2 px-4 py-2.5 text-white', headerBg)}
      >
        <Trophy className="h-4 w-4 shrink-0" />
        <span className="text-sm font-bold flex-1 text-left">Tages-Rangliste</span>
        {loading && <Loader2 className="h-3.5 w-3.5 animate-spin opacity-70" />}
        {eigenerRang && (
          <span className="text-xs bg-white/20 rounded-full px-2 py-0.5 font-bold">
            Platz {eigenerRang}/{data?.gesamt_fahrer}
          </span>
        )}
        {open ? <ChevronUp className="h-4 w-4 opacity-80" /> : <ChevronDown className="h-4 w-4 opacity-80" />}
      </button>

      {open && (
        <div className="bg-zinc-900/80 p-3 space-y-2">
          {!data && !loading && (
            <p className="text-sm text-white/60">Lade Rangliste…</p>
          )}

          {data && (
            <>
              <div className="space-y-1.5">
                {data.eintraege.map(e => {
                  const rangStyle = RANG_STYLE[e.rang];
                  const isMe = e.ist_eigener_fahrer;
                  return (
                    <div
                      key={e.rang}
                      className={cn(
                        'flex items-center gap-3 rounded-lg border px-3 py-2 transition-all',
                        isMe
                          ? 'border-violet-400/50 bg-violet-900/30 ring-1 ring-violet-400/30'
                          : rangStyle
                            ? rangStyle.bg
                            : 'border-white/10 bg-white/5',
                      )}
                    >
                      <span className="text-base w-7 text-center shrink-0">
                        {rangStyle?.medal ?? `${e.rang}.`}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className={cn('text-sm font-bold truncate', isMe ? 'text-violet-300' : 'text-white/90')}>
                          {e.name}
                          {isMe && <span className="ml-1.5 text-[10px] font-normal text-violet-400">← Du</span>}
                        </div>
                        <div className="text-[10px] text-white/50 mt-0.5">
                          {e.stopps_heute} Stopps heute
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className={cn('text-sm font-black tabular-nums', isMe ? 'text-violet-300' : 'text-white/80')}>
                          {e.stopps_pro_stunde.toFixed(1)}
                        </div>
                        <div className="text-[9px] text-white/40">Stopps/h</div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {eigenerRang === 1 && (
                <div className="flex items-center gap-1.5 text-xs text-yellow-400 font-semibold mt-1">
                  <Star className="h-3.5 w-3.5 fill-yellow-400" />
                  Top-Fahrer heute — Stark!
                </div>
              )}

              <p className="text-[10px] text-white/30">
                Kollegen anonym · zuletzt {new Date(data.generiert_am).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })} Uhr
              </p>
            </>
          )}
        </div>
      )}
    </div>
  );
}
