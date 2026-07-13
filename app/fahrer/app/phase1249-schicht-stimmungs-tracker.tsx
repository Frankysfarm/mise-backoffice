'use client';

// Phase 1249 — Schicht-Stimmungs-Tracker (Fahrer-App)
// 5 Quick-Emoji-Buttons (schlecht→super) + Verlauf der letzten 5 Einträge + Empfehlung
// Props: driverId, isOnline · isOnline-Guard · 10-Min-Polling

import { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, Smile, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';

interface StimmungsEintrag {
  id: string;
  stimmung: number;
  label: string;
  zeit: string;
}

interface ApiResponse {
  eintraege: StimmungsEintrag[];
  schnitt: number;
  trend: 'steigend' | 'stabil' | 'fallend';
  empfehlung: string;
  driver_id: string;
  generiert_am: string;
}

const EMOJIS: Record<number, { icon: string; label: string; color: string }> = {
  1: { icon: '😞', label: 'schlecht', color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 border-red-300' },
  2: { icon: '😑', label: 'müde',    color: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400 border-orange-300' },
  3: { icon: '😐', label: 'okay',    color: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400 border-yellow-300' },
  4: { icon: '😊', label: 'gut',     color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 border-green-300' },
  5: { icon: '😄', label: 'super',   color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border-emerald-300' },
};

const TREND_ICON = {
  steigend: TrendingUp,
  stabil:   Minus,
  fallend:  TrendingDown,
};

const TREND_COLOR = {
  steigend: 'text-green-500',
  stabil:   'text-slate-400',
  fallend:  'text-red-500',
};

function formatZeit(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
}

export function FahrerPhase1249SchichtStimmungsTracker({
  driverId,
  isOnline,
}: {
  driverId: string;
  isOnline: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<ApiResponse | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const fetchData = () => {
    if (!isOnline) return;
    fetch(`/api/delivery/driver/schicht-stimmung?driver_id=${driverId}`)
      .then(r => r.json())
      .then((d: ApiResponse) => setData(d))
      .catch(() => {});
  };

  useEffect(() => {
    fetchData();
    const id = setInterval(fetchData, 10 * 60_000);
    return () => clearInterval(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [driverId, isOnline]);

  const submitStimmung = async (stimmung: number) => {
    setSelected(stimmung);
    setSaving(true);
    try {
      await fetch(`/api/delivery/driver/schicht-stimmung?driver_id=${driverId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stimmung }),
      });
      setSaved(true);
      setTimeout(() => { setSaved(false); fetchData(); }, 2000);
    } catch {
      // best-effort
    } finally {
      setSaving(false);
    }
  };

  if (!isOnline) return null;

  const TrendIcon = data ? TREND_ICON[data.trend] : null;

  return (
    <section className="bg-gradient-to-br from-indigo-900/70 to-indigo-800/70 border border-indigo-700/50 rounded-2xl overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between p-4 text-left"
      >
        <div className="flex items-center gap-2">
          <Smile className="h-4 w-4 text-indigo-300 shrink-0" />
          <span className="text-sm font-bold text-white">Schicht-Stimmung</span>
          {data && (
            <span className="rounded-full bg-white/20 px-2 py-0.5 text-[10px] font-bold text-white">
              Ø {data.schnitt}
            </span>
          )}
          {data && TrendIcon && (
            <TrendIcon className={cn('h-3.5 w-3.5', TREND_COLOR[data.trend])} />
          )}
        </div>
        {open
          ? <ChevronUp className="h-4 w-4 text-indigo-300" />
          : <ChevronDown className="h-4 w-4 text-indigo-300" />
        }
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-4">
          {/* Emoji-Auswahl */}
          <div>
            <div className="mb-2 text-[10px] font-bold uppercase tracking-wider text-indigo-300">
              Wie fühlst du dich gerade?
            </div>
            <div className="flex gap-2">
              {([1, 2, 3, 4, 5] as const).map(score => {
                const e = EMOJIS[score];
                const isActive = selected === score;
                return (
                  <button
                    key={score}
                    onClick={() => submitStimmung(score)}
                    disabled={saving}
                    className={cn(
                      'flex-1 flex flex-col items-center gap-1 rounded-xl border py-2 transition',
                      isActive ? e.color : 'bg-white/10 border-white/20 text-white hover:bg-white/20',
                      saving && 'opacity-50',
                    )}
                  >
                    <span className="text-xl">{e.icon}</span>
                    <span className="text-[9px] font-bold">{e.label}</span>
                  </button>
                );
              })}
            </div>
            {saved && (
              <p className="mt-1.5 text-center text-[11px] text-emerald-400 font-bold">
                ✓ Gespeichert!
              </p>
            )}
          </div>

          {/* Empfehlung */}
          {data?.empfehlung && (
            <div className="rounded-xl bg-white/10 px-3 py-2">
              <p className="text-xs text-indigo-200">{data.empfehlung}</p>
            </div>
          )}

          {/* Verlauf */}
          {data && data.eintraege.length > 0 && (
            <div>
              <div className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-indigo-300">
                Letzten {data.eintraege.length} Einträge
              </div>
              <div className="flex items-end gap-1 h-10">
                {data.eintraege.slice().reverse().map(e => (
                  <div key={e.id} className="flex-1 flex flex-col items-center gap-0.5">
                    <span className="text-sm">{EMOJIS[e.stimmung]?.icon ?? '😐'}</span>
                    <span className="text-[8px] text-indigo-300">{formatZeit(e.zeit)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
