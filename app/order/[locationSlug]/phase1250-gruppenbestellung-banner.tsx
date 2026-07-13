'use client';

// Phase 1250 — Gruppenbestellung-Hinweis-Banner (Storefront)
// "Bestellen Sie gemeinsam ab X€ für freie Lieferung" + kopierbarer Teilen-Link
// Props: cart, locationId, mindestbestellwert, cartEmpty · auto-dismiss

import { useEffect, useState } from 'react';
import { X, Users, Copy, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CartItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
}

interface Props {
  cart: CartItem[];
  locationId: string;
  mindestbestellwert?: number;
  cartEmpty: boolean;
}

export function Phase1250GruppenbestellungBanner({
  cart,
  locationId,
  mindestbestellwert = 50,
  cartEmpty,
}: Props) {
  const [dismissed, setDismissed] = useState(false);
  const [copied, setCopied] = useState(false);
  const [shareUrl, setShareUrl] = useState('');

  const cartTotal = cart.reduce((s, i) => s + i.price * i.quantity, 0);
  const fehlend = Math.max(0, mindestbestellwert - cartTotal);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    setShareUrl(`${window.location.origin}${window.location.pathname}?ref=group&loc=${locationId}`);
  }, [locationId]);

  const handleCopy = async () => {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // clipboard not available
    }
  };

  // Only show when cart is empty or below threshold
  if (dismissed) return null;
  if (!cartEmpty && cartTotal >= mindestbestellwert) return null;

  return (
    <div className={cn(
      'rounded-xl border border-violet-200 dark:border-violet-700 bg-violet-50 dark:bg-violet-900/10 px-4 py-3 flex gap-3 items-start',
    )}>
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-violet-600 text-white">
        <Users className="h-4 w-4" />
      </div>

      <div className="flex-1 min-w-0">
        <div className="text-sm font-bold text-violet-900 dark:text-violet-100">
          Gemeinsam bestellen — kostenlose Lieferung ab {mindestbestellwert}€
        </div>
        {fehlend > 0 ? (
          <div className="mt-0.5 text-xs text-violet-700 dark:text-violet-300">
            Noch <strong>{fehlend.toFixed(2)}€</strong> bis zur kostenlosen Lieferung — teile den Link mit Freunden!
          </div>
        ) : (
          <div className="mt-0.5 text-xs text-violet-700 dark:text-violet-300">
            Teile den Link und bestellt gemeinsam für kostenlose Lieferung.
          </div>
        )}

        {shareUrl && (
          <button
            onClick={handleCopy}
            className={cn(
              'mt-2 inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition',
              copied
                ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                : 'bg-violet-600 text-white hover:bg-violet-700',
            )}
          >
            {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
            {copied ? 'Link kopiert!' : 'Link kopieren'}
          </button>
        )}
      </div>

      <button
        onClick={() => setDismissed(true)}
        className="shrink-0 rounded-full p-0.5 text-violet-400 hover:text-violet-600 hover:bg-violet-100 dark:hover:bg-violet-800 transition"
        aria-label="Schließen"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
