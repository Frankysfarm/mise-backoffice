'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { CheckSquare, Square, Smartphone, Battery, Navigation, ClipboardCheck, ChevronDown, ChevronUp, CheckCircle2 } from 'lucide-react';

// Phase 1515 — Nächste-Tour-Vorbereitung (Fahrer-App)
// Checkliste vor Tourstart (Fahrzeug / Handy / Akku / Route geprüft);
// Guard isOnline; localStorage je Tour-ID; nach Phase1510.

interface Props {
  driverId: string;
  isOnline: boolean;
  tourId?: string | null;
}

interface CheckItem {
  id: string;
  label: string;
  icon: React.ReactNode;
  kategorie: 'fahrzeug' | 'technik' | 'route';
}

const ITEMS: CheckItem[] = [
  { id: 'fahrzeug_check', label: 'Fahrzeug betriebsbereit', icon: <Navigation className="w-4 h-4" />, kategorie: 'fahrzeug' },
  { id: 'sicherheit_check', label: 'Sicherheitsgurt + Licht', icon: <CheckCircle2 className="w-4 h-4" />, kategorie: 'fahrzeug' },
  { id: 'handy_check', label: 'Handy einsatzbereit', icon: <Smartphone className="w-4 h-4" />, kategorie: 'technik' },
  { id: 'akku_check', label: 'Akku ≥ 30%', icon: <Battery className="w-4 h-4" />, kategorie: 'technik' },
  { id: 'app_check', label: 'App & GPS aktiv', icon: <Navigation className="w-4 h-4" />, kategorie: 'technik' },
  { id: 'route_check', label: 'Route geprüft', icon: <Navigation className="w-4 h-4" />, kategorie: 'route' },
  { id: 'stopps_check', label: 'Stopps bekannt', icon: <ClipboardCheck className="w-4 h-4" />, kategorie: 'route' },
];

const KATEGORIE_CONFIG: Record<string, { label: string; color: string }> = {
  fahrzeug: { label: 'Fahrzeug', color: 'text-blue-600 dark:text-blue-400' },
  technik: { label: 'Technik', color: 'text-purple-600 dark:text-purple-400' },
  route: { label: 'Route', color: 'text-emerald-600 dark:text-emerald-400' },
};

function lsKey(driverId: string, tourId: string | null): string {
  return `mise_tour_prep_${driverId}_${tourId ?? 'default'}`;
}

export function FahrerPhase1515NaechsteTourVorbereitung({ driverId, isOnline, tourId = null }: Props) {
  const [open, setOpen] = useState(true);
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [bereit, setBereit] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(lsKey(driverId, tourId));
      if (raw) {
        const saved = JSON.parse(raw) as Record<string, boolean>;
        setChecked(saved);
        setBereit(ITEMS.every(i => !!saved[i.id]));
      }
    } catch {
      // ignore
    }
  }, [driverId, tourId]);

  function toggle(id: string) {
    setChecked(prev => {
      const next = { ...prev, [id]: !prev[id] };
      const alleErledigt = ITEMS.every(i => !!next[i.id]);
      setBereit(alleErledigt);
      try {
        localStorage.setItem(lsKey(driverId, tourId), JSON.stringify(next));
      } catch {
        // ignore
      }
      return next;
    });
  }

  function reset() {
    setChecked({});
    setBereit(false);
    try { localStorage.removeItem(lsKey(driverId, tourId)); } catch { /* ignore */ }
  }

  if (!isOnline) return null;

  const erledigte = ITEMS.filter(i => !!checked[i.id]).length;
  const fortschritt = Math.round((erledigte / ITEMS.length) * 100);
  const kategorien = ['fahrzeug', 'technik', 'route'] as const;

  return (
    <div className={cn(
      'rounded-xl border overflow-hidden',
      bereit ? 'border-emerald-200 dark:border-emerald-800' : 'border-slate-200 dark:border-slate-700',
    )}>
      <button
        className="w-full flex items-center gap-2 px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
        onClick={() => setOpen(v => !v)}
      >
        <ClipboardCheck className={cn('w-4 h-4 shrink-0', bereit ? 'text-emerald-500' : 'text-slate-400')} />
        <span className="text-sm font-semibold text-slate-800 dark:text-slate-100 flex-1 text-left">
          Tour-Vorbereitung
        </span>
        <span className={cn(
          'text-[10px] font-bold px-1.5 py-0.5 rounded-full shrink-0',
          bereit
            ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'
            : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
        )}>
          {bereit ? 'Bereit' : `${erledigte}/${ITEMS.length}`}
        </span>
        {open ? <ChevronUp className="w-4 h-4 text-slate-400 shrink-0" /> : <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />}
      </button>

      {open && (
        <div className="px-4 pb-4 bg-white dark:bg-slate-900 space-y-4">
          {/* Fortschrittsbalken */}
          <div>
            <div className="flex justify-between text-[10px] text-slate-400 mb-1">
              <span>{erledigte} von {ITEMS.length} geprüft</span>
              <span>{fortschritt}%</span>
            </div>
            <div className="h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${fortschritt}%`,
                  backgroundColor: bereit ? '#10b981' : '#94a3b8',
                }}
              />
            </div>
          </div>

          {/* Kategorien */}
          {kategorien.map(kat => {
            const items = ITEMS.filter(i => i.kategorie === kat);
            const katCfg = KATEGORIE_CONFIG[kat];
            return (
              <div key={kat} className="space-y-1.5">
                <div className={cn('text-[10px] font-bold uppercase tracking-wide', katCfg.color)}>
                  {katCfg.label}
                </div>
                {items.map(item => {
                  const isChecked = !!checked[item.id];
                  return (
                    <button
                      key={item.id}
                      className="w-full flex items-center gap-2 rounded-lg px-3 py-2 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors text-left"
                      onClick={() => toggle(item.id)}
                    >
                      {isChecked
                        ? <CheckSquare className="w-4 h-4 text-emerald-500 shrink-0" />
                        : <Square className="w-4 h-4 text-slate-300 dark:text-slate-600 shrink-0" />
                      }
                      <span className={cn(
                        'text-sm flex-1',
                        isChecked ? 'line-through text-slate-400' : 'text-slate-700 dark:text-slate-200',
                      )}>
                        {item.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            );
          })}

          {/* Status-Banner */}
          {bereit ? (
            <div className="rounded-lg bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800 px-3 py-2.5 text-sm text-emerald-700 dark:text-emerald-400 flex items-center gap-2 font-semibold">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              Alles geprüft — Tour kann starten!
            </div>
          ) : (
            <div className="text-[11px] text-slate-400 text-center">
              Alle Punkte abhaken, bevor die Tour startet.
            </div>
          )}

          {/* Reset */}
          {erledigte > 0 && (
            <button
              className="w-full text-[11px] text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors text-center"
              onClick={reset}
            >
              Zurücksetzen
            </button>
          )}
        </div>
      )}
    </div>
  );
}
