'use client';

import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { CheckCircle2, Circle, X } from 'lucide-react';

// Phase 1469 — Liefer-Transparenz-Status-Karte (Storefront)
// Fortschritts-Leiste: Bestellt→Zubereitung→Fertig→Unterwegs→Geliefert;
// schließbar; localStorage-basiert; Hydration-safe; nach Phase1464.

const STORAGE_KEY = 'liefer_transparenz_dismissed';

interface Props {
  locationId: string;
  orderStatus?: string | null;
  className?: string;
}

type SchritTyp = 'bestellt' | 'zubereitung' | 'fertig' | 'unterwegs' | 'geliefert';

interface Schritt {
  key: SchritTyp;
  label: string;
  statuses: string[];
}

const SCHRITTE: Schritt[] = [
  { key: 'bestellt',    label: 'Bestellt',    statuses: ['pending', 'confirmed'] },
  { key: 'zubereitung', label: 'Zubereitung', statuses: ['preparing', 'in_zubereitung', 'accepted'] },
  { key: 'fertig',      label: 'Fertig',      statuses: ['ready'] },
  { key: 'unterwegs',   label: 'Unterwegs',   statuses: ['out_for_delivery', 'in_delivery', 'dispatched'] },
  { key: 'geliefert',   label: 'Geliefert',   statuses: ['delivered', 'completed'] },
];

function getCurrentSchritt(status: string | null | undefined): number {
  if (!status) return 0;
  for (let i = SCHRITTE.length - 1; i >= 0; i--) {
    if (SCHRITTE[i].statuses.includes(status)) return i;
  }
  return 0;
}

function isDismissed(locationId: string): boolean {
  try {
    const raw = localStorage.getItem(`${STORAGE_KEY}_${locationId}`);
    if (!raw) return false;
    const { ts } = JSON.parse(raw) as { ts: number };
    return Date.now() - ts < 30 * 60 * 1000;
  } catch { return false; }
}

function setDismissed(locationId: string): void {
  try {
    localStorage.setItem(`${STORAGE_KEY}_${locationId}`, JSON.stringify({ ts: Date.now() }));
  } catch {}
}

export function StorefrontPhase1469LieferTransparenzStatus({ locationId, orderStatus, className }: Props) {
  const [show, setShow] = useState(false);
  const [mounted, setMounted] = useState(false);
  const checked = useRef(false);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (!mounted || checked.current) return;
    checked.current = true;
    if (!orderStatus) return;
    if (isDismissed(locationId)) return;
    setShow(true);
  }, [mounted, orderStatus, locationId]);

  if (!show || !mounted || !orderStatus) return null;

  const currentIdx = getCurrentSchritt(orderStatus);

  function dismiss() {
    setDismissed(locationId);
    setShow(false);
  }

  return (
    <div className={cn(
      'relative rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-4 shadow-sm',
      className,
    )}>
      {/* Close */}
      <button
        onClick={dismiss}
        className="absolute top-3 right-3 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
        aria-label="Schließen"
      >
        <X className="w-4 h-4" />
      </button>

      <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-3 uppercase tracking-wide">
        Ihr Bestellstatus
      </p>

      {/* Steps */}
      <div className="flex items-start gap-0">
        {SCHRITTE.map((schritt, idx) => {
          const done = idx <= currentIdx;
          const active = idx === currentIdx;
          const isLast = idx === SCHRITTE.length - 1;

          return (
            <div key={schritt.key} className="flex-1 flex flex-col items-center">
              {/* Circle + line */}
              <div className="flex items-center w-full">
                <div className={cn(
                  'w-5 h-5 rounded-full flex items-center justify-center shrink-0 z-10',
                  done
                    ? 'bg-emerald-500 text-white'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-400',
                  active && !done && 'ring-2 ring-emerald-400 ring-offset-1',
                )}>
                  {done
                    ? <CheckCircle2 className="w-3.5 h-3.5" />
                    : <Circle className="w-2.5 h-2.5" />
                  }
                </div>
                {!isLast && (
                  <div className={cn(
                    'flex-1 h-0.5 transition-colors duration-500',
                    idx < currentIdx ? 'bg-emerald-500' : 'bg-slate-200 dark:bg-slate-700',
                  )} />
                )}
              </div>

              {/* Label */}
              <span className={cn(
                'mt-1.5 text-[9px] font-semibold text-center leading-tight px-0.5',
                active ? 'text-emerald-600 dark:text-emerald-400' : done ? 'text-slate-600 dark:text-slate-400' : 'text-slate-400 dark:text-slate-600',
              )}>
                {schritt.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
