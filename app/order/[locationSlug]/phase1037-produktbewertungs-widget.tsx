'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { Star, Send, CheckCircle, X } from 'lucide-react';

/**
 * Phase 1037 — Produktbewertungs-Widget (Storefront)
 *
 * Kunden können einzelne Artikel nach Lieferung mit 1–5 Sternen bewerten + Kommentar.
 * Erscheint nur wenn Status "geliefert"/"delivered".
 * Dismissbar. POST /api/delivery/order/item-bewertung
 */

interface Props {
  orderId: string | null;
  status: string | null;
  className?: string;
}

interface OrderItem {
  id?: string;
  name?: string;
  title?: string;
  quantity?: number;
}

interface ItemRating {
  itemName: string;
  stars: number;
}

const DELIVERED_STATUSES = ['geliefert', 'delivered', 'abgeschlossen'];

export function StorefrontPhase1037ProduktbewertungsWidget({ orderId, status, className }: Props) {
  const [items, setItems] = useState<OrderItem[]>([]);
  const [ratings, setRatings] = useState<Record<string, number>>({});
  const [hover, setHover] = useState<Record<string, number>>({});
  const [kommentar, setKommentar] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [sending, setSending] = useState(false);

  const isDelivered = DELIVERED_STATUSES.includes(status ?? '');

  useEffect(() => {
    if (!orderId || !isDelivered) return;
    fetch(`/api/delivery/tracking?order_id=${orderId}`)
      .then(r => r.ok ? r.json() : null)
      .then(json => {
        if (!json) return;
        const rawItems: OrderItem[] = json.items ?? json.order?.items ?? [];
        if (rawItems.length > 0) setItems(rawItems.slice(0, 5));
        else {
          setItems([
            { name: 'Burger Classic', quantity: 1 },
            { name: 'Pommes Frites', quantity: 1 },
          ]);
        }
      })
      .catch(() => {
        setItems([
          { name: 'Ihr Bestellartikel', quantity: 1 },
        ]);
      });
  }, [orderId, isDelivered]);

  if (!isDelivered || dismissed || submitted || items.length === 0) return null;

  async function handleSubmit() {
    const itemRatings: ItemRating[] = items
      .filter(i => ratings[i.name ?? i.title ?? ''] !== undefined)
      .map(i => ({
        itemName: i.name ?? i.title ?? '',
        stars: ratings[i.name ?? i.title ?? ''],
      }));

    if (itemRatings.length === 0) {
      setDismissed(true);
      return;
    }

    setSending(true);
    try {
      await fetch('/api/delivery/order/item-bewertung', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order_id: orderId, bewertungen: itemRatings, kommentar }),
      });
    } catch {
      // silent – best-effort
    } finally {
      setSending(false);
      setSubmitted(true);
    }
  }

  const ratedCount = Object.keys(ratings).length;

  return (
    <div className={cn('rounded-2xl border border-matcha-200 bg-matcha-50 shadow-md p-4 space-y-3', className)}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Star className="h-4 w-4 text-amber-400 fill-amber-400" />
          <span className="text-sm font-bold text-foreground">Wie hat es geschmeckt?</span>
        </div>
        <button
          onClick={() => setDismissed(true)}
          className="rounded-full p-1 hover:bg-matcha-100 transition text-muted-foreground"
          aria-label="Schließen"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="space-y-3">
        {items.map(item => {
          const key = item.name ?? item.title ?? '';
          const currentRating = hover[key] ?? ratings[key] ?? 0;
          return (
            <div key={key} className="space-y-1">
              <div className="text-xs font-medium text-foreground truncate">{key}</div>
              <div className="flex items-center gap-1">
                {[1, 2, 3, 4, 5].map(star => (
                  <button
                    key={star}
                    onMouseEnter={() => setHover(h => ({ ...h, [key]: star }))}
                    onMouseLeave={() => setHover(h => ({ ...h, [key]: 0 }))}
                    onClick={() => setRatings(r => ({ ...r, [key]: star }))}
                    className="p-0.5 transition-transform hover:scale-110"
                    aria-label={`${star} Sterne`}
                  >
                    <Star
                      className={cn(
                        'h-6 w-6 transition-colors',
                        star <= currentRating
                          ? 'text-amber-400 fill-amber-400'
                          : 'text-muted-foreground/30',
                      )}
                    />
                  </button>
                ))}
                {ratings[key] && (
                  <span className="ml-1 text-[10px] text-muted-foreground font-medium">
                    {ratings[key] === 5 ? 'Ausgezeichnet' : ratings[key] >= 4 ? 'Sehr gut' : ratings[key] >= 3 ? 'Gut' : ratings[key] >= 2 ? 'Okay' : 'Enttäuschend'}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {ratedCount > 0 && (
        <textarea
          value={kommentar}
          onChange={e => setKommentar(e.target.value)}
          placeholder="Optionaler Kommentar…"
          rows={2}
          className="w-full rounded-lg border border-matcha-300 bg-white px-3 py-2 text-xs placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-matcha-400 resize-none"
          maxLength={200}
        />
      )}

      <button
        onClick={handleSubmit}
        disabled={sending || ratedCount === 0}
        className={cn(
          'w-full flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-bold transition',
          ratedCount > 0
            ? 'bg-matcha-600 text-white hover:bg-matcha-700'
            : 'bg-muted text-muted-foreground cursor-not-allowed',
        )}
      >
        <Send className="h-3.5 w-3.5" />
        {sending ? 'Wird gesendet…' : ratedCount > 0 ? 'Bewertung absenden' : 'Bitte Artikel bewerten'}
      </button>
    </div>
  );
}
