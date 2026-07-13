'use client';

// Phase 1288 — Schicht-Start-Checkliste (Fahrer-App)
// Interaktive Checkliste vor Schichtbeginn (Fahrzeug, Handy, Wärmetasche, Ausweis, App-Check)
// Mit persistiertem Done-State (localStorage); isOnline-Guard; zeigt Abschluss-Banner wenn alles erledigt

import { useEffect, useState } from 'react';
import {
  BadgeCheck, Battery, Briefcase, Car, CheckCircle2, ChevronDown,
  ChevronUp, Circle, ClipboardList, Smartphone, Thermometer,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface ChecklistItem {
  id: string;
  label: string;
  sublabel: string;
  Icon: React.FC<{ className?: string }>;
}

const CHECKLISTE: ChecklistItem[] = [
  { id: 'fahrzeug',    label: 'Fahrzeug geprüft',     sublabel: 'Reifen, Bremsen, Spiegel, Beleuchtung ok', Icon: Car },
  { id: 'handy',       label: 'Handy geladen',         sublabel: 'Akku mind. 80% oder Ladekabel dabei',       Icon: Battery },
  { id: 'waermetasche',label: 'Wärmetasche dabei',     sublabel: 'Sauber und funktionstüchtig',               Icon: Thermometer },
  { id: 'ausweis',     label: 'Ausweis dabei',         sublabel: 'Personalausweis oder Führerschein',         Icon: BadgeCheck },
  { id: 'app',         label: 'App funktioniert',      sublabel: 'Karte lädt, GPS aktiv, Benachrichtigungen', Icon: Smartphone },
  { id: 'tauschen',    label: 'Übergabe erledigt',     sublabel: 'Vorherigen Fahrer abgelöst / Fahrzeug übernommen', Icon: Briefcase },
];

function loadDoneState(driverId: string): Set<string> {
  try {
    const raw = localStorage.getItem(`schicht-checkliste-${driverId}`);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw) as string[];
    return new Set(parsed);
  } catch {
    return new Set();
  }
}

function saveDoneState(driverId: string, done: Set<string>) {
  try {
    localStorage.setItem(`schicht-checkliste-${driverId}`, JSON.stringify([...done]));
  } catch {
    // ignore
  }
}

function clearDoneState(driverId: string) {
  try {
    localStorage.removeItem(`schicht-checkliste-${driverId}`);
  } catch {
    // ignore
  }
}

interface Props {
  driverId: string;
  isOnline: boolean;
}

export function FahrerPhase1288SchichtStartCheckliste({ driverId, isOnline }: Props) {
  const [open, setOpen] = useState(true);
  const [done, setDone] = useState<Set<string>>(new Set());
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    setDone(loadDoneState(driverId));
  }, [driverId]);

  // Reset wenn Fahrer offline geht (neue Schicht)
  useEffect(() => {
    if (!isOnline) {
      clearDoneState(driverId);
      setDone(new Set());
      setDismissed(false);
    }
  }, [isOnline, driverId]);

  if (isOnline) return null; // Nur vor Schichtbeginn anzeigen
  if (dismissed) return null;

  const toggle = (id: string) => {
    setDone((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      saveDoneState(driverId, next);
      return next;
    });
  };

  const alleErledigt = CHECKLISTE.every((item) => done.has(item.id));
  const erledigtCount = CHECKLISTE.filter((item) => done.has(item.id)).length;
  const fortschritt = Math.round((erledigtCount / CHECKLISTE.length) * 100);

  return (
    <div className={cn(
      'rounded-xl border overflow-hidden',
      alleErledigt
        ? 'border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950'
        : 'border-indigo-200 dark:border-indigo-800 bg-indigo-50 dark:bg-indigo-950',
    )}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-2 px-4 py-3 text-left"
      >
        <ClipboardList className={cn('h-4 w-4 shrink-0', alleErledigt ? 'text-emerald-600' : 'text-indigo-600')} />
        <span className="text-xs font-bold uppercase tracking-wider flex-1">
          Schicht-Start-Checkliste
        </span>
        <span className={cn(
          'text-[10px] font-bold px-2 py-0.5 rounded-full mr-2',
          alleErledigt
            ? 'bg-emerald-200 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200'
            : 'bg-indigo-200 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200',
        )}>
          {erledigtCount}/{CHECKLISTE.length}
        </span>
        {open ? <ChevronUp className="h-4 w-4 opacity-60" /> : <ChevronDown className="h-4 w-4 opacity-60" />}
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-2">
          {/* Fortschrittsbalken */}
          <div className="flex items-center gap-2 mb-1">
            <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
              <div
                className={cn('h-full rounded-full transition-all duration-500', alleErledigt ? 'bg-emerald-500' : 'bg-indigo-500')}
                style={{ width: `${fortschritt}%` }}
              />
            </div>
            <span className="text-[10px] font-bold tabular-nums">{fortschritt}%</span>
          </div>

          {CHECKLISTE.map((item) => {
            const isDone = done.has(item.id);
            const IconComp = item.Icon;
            return (
              <button
                key={item.id}
                onClick={() => toggle(item.id)}
                className={cn(
                  'w-full rounded-lg border p-3 flex items-center gap-3 text-left transition-colors',
                  isDone
                    ? 'bg-emerald-50 dark:bg-emerald-950 border-emerald-200 dark:border-emerald-800'
                    : 'bg-background border-border hover:bg-muted/50',
                )}
              >
                {isDone
                  ? <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0" />
                  : <Circle className="h-5 w-5 text-muted-foreground shrink-0" />
                }
                <IconComp className={cn('h-4 w-4 shrink-0', isDone ? 'text-emerald-600' : 'text-muted-foreground')} />
                <div className="flex-1 min-w-0">
                  <div className={cn('text-sm font-semibold', isDone && 'line-through text-muted-foreground')}>
                    {item.label}
                  </div>
                  <div className="text-[10px] text-muted-foreground truncate">{item.sublabel}</div>
                </div>
              </button>
            );
          })}

          {alleErledigt && (
            <div className="rounded-lg bg-emerald-100 dark:bg-emerald-900 border border-emerald-200 dark:border-emerald-700 px-4 py-3 flex items-center gap-3">
              <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
              <div className="flex-1">
                <div className="text-sm font-bold text-emerald-800 dark:text-emerald-200">Bereit für den Start!</div>
                <div className="text-[10px] text-emerald-700 dark:text-emerald-400">Alle Punkte abgehakt — gute Schicht!</div>
              </div>
              <button
                onClick={() => setDismissed(true)}
                className="text-[10px] font-bold text-emerald-700 dark:text-emerald-300 underline shrink-0"
              >
                Schließen
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
