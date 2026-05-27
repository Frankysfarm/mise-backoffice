'use client';

import Link from 'next/link';
import { useState, useEffect } from 'react';
import { Menu, X, ArrowRight } from 'lucide-react';
import { MODULES } from '../modules';

export function MobileNav() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="md:hidden h-9 w-9 grid place-items-center rounded-full text-white hover:bg-white/10"
        aria-label="Menü öffnen"
      >
        <Menu className="h-5 w-5" />
      </button>

      {open && (
        <div className="md:hidden fixed inset-0 z-[60] bg-matcha-900 text-white overflow-y-auto">
          <div className="flex items-center justify-between h-16 px-5 border-b border-white/10">
            <span className="font-display text-xl font-bold">Menü</span>
            <button
              onClick={() => setOpen(false)}
              className="h-9 w-9 grid place-items-center rounded-full hover:bg-white/10"
              aria-label="Schließen"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="p-5 space-y-1">
            <Link
              href="/use-case"
              onClick={() => setOpen(false)}
              className="flex items-center justify-between rounded-2xl bg-accent text-matcha-900 px-5 py-4 font-display font-bold"
            >
              Kostenlos starten
              <ArrowRight className="h-5 w-5" />
            </Link>
            <Link href="/login" onClick={() => setOpen(false)} className="block rounded-xl px-5 py-4 hover:bg-white/5 font-semibold">
              Anmelden
            </Link>
            <Link href="#pricing" onClick={() => setOpen(false)} className="block rounded-xl px-5 py-4 hover:bg-white/5 font-semibold">
              Preise
            </Link>
          </div>

          <div className="px-5 pb-8">
            <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-matcha-300 mb-3 px-2">
              Module
            </div>
            <div className="space-y-1">
              {MODULES.map((m) => (
                <Link
                  key={m.slug}
                  href={`/welcome/${m.slug}`}
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-3 rounded-xl px-4 py-3 hover:bg-white/5"
                >
                  <div className="h-9 w-9 rounded-lg bg-white/10 grid place-items-center text-accent text-sm font-bold">
                    {m.title.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold truncate">{m.title}</div>
                    <div className="text-xs text-matcha-300 truncate">{m.tagline}</div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
