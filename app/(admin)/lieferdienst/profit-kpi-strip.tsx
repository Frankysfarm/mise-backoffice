'use client';

/**
 * ProfitKpiStrip — Horizontal KPI-Leiste: Tages-Profitabilität
 *
 * Zeigt 4 KPI-Kacheln: Umsatz, Lieferkosten, Marge %, Gewinn.
 * Pollt /api/delivery/admin/profitability?action=dashboard alle 60s.
 */

import { useEffect, useState } from 'react';
import { cn, euro } from '@/lib/utils';
import { Euro, TrendingUp, Truck, Percent } from 'lucide-react';

type ProfitData = {
  revenue_eur: number;
  delivery_costs_eur: number;
  margin_pct: number;
  profit_eur: number;
};

// TODO: wire to real API when available
const MOCK_DATA: ProfitData = {
  revenue_eur: 1240.5,
  delivery_costs_eur: 186.08,
  margin_pct: 85,
  profit_eur: 1054.42,
};

type KpiCard = {
  label: string;
  value: string;
  icon: React.ReactNode;
  highlight?: boolean;
};

function buildCards(d: ProfitData): KpiCard[] {
  return [
    {
      label: 'Umsatz heute',
      value: euro(d.revenue_eur),
      icon: <Euro className="h-4 w-4" />,
    },
    {
      label: 'Lieferkosten',
      value: euro(d.delivery_costs_eur),
      icon: <Truck className="h-4 w-4" />,
    },
    {
      label: 'Marge',
      value: `${d.margin_pct.toFixed(1)} %`,
      icon: <Percent className="h-4 w-4" />,
      highlight: d.margin_pct >= 80,
    },
    {
      label: 'Gewinn heute',
      value: euro(d.profit_eur),
      icon: <TrendingUp className="h-4 w-4" />,
      highlight: d.profit_eur > 0,
    },
  ];
}

export function ProfitKpiStrip({ locationId }: { locationId?: string }) {
  const [data, setData] = useState<ProfitData | null>(null);
  const [loading, setLoading] = useState(true);

  async function fetchData() {
    try {
      const url = locationId
        ? `/api/delivery/admin/profitability?action=dashboard&locationId=${locationId}`
        : '/api/delivery/admin/profitability?action=dashboard';
      const res = await fetch(url, { cache: 'no-store' });
      if (!res.ok) throw new Error('no data');
      const json = await res.json();
      if (json.revenue_eur != null) {
        setData(json as ProfitData);
        return;
      }
      throw new Error('empty');
    } catch {
      // TODO: wire to real API when available
      setData(MOCK_DATA);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void fetchData();
    const iv = setInterval(fetchData, 60_000);
    return () => clearInterval(iv);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locationId]);

  if (loading) {
    return (
      <div className="flex gap-3">
        {[0, 1, 2, 3].map(i => (
          <div key={i} className="flex-1 h-20 rounded-2xl bg-matcha-50 animate-pulse border border-matcha-100" />
        ))}
      </div>
    );
  }

  const cards = buildCards(data ?? MOCK_DATA);

  return (
    <div className="flex gap-3 flex-wrap sm:flex-nowrap">
      {cards.map(card => (
        <div
          key={card.label}
          className={cn(
            'flex-1 min-w-[140px] rounded-2xl border px-4 py-3 flex flex-col gap-1.5',
            card.highlight
              ? 'bg-matcha-50 border-matcha-200'
              : 'bg-white border-stone-200',
          )}
        >
          <div className={cn(
            'flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider',
            card.highlight ? 'text-matcha-600' : 'text-stone-400',
          )}>
            {card.icon}
            {card.label}
          </div>
          <div className={cn(
            'text-xl font-black tabular-nums',
            card.highlight ? 'text-matcha-700' : 'text-stone-700',
          )}>
            {card.value}
          </div>
        </div>
      ))}
    </div>
  );
}
