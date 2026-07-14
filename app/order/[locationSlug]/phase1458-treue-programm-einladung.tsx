'use client';

import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { Gift, X, Star, ChevronRight } from 'lucide-react';

// Phase 1458 — Treue-Programm-Einladung (Storefront)
// Nach 3. Bestellung: Banner "Werde Stammkunde + 10% Rabatt"; schließbar; localStorage-Guard; nach Phase1453

const STORAGE_KEY_DISMISSED = 'treue_einladung_dismissed';
const STORAGE_KEY_ORDER_COUNT = 'bestellhistorie_cache';

interface Props {
  locationId: string;
  onJoin?: () => void;
}

function getBestellCount(): number {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_ORDER_COUNT);
    if (!raw) return 0;
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed.length;
    return 0;
  } catch { return 0; }
}

function isDismissed(locationId: string): boolean {
  try {
    const raw = localStorage.getItem(`${STORAGE_KEY_DISMISSED}_${locationId}`);
    if (!raw) return false;
    const { dismissed_at } = JSON.parse(raw) as { dismissed_at: string };
    const daysSince = (Date.now() - new Date(dismissed_at).getTime()) / (1000 * 60 * 60 * 24);
    return daysSince < 30; // Wieder zeigen nach 30 Tagen
  } catch { return false; }
}

function setDismissed(locationId: string): void {
  try {
    localStorage.setItem(
      `${STORAGE_KEY_DISMISSED}_${locationId}`,
      JSON.stringify({ dismissed_at: new Date().toISOString() }),
    );
  } catch {}
}

export function StorefrontPhase1458TreueProgrammEinladung({ locationId, onJoin }: Props) {
  const [show, setShow] = useState(false);
  const [mounted, setMounted] = useState(false);
  const hasChecked = useRef(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted || hasChecked.current) return;
    hasChecked.current = true;

    if (isDismissed(locationId)) return;

    const count = getBestellCount();
    if (count >= 3) {
      const t = setTimeout(() => setShow(true), 800);
      return () => clearTimeout(t);
    }
  }, [mounted, locationId]);

  const handleDismiss = () => {
    setShow(false);
    setDismissed(locationId);
  };

  const handleJoin = () => {
    setShow(false);
    setDismissed(locationId);
    onJoin?.();
  };

  if (!mounted || !show) return null;

  return (
    <div
      className={cn(
        'fixed bottom-4 left-4 right-4 z-50 max-w-sm mx-auto',
        'animate-in slide-in-from-bottom-4 fade-in duration-300',
      )}
    >
      <div className="rounded-2xl bg-gradient-to-br from-violet-600 to-indigo-700 shadow-2xl shadow-violet-900/30 overflow-hidden">
        {/* Header-Stripe */}
        <div className="flex items-start gap-3 px-4 pt-4 pb-3">
          <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
            <Gift className="w-5 h-5 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-base font-bold text-white leading-tight">
              Werde Stammkunde!
            </p>
            <p className="text-sm text-violet-200 mt-0.5 leading-tight">
              Du hast bereits 3 Bestellungen – sichere dir jetzt 10&nbsp;% Rabatt auf jede weitere.
            </p>
          </div>
          <button
            onClick={handleDismiss}
            aria-label="Schließen"
            className="shrink-0 -mt-1 -mr-1 p-1.5 rounded-lg bg-white/10 hover:bg-white/20 transition-colors"
          >
            <X className="w-4 h-4 text-white" />
          </button>
        </div>

        {/* Sterne-Dekoration */}
        <div className="flex items-center gap-1 px-4 pb-2">
          {[1, 2, 3].map(i => (
            <Star key={i} className="w-3.5 h-3.5 text-amber-300 fill-amber-300" />
          ))}
          <span className="text-xs text-violet-200 ml-1">Treuekunde-Status freigeschaltet</span>
        </div>

        {/* CTA */}
        <div className="px-4 pb-4">
          <button
            onClick={handleJoin}
            className="w-full flex items-center justify-center gap-2 bg-white text-violet-700 font-bold text-sm rounded-xl py-2.5 hover:bg-violet-50 active:scale-95 transition-all duration-150"
          >
            10&nbsp;% Rabatt aktivieren
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
