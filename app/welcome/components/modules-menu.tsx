'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { MODULES } from '../modules';
import { cn } from '@/lib/utils';

export function ModulesMenu() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="inline-flex items-center gap-1 text-matcha-100 hover:text-white text-sm"
      >
        Module
        <ChevronDown className={cn('h-3 w-3 transition-transform', open && 'rotate-180')} />
      </button>

      {open && (
        <div className="absolute top-full right-0 mt-2 w-[560px] max-w-[90vw] rounded-2xl border border-white/10 bg-matcha-900/95 backdrop-blur shadow-strong p-3 grid grid-cols-2 gap-1">
          {MODULES.map((m) => (
            <Link
              key={m.slug}
              href={`/welcome/${m.slug}`}
              onClick={() => setOpen(false)}
              className="flex items-start gap-3 rounded-xl px-3 py-2.5 hover:bg-white/5 transition"
            >
              <div className="text-2xl shrink-0">{m.icon}</div>
              <div className="min-w-0">
                <div className="font-display text-sm font-bold text-white">{m.badge}</div>
                <div className="text-[11px] text-matcha-300 line-clamp-2">{m.tagline}</div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
