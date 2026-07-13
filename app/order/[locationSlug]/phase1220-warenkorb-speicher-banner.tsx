'use client';

// Phase 1220 — Warenkorb-Speicher-Banner (Storefront)
// "Ihr Warenkorb wurde gespeichert" Banner nach 30s Inaktivität + Wiederherstellungs-Button

import { useCallback, useEffect, useRef, useState } from 'react';
import { ShoppingCart, X, RotateCcw } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { CartItem } from './components/types';

interface Props {
  cart: CartItem[];
  onRestoreCart: (items: CartItem[]) => void;
  inactivitySeconds?: number;
}

const STORAGE_KEY = 'mise_saved_cart';
const DEFAULT_INACTIVITY_SEC = 30;

export function Phase1220WarenkorbSpeicherBanner({ cart, onRestoreCart, inactivitySeconds = DEFAULT_INACTIVITY_SEC }: Props) {
  const [visible, setVisible] = useState(false);
  const [saved, setSaved] = useState(false);
  const [savedCart, setSavedCart] = useState<CartItem[]>([]);
  const [dismissed, setDismissed] = useState(false);
  const inactivityRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cartRef = useRef(cart);

  // Track latest cart
  useEffect(() => {
    cartRef.current = cart;
  }, [cart]);

  // Save cart to localStorage when timer fires
  const saveCart = useCallback(() => {
    const current = cartRef.current;
    if (current.length === 0) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(current));
    } catch { /* storage not available */ }
    setSavedCart(current);
    setSaved(true);
    setVisible(true);
    setDismissed(false);
  }, []);

  // Reset inactivity timer on user activity
  const resetTimer = useCallback(() => {
    if (inactivityRef.current) clearTimeout(inactivityRef.current);
    if (cartRef.current.length === 0) return;
    inactivityRef.current = setTimeout(saveCart, inactivitySeconds * 1000);
  }, [saveCart, inactivitySeconds]);

  // Restore previously saved cart from localStorage on mount
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw && cart.length === 0) {
        const parsed: CartItem[] = JSON.parse(raw);
        if (parsed.length > 0) {
          setSavedCart(parsed);
          setVisible(true);
        }
      }
    } catch { /* ignore */ }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Hide banner when cart is empty (no saved cart in storage) or dismissed
  useEffect(() => {
    if (cart.length === 0) {
      setVisible(false);
      setSaved(false);
    }
  }, [cart.length]);

  // Activity tracking
  useEffect(() => {
    const events: Array<keyof WindowEventMap> = ['mousemove', 'keydown', 'touchstart', 'scroll', 'click'];
    for (const e of events) window.addEventListener(e, resetTimer, { passive: true });
    resetTimer();
    return () => {
      for (const e of events) window.removeEventListener(e, resetTimer);
      if (inactivityRef.current) clearTimeout(inactivityRef.current);
    };
  }, [resetTimer]);

  const handleRestore = useCallback(() => {
    const toRestore = savedCart;
    try { localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
    onRestoreCart(toRestore);
    setVisible(false);
    setSaved(false);
    setSavedCart([]);
  }, [savedCart, onRestoreCart]);

  const handleDismiss = useCallback(() => {
    setDismissed(true);
    setVisible(false);
    try { localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
  }, []);

  if (!visible || dismissed || savedCart.length === 0) return null;

  const totalItems = savedCart.reduce((s, i) => s + i.qty, 0);
  const totalEur = savedCart.reduce((s, i) => s + ((i.item?.price ?? 0) + (i.extra_preis ?? 0)) * i.qty, 0);

  return (
    <div
      className={cn(
        'fixed bottom-4 left-1/2 -translate-x-1/2 z-50 w-full max-w-sm mx-auto',
        'animate-in slide-in-from-bottom-4 duration-300',
      )}
    >
      <div className="mx-4 rounded-2xl border border-teal-200 dark:border-teal-800 bg-teal-50 dark:bg-teal-950/80 shadow-lg backdrop-blur-sm px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="rounded-full bg-teal-100 dark:bg-teal-900 p-2 shrink-0">
            <ShoppingCart className="h-4 w-4 text-teal-600 dark:text-teal-400" />
          </div>

          <div className="flex-1 min-w-0">
            <p className="text-xs font-bold text-teal-800 dark:text-teal-300">
              {saved ? 'Warenkorb gespeichert' : 'Gespeicherter Warenkorb'}
            </p>
            <p className="text-[10px] text-teal-600 dark:text-teal-400 truncate">
              {totalItems} Artikel · {totalEur.toFixed(2)} €
            </p>
          </div>

          <button
            onClick={handleRestore}
            className={cn(
              'flex items-center gap-1 rounded-lg px-2.5 py-1.5 shrink-0',
              'bg-teal-600 dark:bg-teal-500 text-white text-[11px] font-bold',
              'hover:bg-teal-700 dark:hover:bg-teal-400 transition',
            )}
          >
            <RotateCcw className="h-3 w-3" />
            Wiederherstellen
          </button>

          <button
            onClick={handleDismiss}
            className="rounded-full p-1 hover:bg-teal-100 dark:hover:bg-teal-900 transition shrink-0"
            aria-label="Schließen"
          >
            <X className="h-3.5 w-3.5 text-teal-500" />
          </button>
        </div>
      </div>
    </div>
  );
}
