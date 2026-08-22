'use client';

import { useEffect, useRef, useState } from 'react';
import { Check, ChevronDown, Languages } from 'lucide-react';
import { LOCALES, type Locale } from '@/lib/i18n-storefront';
import { cn } from '@/lib/utils';

type Props = {
  current: Locale;
  onChange?: (loc: Locale) => void;
};

/** Setzt Cookie + reloadet die Seite — Server-rendering nutzt den Cookie beim nächsten Request. */
export function LanguageSwitcher({ current, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, []);

  function pick(loc: Locale) {
    document.cookie = `mise_locale=${loc};path=/;max-age=${60 * 60 * 24 * 365};samesite=lax`;
    onChange?.(loc);
    setOpen(false);
    window.location.reload();
  }

  const cur = LOCALES.find((l) => l.id === current) ?? LOCALES[0];

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-xs font-medium text-white/90 backdrop-blur-sm ring-1 ring-white/10 hover:bg-white/15"
        aria-label="Sprache wechseln"
      >
        <span>{cur.flag}</span>
        <span className="uppercase tracking-wider">{cur.id}</span>
        <ChevronDown className={cn('h-3 w-3 transition', open && 'rotate-180')} />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-44 rounded-xl border border-white/10 bg-matcha-950/95 backdrop-blur shadow-strong p-1 z-50">
          {LOCALES.map((l) => {
            const active = l.id === current;
            return (
              <button
                key={l.id}
                onClick={() => pick(l.id)}
                className={cn(
                  'flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition',
                  active ? 'bg-white/10 text-white' : 'text-white/70 hover:bg-white/5 hover:text-white',
                )}
              >
                <span className="text-base">{l.flag}</span>
                <span className="flex-1 text-left">{l.label}</span>
                {active && <Check size={12} className="text-accent" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
