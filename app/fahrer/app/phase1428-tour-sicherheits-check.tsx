'use client';

import { useState, useEffect } from 'react';
import { ShieldCheck, CheckSquare, Square, AlertTriangle, X } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Phase 1428 — Tour-Sicherheits-Check (Fahrer-App)
 *
 * Vor Tourstart: 4 Pflicht-Checklisten-Fragen.
 * Alle müssen bestätigt sein, dann erscheint "Tour starten"-Freigabe.
 * Zeigt sich einmalig pro Tour (localStorage-Key nach Batch-ID).
 * isOnline-Guard. Nach Phase1423 in fahrer/app/client.tsx.
 */

interface Props {
  batchId: string | null;
  isOnline: boolean;
  onConfirmed?: () => void;
}

const CHECKS = [
  { id: 'fahrzeug',  label: 'Fahrzeug in Ordnung (Bremsen, Reifen, Beleuchtung)' },
  { id: 'akku',      label: 'Handy-Akku > 30 % oder Ladekabel dabei' },
  { id: 'route',     label: 'Route / Navigation geprüft und bereit' },
  { id: 'waren',     label: 'Bestellungen vollständig & gesichert verladen' },
];

const STORAGE_PREFIX = 'mise_safety_check_';

export function FahrerPhase1428TourSicherheitsCheck({ batchId, isOnline, onConfirmed }: Props) {
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [dismissed, setDismissed] = useState(false);
  const [confirmed, setConfirmed]  = useState(false);

  useEffect(() => {
    if (!batchId) return;
    const done = localStorage.getItem(STORAGE_PREFIX + batchId);
    if (done === '1') setDismissed(true);
  }, [batchId]);

  if (!isOnline || !batchId || dismissed) return null;

  const allChecked = CHECKS.every((c) => checked.has(c.id));

  function toggle(id: string) {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handleConfirm() {
    if (!allChecked) return;
    localStorage.setItem(STORAGE_PREFIX + batchId!, '1');
    setConfirmed(true);
    setTimeout(() => {
      setDismissed(true);
      onConfirmed?.();
    }, 1200);
  }

  return (
    <div className="rounded-xl border border-amber-200 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-amber-600 dark:text-amber-400" />
          <span className="text-sm font-semibold text-amber-800 dark:text-amber-200">Sicherheits-Check vor Tour</span>
        </div>
        <button
          onClick={() => { localStorage.setItem(STORAGE_PREFIX + batchId!, '1'); setDismissed(true); }}
          className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
          aria-label="Überspringen"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="px-4 pb-4 space-y-3">
        {/* Checkliste */}
        <div className="space-y-2">
          {CHECKS.map((c) => {
            const on = checked.has(c.id);
            return (
              <button
                key={c.id}
                onClick={() => toggle(c.id)}
                className={cn(
                  'w-full flex items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors',
                  on
                    ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-700'
                    : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700',
                )}
              >
                {on
                  ? <CheckSquare className="w-4 h-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                  : <Square className="w-4 h-4 shrink-0 text-slate-400" />
                }
                <span className={cn(
                  'text-xs font-medium',
                  on ? 'text-emerald-800 dark:text-emerald-200' : 'text-slate-700 dark:text-slate-300',
                )}>
                  {c.label}
                </span>
              </button>
            );
          })}
        </div>

        {/* Warnung wenn nicht alle gecheckt */}
        {!allChecked && (
          <div className="flex items-center gap-2 rounded-lg bg-amber-100 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-700 px-3 py-2">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-amber-600 dark:text-amber-400" />
            <p className="text-xs text-amber-700 dark:text-amber-300">
              Bitte alle {CHECKS.length} Punkte bestätigen
            </p>
          </div>
        )}

        {/* Bestätigen-Button */}
        <button
          onClick={handleConfirm}
          disabled={!allChecked}
          className={cn(
            'w-full rounded-lg py-2.5 text-sm font-bold transition-colors',
            confirmed
              ? 'bg-emerald-500 text-white cursor-default'
              : allChecked
              ? 'bg-matcha-600 text-white hover:bg-matcha-700 dark:bg-matcha-500 dark:hover:bg-matcha-600'
              : 'bg-slate-200 dark:bg-slate-700 text-slate-400 dark:text-slate-500 cursor-not-allowed',
          )}
        >
          {confirmed ? '✓ Tour freigegeben!' : 'Tour starten'}
        </button>
      </div>
    </div>
  );
}
