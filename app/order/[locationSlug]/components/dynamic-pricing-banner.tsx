'use client';

import { useEffect, useState } from 'react';
import { Info, TrendingDown } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  locationId: string;
  orderType:  string;
}

interface FeeQuote {
  surge_multiplier: number;
  surge_surcharge_eur: number;
  is_free_delivery: boolean;
}

export function DynamicPricingBanner({ locationId, orderType }: Props) {
  const [info, setInfo] = useState<{ text: string; type: 'surge' | 'discount' } | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (orderType !== 'lieferung') {
      setVisible(false);
      return;
    }

    let mounted = true;

    async function load() {
      try {
        const [pricingRes, surgeRes] = await Promise.all([
          fetch('/api/delivery/admin/dynamic-pricing?action=config'),
          fetch(`/api/delivery/surge?location_id=${locationId}`),
        ]);
        if (!pricingRes.ok || !mounted) return;

        const pData = await pricingRes.json() as {
          config: {
            isEnabled: boolean;
            customerBannerEnabled: boolean;
            offPeakEnabled: boolean;
            offPeakDiscountPct: number;
          };
        };

        if (!pData.config.isEnabled || !pData.config.customerBannerEnabled) {
          setVisible(false);
          return;
        }

        if (surgeRes.ok) {
          const sData = await surgeRes.json() as {
            level?: string;
            surge_level?: string;
          };
          const level = sData.level ?? sData.surge_level ?? 'none';

          if (level === 'extreme') {
            setInfo({ text: 'Sehr hohe Nachfrage — Liefergebühr vorübergehend erhöht', type: 'surge' });
            setVisible(true);
            return;
          }
          if (level === 'high') {
            setInfo({ text: 'Hohe Nachfrage — Liefergebühr leicht erhöht', type: 'surge' });
            setVisible(true);
            return;
          }
          if (level === 'elevated') {
            setInfo({ text: 'Erhöhte Nachfrage — dynamische Liefergebühr aktiv', type: 'surge' });
            setVisible(true);
            return;
          }
        }

        // Off-Peak
        if (pData.config.offPeakEnabled) {
          const h = new Date().getUTCHours();
          setInfo({
            text: `Off-Peak-Rabatt: ${pData.config.offPeakDiscountPct.toFixed(0)}% auf die Liefergebühr`,
            type: 'discount',
          });
          setVisible(true);
          return;
        }

        setVisible(false);
      } catch { /* ignore */ }
    }

    void load();
    const iv = setInterval(() => void load(), 90_000);
    return () => {
      mounted = false;
      clearInterval(iv);
    };
  }, [locationId, orderType]);

  if (!visible || !info) return null;

  return (
    <div className={cn(
      'flex items-start gap-2.5 px-4 py-3 rounded-xl border text-sm',
      info.type === 'surge'
        ? 'bg-amber-50 border-amber-200 text-amber-800'
        : 'bg-violet-50 border-violet-200 text-violet-800',
    )}>
      {info.type === 'discount'
        ? <TrendingDown className="h-4 w-4 shrink-0 mt-0.5" />
        : <Info className="h-4 w-4 shrink-0 mt-0.5" />}
      <span>{info.text}</span>
    </div>
  );
}
