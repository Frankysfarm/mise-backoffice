'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { Tag, X, ChevronLeft, ChevronRight } from 'lucide-react';

// Phase 1516 — Aktions-Banner-Ticker (Storefront)
// Schließbarer Ticker mit aktuellen Angeboten/Rabattcodes;
// localStorage-Guard 1 Tag; Hydration-safe; nach Phase1511.

interface Aktion {
  id: string;
  text: string;
  code?: string;
  farbe: 'amber' | 'emerald' | 'blue' | 'rose';
}

interface Props {
  locationId: string;
  aktionen?: Aktion[];
  className?: string;
}

const DEFAULT_AKTIONEN: Aktion[] = [
  { id: 'ak1', text: '🎉 10% Rabatt auf alle Bestellungen heute!', code: 'HEUTE10', farbe: 'amber' },
  { id: 'ak2', text: '🚀 Kostenlose Lieferung ab 20 € Bestellwert', farbe: 'emerald' },
  { id: 'ak3', text: '⚡ Express-Lieferung in 25 Minuten verfügbar', farbe: 'blue' },
];

const LS_KEY_PREFIX = 'mise_ticker_dismissed_';
const DISMISS_DURATION_MS = 24 * 60 * 60 * 1000;

const FARBE_CONFIG: Record<string, { bg: string; text: string; border: string; codeBg: string }> = {
  amber: {
    bg: 'bg-amber-50 dark:bg-amber-950/30',
    text: 'text-amber-800 dark:text-amber-200',
    border: 'border-amber-200 dark:border-amber-800',
    codeBg: 'bg-amber-200 dark:bg-amber-800 text-amber-900 dark:text-amber-100',
  },
  emerald: {
    bg: 'bg-emerald-50 dark:bg-emerald-950/30',
    text: 'text-emerald-800 dark:text-emerald-200',
    border: 'border-emerald-200 dark:border-emerald-800',
    codeBg: 'bg-emerald-200 dark:bg-emerald-800 text-emerald-900 dark:text-emerald-100',
  },
  blue: {
    bg: 'bg-blue-50 dark:bg-blue-950/30',
    text: 'text-blue-800 dark:text-blue-200',
    border: 'border-blue-200 dark:border-blue-800',
    codeBg: 'bg-blue-200 dark:bg-blue-800 text-blue-900 dark:text-blue-100',
  },
  rose: {
    bg: 'bg-rose-50 dark:bg-rose-950/30',
    text: 'text-rose-800 dark:text-rose-200',
    border: 'border-rose-200 dark:border-rose-800',
    codeBg: 'bg-rose-200 dark:bg-rose-800 text-rose-900 dark:text-rose-100',
  },
};

export function StorefrontPhase1516AktionsBannerTicker({ locationId, aktionen, className }: Props) {
  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(false);
  const [current, setCurrent] = useState(0);
  const [copied, setCopied] = useState<string | null>(null);

  const items = aktionen && aktionen.length > 0 ? aktionen : DEFAULT_AKTIONEN;

  useEffect(() => {
    setMounted(true);
    try {
      const raw = localStorage.getItem(`${LS_KEY_PREFIX}${locationId}`);
      if (raw) {
        const ts = parseInt(raw, 10);
        if (!isNaN(ts) && Date.now() - ts < DISMISS_DURATION_MS) {
          return;
        }
      }
      setVisible(true);
    } catch {
      setVisible(true);
    }
  }, [locationId]);

  useEffect(() => {
    if (!visible || items.length <= 1) return;
    const iv = setInterval(() => {
      setCurrent(prev => (prev + 1) % items.length);
    }, 4000);
    return () => clearInterval(iv);
  }, [visible, items.length]);

  function dismiss() {
    setVisible(false);
    try {
      localStorage.setItem(`${LS_KEY_PREFIX}${locationId}`, String(Date.now()));
    } catch {
      // ignore
    }
  }

  function prev() {
    setCurrent(p => (p - 1 + items.length) % items.length);
  }

  function next() {
    setCurrent(p => (p + 1) % items.length);
  }

  async function copyCode(code: string) {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(code);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      // ignore
    }
  }

  if (!mounted || !visible || items.length === 0) return null;

  const aktion = items[current];
  const farbe = FARBE_CONFIG[aktion.farbe] ?? FARBE_CONFIG.amber;

  return (
    <div
      className={cn(
        'relative flex items-center gap-2 rounded-xl border px-3 py-2.5 text-sm',
        farbe.bg, farbe.text, farbe.border,
        className,
      )}
    >
      <Tag className="w-3.5 h-3.5 shrink-0 opacity-70" />

      <span className="flex-1 text-[13px] font-medium leading-tight">
        {aktion.text}
      </span>

      {aktion.code && (
        <button
          onClick={() => copyCode(aktion.code!)}
          className={cn(
            'shrink-0 rounded px-1.5 py-0.5 text-[11px] font-bold font-mono transition-opacity',
            farbe.codeBg,
            copied === aktion.code ? 'opacity-60' : 'hover:opacity-80',
          )}
          title="Code kopieren"
        >
          {copied === aktion.code ? '✓ Kopiert' : aktion.code}
        </button>
      )}

      {items.length > 1 && (
        <>
          <button
            onClick={prev}
            className="shrink-0 opacity-60 hover:opacity-100 transition-opacity"
            aria-label="Vorherige Aktion"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
          </button>
          <span className="text-[10px] opacity-50 shrink-0">{current + 1}/{items.length}</span>
          <button
            onClick={next}
            className="shrink-0 opacity-60 hover:opacity-100 transition-opacity"
            aria-label="Nächste Aktion"
          >
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </>
      )}

      <button
        onClick={dismiss}
        className="shrink-0 opacity-40 hover:opacity-80 transition-opacity"
        aria-label="Schließen"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}
