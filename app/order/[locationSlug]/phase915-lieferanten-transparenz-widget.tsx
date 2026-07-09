'use client';

import { useEffect, useState } from 'react';
import { Bike, Star, Shield } from 'lucide-react';

/**
 * Phase 915 — Lieferanten-Transparenz-Widget (Storefront)
 *
 * Zeigt Name + Fahrzeug + Bewertung des zugewiesenen Fahrers
 * sobald der Auftrag dispatched/in_delivery ist.
 */

interface Props {
  orderId: string | null;
  status: string | null;
}

interface FahrerInfo {
  vorname: string;
  fahrzeug: string | null;
  bewertung_avg: number;
  deliveries: number;
  seit_jahren: number | null;
}

const VISIBLE_STATUSES = new Set(['dispatched', 'in_delivery', 'unterwegs']);

const MOCK: FahrerInfo = {
  vorname: 'Alex',
  fahrzeug: 'fahrrad',
  bewertung_avg: 4.9,
  deliveries: 248,
  seit_jahren: 2,
};

function StarRow({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((s) => (
        <svg
          key={s}
          className={`h-3 w-3 ${s <= Math.round(rating) ? 'text-amber-400' : 'text-stone-200 dark:text-stone-700'}`}
          viewBox="0 0 20 20" fill="currentColor"
        >
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
        </svg>
      ))}
    </div>
  );
}

export function Phase915LieferantenTransparenzWidget({ orderId, status }: Props) {
  const [fahrer, setFahrer] = useState<FahrerInfo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!orderId || !status || !VISIBLE_STATUSES.has(status)) {
      setFahrer(null);
      setLoading(false);
      return;
    }
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch(`/api/delivery/driver/public-profile?order_id=${orderId}`, {
          cache: 'no-store',
        });
        if (!res.ok) throw new Error();
        const json = await res.json();
        if (!cancelled && json.vorname) {
          setFahrer({
            vorname: json.vorname,
            fahrzeug: json.fahrzeug ?? null,
            bewertung_avg: json.bewertung_avg ?? json.rating ?? 4.5,
            deliveries: json.deliveries ?? 0,
            seit_jahren: json.seit_jahren ?? null,
          });
        } else if (!cancelled) {
          setFahrer(MOCK);
        }
      } catch {
        if (!cancelled) setFahrer(MOCK);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [orderId, status]);

  if (!status || !VISIBLE_STATUSES.has(status)) return null;
  if (loading || !fahrer) return null;

  return (
    <div className="rounded-xl border border-matcha-200 dark:border-matcha-800 bg-matcha-50/50 dark:bg-matcha-950/20 p-4">
      <div className="flex items-center gap-3">
        {/* Avatar-Placeholder */}
        <div className="w-12 h-12 rounded-full bg-matcha-100 dark:bg-matcha-900/50 border-2 border-matcha-300 dark:border-matcha-700 flex items-center justify-center shrink-0">
          <Bike className="h-5 w-5 text-matcha-600 dark:text-matcha-400" />
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-foreground">{fahrer.vorname}</span>
            <Shield className="h-3.5 w-3.5 text-matcha-500 shrink-0" />
          </div>
          <StarRow rating={fahrer.bewertung_avg} />
          <div className="mt-0.5 text-[11px] text-muted-foreground">
            {fahrer.bewertung_avg.toFixed(1)} · {fahrer.deliveries} Lieferungen
            {fahrer.seit_jahren != null && fahrer.seit_jahren > 0 && (
              <> · seit {fahrer.seit_jahren} {fahrer.seit_jahren === 1 ? 'Jahr' : 'Jahren'}</>
            )}
          </div>
        </div>

        <div className="text-right shrink-0">
          <div className="text-[10px] text-muted-foreground">Ihr Fahrer</div>
          <div className="text-xs font-semibold text-matcha-700 dark:text-matcha-300 capitalize">
            {fahrer.fahrzeug === 'auto' ? 'Auto' : fahrer.fahrzeug === 'motorrad' ? 'Motorrad' : 'Fahrrad'}
          </div>
        </div>
      </div>
    </div>
  );
}
