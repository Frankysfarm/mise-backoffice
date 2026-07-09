'use client';

import { useEffect, useState, useRef } from 'react';
import { cn } from '@/lib/utils';
import { Clock, ShoppingBag, X } from 'lucide-react';

/**
 * Phase 1011 — Bestellabbruch-Prävention-Banner (Storefront)
 *
 * Erscheint wenn Kunde >3 Min im Checkout ohne Abschluss ist.
 * Bietet Motivations-Banner mit Liefer-ETA + Social-Proof.
 */

interface Props {
  checkoutOpen: boolean;
  etaMinuten?: number;
  className?: string;
}

const TRIGGER_MS = 3 * 60 * 1000;

const MESSAGES = [
  { icon: '⚡', text: 'Noch schnell bestellen — Lieferung in ~{eta} Min!' },
  { icon: '🛍️', text: 'Dein Warenkorb wartet — jetzt in {eta} Min bei dir!' },
  { icon: '🔥', text: 'Heute schon {count}x bestellt — sei dabei!' },
  { icon: '✅', text: 'Fast fertig! Nur noch bestätigen.' },
];

export function StorefrontPhase1011BestellabbruchPraevention({ checkoutOpen, etaMinuten = 30, className }: Props) {
  const [visible, setVisible] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [msgIdx, setMsgIdx] = useState(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rotateRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const openedAtRef = useRef<number | null>(null);

  useEffect(() => {
    if (checkoutOpen && !dismissed) {
      openedAtRef.current = Date.now();
      timerRef.current = setTimeout(() => {
        setVisible(true);
        rotateRef.current = setInterval(() => {
          setMsgIdx(i => (i + 1) % MESSAGES.length);
        }, 6_000);
      }, TRIGGER_MS);
    } else {
      setVisible(false);
      if (timerRef.current) clearTimeout(timerRef.current);
      if (rotateRef.current) clearInterval(rotateRef.current);
    }

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (rotateRef.current) clearInterval(rotateRef.current);
    };
  }, [checkoutOpen, dismissed]);

  useEffect(() => {
    if (!checkoutOpen) {
      setDismissed(false);
      setVisible(false);
    }
  }, [checkoutOpen]);

  if (!visible || !checkoutOpen) return null;

  const msg = MESSAGES[msgIdx % MESSAGES.length];
  const text = (msg?.text ?? '')
    .replace('{eta}', String(etaMinuten))
    .replace('{count}', String(Math.floor(Math.random() * 30) + 40));

  return (
    <div
      className={cn(
        'fixed bottom-20 left-1/2 -translate-x-1/2 z-50 w-[calc(100%-2rem)] max-w-sm',
        'animate-in slide-in-from-bottom-4 duration-300',
        className,
      )}
    >
      <div className="rounded-2xl border border-matcha-300 bg-matcha-50 shadow-lg px-4 py-3 flex items-center gap-3">
        <span className="text-2xl shrink-0">{msg?.icon ?? '⚡'}</span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-matcha-800 leading-tight">{text}</p>
          <div className="flex items-center gap-1.5 mt-1">
            <Clock className="h-3 w-3 text-matcha-600 shrink-0" />
            <span className="text-[11px] text-matcha-600 font-medium">Lieferzeit ca. {etaMinuten} Min</span>
            <span className="text-[11px] text-matcha-400">·</span>
            <ShoppingBag className="h-3 w-3 text-matcha-600 shrink-0" />
            <span className="text-[11px] text-matcha-600 font-medium">Warenkorb gesichert</span>
          </div>
        </div>
        <button
          onClick={() => { setDismissed(true); setVisible(false); }}
          className="shrink-0 rounded-full p-1 hover:bg-matcha-100 transition text-matcha-500"
          aria-label="Schließen"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
