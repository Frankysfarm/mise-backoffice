'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { ChevronDown, ChevronUp, Package, Tag, Zap } from 'lucide-react';
import { DELIVERY_FEE } from './components/types';

/**
 * phase888 — Liefer-Preis-Transparenz
 *
 * Aufschlüsselung der Liefergebühr: Grundgebühr + Zonen-Zuschlag + Bündelrabatt.
 * Zeigt dem Kunden transparent wie sich der Lieferpreis zusammensetzt.
 */

interface Props {
  locationId: string | null;
  isDelivery: boolean;
  zone?: string | null;
  hasBundleDiscount?: boolean;
}

interface PreisData {
  grundgebuehr: number;
  zonen_zuschlag: number;
  buendel_rabatt: number;
  gesamt: number;
  zone: string | null;
  hat_buendel: boolean;
  einsparung_durch_buendel: number;
}

function calcPreis(zone: string | null, hasBundleDiscount: boolean): PreisData {
  const grundgebuehr = DELIVERY_FEE;
  const zonen_zuschlag = zone === 'D' ? 1.0 : zone === 'C' ? 0.5 : 0;
  const buendel_rabatt = hasBundleDiscount ? 0.5 : 0;
  const gesamt = Math.max(0, grundgebuehr + zonen_zuschlag - buendel_rabatt);
  return {
    grundgebuehr,
    zonen_zuschlag,
    buendel_rabatt,
    gesamt,
    zone,
    hat_buendel: hasBundleDiscount,
    einsparung_durch_buendel: buendel_rabatt,
  };
}

export function Phase888LieferPreisTransparenz({ locationId, isDelivery, zone, hasBundleDiscount }: Props) {
  const [open, setOpen] = useState(false);
  const [preis, setPreis] = useState<PreisData | null>(null);

  useEffect(() => {
    if (!isDelivery) return;
    const p = calcPreis(zone ?? null, hasBundleDiscount ?? false);
    setPreis(p);
  }, [isDelivery, zone, hasBundleDiscount]);

  if (!isDelivery || !preis) return null;

  return (
    <div className="rounded-xl border border-blue-200 bg-blue-50/60 dark:bg-blue-950/20 px-4 py-3 my-2">
      <button
        onClick={() => setOpen(v => !v)}
        className="flex w-full items-center justify-between gap-2"
      >
        <div className="flex items-center gap-2">
          <Tag className="h-4 w-4 text-blue-500" />
          <span className="text-sm font-semibold text-blue-700 dark:text-blue-300">
            Liefergebühr {preis.gesamt.toFixed(2)} €
          </span>
          {preis.hat_buendel && (
            <span className="rounded-full bg-matcha-100 border border-matcha-300 px-2 py-0.5 text-[9px] font-bold text-matcha-700 dark:bg-matcha-900/30 dark:text-matcha-300">
              −{preis.buendel_rabatt.toFixed(2)} € Bündelrabatt
            </span>
          )}
        </div>
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>

      {open && (
        <div className="mt-3 space-y-2">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wide font-bold mb-2">
            Zusammensetzung
          </p>

          {/* Grundgebühr */}
          <div className="flex items-center justify-between py-1.5 border-b border-blue-200 dark:border-blue-800">
            <div className="flex items-center gap-2">
              <Package className="h-3.5 w-3.5 text-blue-400" />
              <span className="text-sm text-foreground">Grundgebühr</span>
            </div>
            <span className="text-sm font-bold text-foreground">{preis.grundgebuehr.toFixed(2)} €</span>
          </div>

          {/* Zonen-Zuschlag */}
          {preis.zonen_zuschlag > 0 && (
            <div className="flex items-center justify-between py-1.5 border-b border-blue-200 dark:border-blue-800">
              <div className="flex items-center gap-2">
                <span className={cn(
                  'flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-black border text-xs',
                  preis.zone === 'D' ? 'text-purple-600 border-purple-400 bg-purple-50' : 'text-amber-600 border-amber-400 bg-amber-50',
                )}>
                  {preis.zone}
                </span>
                <span className="text-sm text-foreground">
                  Zonen-Zuschlag {preis.zone === 'D' ? '(Außenbezirk)' : '(Fernzone)'}
                </span>
              </div>
              <span className="text-sm font-bold text-amber-600">+{preis.zonen_zuschlag.toFixed(2)} €</span>
            </div>
          )}

          {/* Bündel-Rabatt */}
          {preis.hat_buendel && preis.buendel_rabatt > 0 && (
            <div className="flex items-center justify-between py-1.5 border-b border-blue-200 dark:border-blue-800">
              <div className="flex items-center gap-2">
                <Zap className="h-3.5 w-3.5 text-matcha-500" />
                <span className="text-sm text-foreground">Bündelrabatt (mit anderen geteilt)</span>
              </div>
              <span className="text-sm font-bold text-matcha-600 dark:text-matcha-400">
                −{preis.buendel_rabatt.toFixed(2)} €
              </span>
            </div>
          )}

          {/* Gesamt */}
          <div className="flex items-center justify-between pt-1">
            <span className="text-sm font-bold text-foreground">Liefergebühr gesamt</span>
            <span className="text-base font-black text-foreground">{preis.gesamt.toFixed(2)} €</span>
          </div>

          {preis.hat_buendel && (
            <div className="rounded-lg border border-matcha-300 bg-matcha-50 dark:bg-matcha-900/20 px-3 py-2 text-[11px] text-matcha-700 dark:text-matcha-300">
              ♻️ Durch Bündelung mit anderen Bestellungen sparst du {preis.buendel_rabatt.toFixed(2)} € — gut für dich und die Umwelt.
            </div>
          )}

          {preis.zonen_zuschlag === 0 && !preis.hat_buendel && (
            <p className="text-[10px] text-muted-foreground">
              Du befindest dich in Zone {preis.zone ?? 'A/B'} — keine Zuschläge für deine Lieferzone.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
