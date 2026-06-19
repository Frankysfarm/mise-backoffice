'use client';

/**
 * BestellDelayBanner — Phase 300
 *
 * Proaktiver Delay-Banner für die Storefront:
 * Erscheint wenn die ETA überschritten wurde oder die Küche überlastet ist.
 * Zeigt eine ehrliche Wartezeit-Info und optionales Entschuldigungs-Voucher-Angebot.
 *
 * Logik:
 * - Berechnet Verspätung anhand eta_latest + aktueller Uhrzeit
 * - Zeigt Banner nur wenn Verspätung > 5 Minuten
 * - Aktualisiert sich alle 60 Sekunden
 */

import { useEffect, useState } from 'react';
import { AlertTriangle, Clock, Gift, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  etaLatest: string | null;     // ISO timestamp
  etaEarliest: string | null;   // ISO timestamp
  status: string;               // Bestellstatus
  orderId?: string;
}

type DelayLevel = 'slight' | 'moderate' | 'severe';

function calcDelay(etaLatest: string | null, status: string): { minutes: number; level: DelayLevel } | null {
  // Nur zeigen wenn Bestellung noch nicht geliefert
  if (!etaLatest) return null;
  if (status === 'geliefert' || status === 'delivered' || status === 'abgeholt') return null;

  const etaMs = new Date(etaLatest).getTime();
  const nowMs = Date.now();
  const delayMin = Math.floor((nowMs - etaMs) / 60_000);

  if (delayMin < 5) return null;

  const level: DelayLevel = delayMin >= 20 ? 'severe' : delayMin >= 10 ? 'moderate' : 'slight';
  return { minutes: delayMin, level };
}

const DELAY_COPY: Record<DelayLevel, { title: string; msg: string; color: string; bg: string; border: string }> = {
  slight: {
    title: 'Kurze Verzögerung',
    msg: 'Es dauert etwas länger als geplant. Wir geben alles, damit Ihre Bestellung frisch ankommt.',
    color: 'text-amber-800',
    bg: 'bg-amber-50',
    border: 'border-amber-300',
  },
  moderate: {
    title: 'Wir entschuldigen uns',
    msg: 'Ihre Bestellung verzögert sich. Unser Küchen-Team arbeitet mit Hochdruck. Danke für Ihre Geduld!',
    color: 'text-orange-800',
    bg: 'bg-orange-50',
    border: 'border-orange-300',
  },
  severe: {
    title: 'Erhebliche Verzögerung',
    msg: 'Es tut uns sehr leid — Ihre Bestellung verzögert sich deutlich. Als kleines Dankeschön für Ihre Geduld haben wir einen Rabatt für Ihre nächste Bestellung vorbereitet.',
    color: 'text-red-800',
    bg: 'bg-red-50',
    border: 'border-red-300',
  },
};

export function BestellDelayBanner({ etaLatest, etaEarliest, status, orderId }: Props) {
  const [delay, setDelay] = useState(() => calcDelay(etaLatest, status));
  const [dismissed, setDismissed] = useState(false);
  const [voucherRequested, setVoucherRequested] = useState(false);

  useEffect(() => {
    const iv = setInterval(() => setDelay(calcDelay(etaLatest, status)), 60_000);
    return () => clearInterval(iv);
  }, [etaLatest, status]);

  // Wenn Status sich ändert, recalculate
  useEffect(() => {
    setDelay(calcDelay(etaLatest, status));
    setDismissed(false);
  }, [status, etaLatest]);

  if (!delay || dismissed) return null;

  const copy = DELAY_COPY[delay.level];

  async function requestVoucher() {
    if (!orderId) return;
    setVoucherRequested(true);
    try {
      await fetch(`/api/delivery/orders/${orderId}/delay-voucher`, { method: 'POST' });
    } catch {}
  }

  return (
    <div className={cn('rounded-xl border p-4 space-y-2', copy.bg, copy.border)}>
      <div className="flex items-start gap-2">
        <AlertTriangle size={16} className={cn('shrink-0 mt-0.5', copy.color)} />
        <div className="flex-1 min-w-0">
          <div className={cn('font-semibold text-sm', copy.color)}>
            {copy.title}
          </div>
          <div className={cn('text-xs mt-0.5 leading-relaxed', copy.color.replace('800', '700'))}>
            {copy.msg}
          </div>

          {/* Verzögerungsanzeige */}
          <div className="flex items-center gap-1.5 mt-2 text-xs">
            <Clock size={12} className={copy.color} />
            <span className={cn('font-medium', copy.color)}>
              Verspätung: ca. {delay.minutes} Min
            </span>
          </div>

          {/* Voucher für schwere Verspätung */}
          {delay.level === 'severe' && !voucherRequested && orderId && (
            <button
              onClick={requestVoucher}
              className="mt-2.5 flex items-center gap-1.5 rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-700 transition-colors"
            >
              <Gift size={12} />
              Rabatt-Gutschein anfordern
            </button>
          )}
          {voucherRequested && (
            <div className="mt-2 text-xs font-medium text-red-700 flex items-center gap-1">
              ✓ Gutschein wird per E-Mail zugesendet
            </div>
          )}
        </div>

        <button
          onClick={() => setDismissed(true)}
          className={cn('shrink-0 rounded-full p-0.5 hover:bg-black/10 transition-colors', copy.color)}
        >
          <X size={14} />
        </button>
      </div>
    </div>
  );
}
