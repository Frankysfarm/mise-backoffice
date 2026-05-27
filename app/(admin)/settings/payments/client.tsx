'use client';

import { useState, useTransition } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import {
  AlertCircle, Banknote, Check, CreditCard, FileText, Globe, Loader2, Truck, Store, UtensilsCrossed, Wallet,
} from 'lucide-react';

type Method = {
  id: string;
  tenant_id: string;
  method: string;
  label: string | null;
  icon: string | null;
  enabled_lieferung: boolean;
  enabled_abholung: boolean;
  enabled_vor_ort: boolean;
  sort_order: number;
};

const ICONS: Record<string, React.ElementType> = {
  'banknote': Banknote,
  'credit-card': CreditCard,
  'globe': Globe,
  'wallet': Wallet,
  'file-text': FileText,
};

const ORDER_TYPES = [
  { id: 'abholung',  label: 'Abholung',  icon: Store,           col: 'enabled_abholung' as const },
  { id: 'lieferung', label: 'Lieferung', icon: Truck,           col: 'enabled_lieferung' as const },
  { id: 'vor_ort',   label: 'Vor Ort',   icon: UtensilsCrossed, col: 'enabled_vor_ort' as const },
];

export function PaymentMatrix({ methods, tenantId, stripeReady }: { methods: Method[]; tenantId: string; stripeReady: boolean }) {
  const supabase = createClient();
  const [local, setLocal] = useState<Method[]>(methods);
  const [saving, startSaving] = useTransition();
  const [pulse, setPulse] = useState<string | null>(null);

  function toggle(m: Method, col: 'enabled_lieferung' | 'enabled_abholung' | 'enabled_vor_ort') {
    if (m.method === 'stripe' && !stripeReady && !m[col]) {
      alert('Stripe muss zuerst in den Restaurant-Einstellungen verbunden werden.');
      return;
    }
    const next = local.map((x) => x.id === m.id ? { ...x, [col]: !x[col] } : x);
    setLocal(next);

    const updated = next.find((x) => x.id === m.id)!;
    startSaving(async () => {
      const { error } = await supabase
        .from('tenant_payment_methods')
        .update({
          enabled_lieferung: updated.enabled_lieferung,
          enabled_abholung: updated.enabled_abholung,
          enabled_vor_ort: updated.enabled_vor_ort,
        })
        .eq('id', m.id);
      if (!error) {
        setPulse(m.id);
        setTimeout(() => setPulse(null), 800);
      }
    });
  }

  return (
    <div className="space-y-6">
      <Card className="p-6">
        <div className="mb-4 flex items-center justify-between gap-4 flex-wrap">
          <div>
            <div className="font-display font-bold">Matrix</div>
            <p className="text-sm text-muted-foreground">
              Welche Zahlungsarten sind bei welcher Bestellart erlaubt? Kunden sehen im Checkout nur aktivierte.
            </p>
          </div>
          {saving && (
            <div className="inline-flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 size={12} className="animate-spin" /> Speichere …
            </div>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b">
                <th className="text-left font-display text-xs uppercase tracking-wider text-muted-foreground py-3 pr-4">Methode</th>
                {ORDER_TYPES.map((t) => (
                  <th key={t.id} className="py-3 px-3 font-display text-xs uppercase tracking-wider text-muted-foreground">
                    <div className="flex flex-col items-center gap-1">
                      <t.icon size={14} />
                      {t.label}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {local.map((m) => {
                const Icon = ICONS[m.icon ?? ''] ?? CreditCard;
                const needsStripe = m.method === 'stripe';
                const blocked = needsStripe && !stripeReady;
                return (
                  <tr key={m.id} className={cn('border-b last:border-b-0 transition', pulse === m.id && 'bg-matcha-50')}>
                    <td className="py-4 pr-4">
                      <div className="flex items-center gap-3">
                        <div className={cn(
                          'h-10 w-10 rounded-xl flex items-center justify-center shrink-0',
                          blocked ? 'bg-muted text-muted-foreground' : 'bg-matcha-100 text-matcha-700',
                        )}>
                          <Icon size={18} />
                        </div>
                        <div>
                          <div className="font-semibold">{m.label ?? m.method}</div>
                          {needsStripe && (
                            <div className={cn('text-xs', blocked ? 'text-amber-700' : 'text-matcha-700')}>
                              {blocked ? (
                                <span className="inline-flex items-center gap-1">
                                  <AlertCircle size={10} /> Stripe zuerst verbinden
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1">
                                  <Check size={10} /> Stripe verbunden
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                    {ORDER_TYPES.map((t) => (
                      <td key={t.id} className="py-4 px-3 text-center">
                        <Toggle
                          checked={m[t.col]}
                          disabled={blocked}
                          onChange={() => toggle(m, t.col)}
                        />
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      <Card className="p-5 bg-matcha-50/50 border-matcha-200">
        <div className="flex items-start gap-3">
          <div className="h-8 w-8 rounded-full bg-matcha-700 text-white flex items-center justify-center shrink-0">
            💡
          </div>
          <div className="text-sm">
            <div className="font-bold text-matcha-900">Empfohlene Konfiguration</div>
            <ul className="mt-2 space-y-1 text-matcha-800">
              <li>• <strong>Bar</strong>: Abholung + Lieferung + Vor Ort</li>
              <li>• <strong>Karte vor Ort</strong>: Abholung + Lieferung (falls Fahrer Terminal hat) + Vor Ort</li>
              <li>• <strong>Online (Stripe)</strong>: Abholung + Lieferung — reduziert Bargeld-Handling</li>
              <li>• <strong>Rechnung</strong>: nur für Firmenkunden aktivieren</li>
            </ul>
          </div>
        </div>
      </Card>
    </div>
  );
}

function Toggle({ checked, disabled, onChange }: { checked: boolean; disabled?: boolean; onChange: () => void }) {
  return (
    <button
      type="button"
      onClick={onChange}
      disabled={disabled}
      role="switch"
      aria-checked={checked}
      className={cn(
        'inline-flex h-6 w-11 items-center rounded-full transition',
        checked ? 'bg-matcha-500' : 'bg-muted',
        disabled && 'opacity-40 cursor-not-allowed',
      )}
    >
      <span
        className={cn(
          'inline-block h-5 w-5 rounded-full bg-white shadow transition-transform',
          checked ? 'translate-x-[22px]' : 'translate-x-0.5',
        )}
      />
    </button>
  );
}
