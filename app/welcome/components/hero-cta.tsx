'use client';

import { ArrowRight } from 'lucide-react';
import { ConfettiButton, Magnetic } from './animations';

export function HeroCTA({ label, href = '/use-case' }: { label: string; href?: string }) {
  return (
    <Magnetic>
      <ConfettiButton
        onClickFinal={() => { window.location.href = href; }}
        className="group inline-flex h-14 items-center gap-3 rounded-full bg-accent px-7 font-display text-base font-bold text-matcha-900 hover:bg-accent/90 transition-all shadow-lg shadow-accent/20"
      >
        {label}
        <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
      </ConfettiButton>
    </Magnetic>
  );
}
