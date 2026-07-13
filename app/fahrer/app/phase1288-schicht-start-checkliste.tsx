'use client';

// Phase 1288 — Schicht-Start-Checkliste (Fahrer-App)
// Interaktive Checkliste vor Schichtbeginn: Fahrzeug, Handy, Wärmetasche, Ausweis, App-Check
// Persistierter Done-State (localStorage) · isOnline-Guard · nach Phase1279

import { useEffect, useRef, useState } from 'react';
import { BadgeCheck, CheckCircle2, ChevronDown, ChevronUp, Circle, RotateCcw, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CheckItem {
  id: string;
  label: string;
  detail: string;
  emoji: string;
}

const CHECKLIST: CheckItem[] = [
  { id: 'fahrzeug',      label: 'Fahrzeug geprüft',      detail: 'Beleuchtung, Reifen, Tank/Akku kontrolliert',    emoji: '🚗' },
  { id: 'handy',         label: 'Handy aufgeladen',       detail: 'Min. 50% Akku, mobile Daten aktiv',             emoji: '📱' },
  { id: 'waermetasche',  label: 'Wärmetasche dabei',      detail: 'Tasche sauber und funktionsfähig',              emoji: '🎒' },
  { id: 'ausweis',       label: 'Ausweis vorhanden',      detail: 'Fahrer-ID oder Lichtbildausweis griffbereit',   emoji: '🪪' },
  { id: 'app',           label: 'App-Check',              detail: 'GPS aktiv, Push-Benachrichtigungen erlaubt',    emoji: '✅' },
  { id: 'wechselgeld',   label: 'Wechselgeld bereit',     detail: 'Ausreichend Münzen/Scheine für Barzahlung',     emoji: '💰' },
];

const STORAGE_KEY_PREFIX = 'mise_schicht_checkliste_';

function todayKey(driverId: string): string {
  const today = new Date().toISOString().split('T')[0];
  return `${STORAGE_KEY_PREFIX}${driverId}_${today}`;
}

interface Props {
  driverId: string;
  isOnline: boolean;
}

export function FahrerPhase1288SchichtStartCheckliste({ driverId, isOnline }: Props) {
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [open, setOpen] = useState(true);
  const initialized = useRef(false);

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;
    try {
      const raw = localStorage.getItem(todayKey(driverId));
      if (raw) setChecked(new Set(JSON.parse(raw) as string[]));
    } catch {
      // ignore
    }
  }, [driverId]);

  function toggle(id: string) {
    setChecked(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      try {
        localStorage.setItem(todayKey(driverId), JSON.stringify([...next]));
      } catch {
        // ignore
      }
      return next;
    });
  }

  function reset() {
    setChecked(new Set());
    try {
      localStorage.removeItem(todayKey(driverId));
    } catch {
      // ignore
    }
  }

  const doneCount = checked.size;
  const totalCount = CHECKLIST.length;
  const allDone = doneCount === totalCount;
  const pct = Math.round((doneCount / totalCount) * 100);

  return (
    <div className={cn(
      'rounded-2xl border shadow-sm overflow-hidden bg-card',
      allDone ? 'border-matcha-400 dark:border-matcha-600' : 'border-border',
    )}>
      <button
        onClick={() => setOpen(o => !o)}
        className="flex w-full items-center gap-3 px-4 py-3.5 text-left hover:bg-muted/30 transition-colors"
      >
        {allDone
          ? <BadgeCheck className="h-5 w-5 text-matcha-600 dark:text-matcha-400 shrink-0" />
          : <Zap className="h-5 w-5 text-amber-500 shrink-0" />
        }
        <div className="flex-1 min-w-0">
          <div className="text-sm font-bold text-foreground">Schicht-Start-Checkliste</div>
          <div className="text-[10px] text-muted-foreground mt-0.5">
            {allDone ? '🎉 Alle Punkte erledigt – gute Schicht!' : `${doneCount} von ${totalCount} erledigt`}
          </div>
        </div>
        <div className="shrink-0 flex items-center gap-2">
          <span className={cn(
            'text-xs font-black tabular-nums rounded-full px-2 py-0.5',
            allDone
              ? 'bg-matcha-100 text-matcha-700 dark:bg-matcha-900/40 dark:text-matcha-300'
              : 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
          )}>
            {pct}%
          </span>
          {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
        </div>
      </button>

      {open && (
        <div className="border-t">
          {/* Progress bar */}
          <div className="h-1.5 bg-muted w-full">
            <div
              className={cn('h-full transition-all duration-500', allDone ? 'bg-matcha-500' : 'bg-amber-400')}
              style={{ width: `${pct}%` }}
            />
          </div>

          <div className="px-4 py-3 space-y-1.5">
            {CHECKLIST.map(item => {
              const done = checked.has(item.id);
              return (
                <button
                  key={item.id}
                  onClick={() => toggle(item.id)}
                  className={cn(
                    'w-full flex items-start gap-3 rounded-xl border p-3 text-left transition-all duration-200',
                    done
                      ? 'border-matcha-200 dark:border-matcha-800 bg-matcha-50 dark:bg-matcha-950/20'
                      : 'border-border bg-background hover:bg-muted/40',
                  )}
                >
                  <span className="text-lg shrink-0 mt-0.5">{item.emoji}</span>
                  <div className="flex-1 min-w-0">
                    <div className={cn(
                      'text-sm font-semibold',
                      done ? 'text-matcha-700 dark:text-matcha-300 line-through' : 'text-foreground',
                    )}>
                      {item.label}
                    </div>
                    <div className="text-[10px] text-muted-foreground mt-0.5">{item.detail}</div>
                  </div>
                  {done
                    ? <CheckCircle2 className="h-5 w-5 text-matcha-600 dark:text-matcha-400 shrink-0 mt-0.5" />
                    : <Circle className="h-5 w-5 text-muted-foreground/40 shrink-0 mt-0.5" />
                  }
                </button>
              );
            })}
          </div>

          <div className="px-4 pb-3 flex justify-end">
            <button
              onClick={reset}
              className="inline-flex items-center gap-1.5 text-[10px] text-muted-foreground hover:text-foreground transition-colors"
            >
              <RotateCcw className="h-3 w-3" />
              Zurücksetzen
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
