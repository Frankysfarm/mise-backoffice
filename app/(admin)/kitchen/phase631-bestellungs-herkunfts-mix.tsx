'use client';

import { useEffect, useState } from 'react';
import { PieChart, Truck, ShoppingBag, UtensilsCrossed } from 'lucide-react';

interface Order {
  id: string;
  created_at: string;
  delivery_method?: string | null;
  order_type?: string | null;
}

type Typ = 'lieferung' | 'abholung' | 'vor_ort';

interface Mix {
  lieferung: number;
  abholung: number;
  vor_ort: number;
  gesamt: number;
}

function klassifiziere(order: Order): Typ {
  const method = (order.delivery_method ?? '').toLowerCase();
  const type = (order.order_type ?? '').toLowerCase();
  if (method === 'delivery' || type === 'delivery') return 'lieferung';
  if (method === 'pickup' || type === 'pickup' || method === 'takeaway' || type === 'takeaway') return 'abholung';
  return 'vor_ort';
}

function pct(val: number, total: number): number {
  return total > 0 ? Math.round((val / total) * 100) : 0;
}

const FARBEN: Record<Typ, string> = {
  lieferung: '#3b82f6',
  abholung: '#f59e0b',
  vor_ort: '#10b981',
};

const KONFIGURATION: Record<Typ, { label: string; icon: React.ReactNode; bg: string; text: string }> = {
  lieferung: {
    label: 'Lieferung',
    icon: <Truck className="h-3.5 w-3.5" />,
    bg: 'bg-blue-100 dark:bg-blue-900/40',
    text: 'text-blue-700 dark:text-blue-300',
  },
  abholung: {
    label: 'Abholung',
    icon: <ShoppingBag className="h-3.5 w-3.5" />,
    bg: 'bg-amber-100 dark:bg-amber-900/40',
    text: 'text-amber-700 dark:text-amber-300',
  },
  vor_ort: {
    label: 'Vor Ort',
    icon: <UtensilsCrossed className="h-3.5 w-3.5" />,
    bg: 'bg-emerald-100 dark:bg-emerald-900/40',
    text: 'text-emerald-700 dark:text-emerald-300',
  },
};

function DonutSegment({
  pctVal,
  offset,
  color,
}: {
  pctVal: number;
  offset: number;
  color: string;
}) {
  // SVG circle trick: circumference = 2π×r = 2π×15.9 ≈ 100
  const circumference = 100;
  const dashArray = `${pctVal} ${circumference - pctVal}`;
  return (
    <circle
      cx="21"
      cy="21"
      r="15.9"
      fill="none"
      stroke={color}
      strokeWidth="4"
      strokeDasharray={dashArray}
      strokeDashoffset={-offset}
      strokeLinecap="butt"
    />
  );
}

function DonutChart({ mix }: { mix: Mix }) {
  const pL = pct(mix.lieferung, mix.gesamt);
  const pA = pct(mix.abholung, mix.gesamt);
  const pV = 100 - pL - pA;

  const offL = 0;
  const offA = -pL;
  const offV = -(pL + pA);

  return (
    <div className="relative w-16 h-16 shrink-0">
      <svg viewBox="0 0 42 42" className="w-full h-full -rotate-90">
        {/* background */}
        <circle cx="21" cy="21" r="15.9" fill="none" stroke="currentColor" strokeWidth="4" className="text-gray-200 dark:text-gray-700" strokeDasharray="100 0" />
        <DonutSegment pctVal={pL} offset={offL} color={FARBEN.lieferung} />
        <DonutSegment pctVal={pA} offset={offA} color={FARBEN.abholung} />
        <DonutSegment pctVal={pV} offset={offV} color={FARBEN.vor_ort} />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-[10px] font-black text-gray-700 dark:text-gray-200 tabular-nums">
          {mix.gesamt}
        </span>
      </div>
    </div>
  );
}

export function KitchenPhase631BestellungsHerkunftsMix({ orders }: { orders: Order[] }) {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 15_000);
    return () => clearInterval(id);
  }, []);

  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);

  const heute = orders.filter((o) => new Date(o.created_at) >= todayStart);

  const mix: Mix = { lieferung: 0, abholung: 0, vor_ort: 0, gesamt: heute.length };
  for (const o of heute) {
    mix[klassifiziere(o)]++;
  }

  if (mix.gesamt === 0) return null;

  const typen: Typ[] = ['lieferung', 'abholung', 'vor_ort'];

  return (
    <div className="mb-4 rounded-xl border border-teal-200 dark:border-teal-800 bg-teal-50 dark:bg-teal-950/30 p-4 shadow-sm">
      <div className="mb-3 flex items-center gap-2">
        <PieChart className="h-4 w-4 text-teal-600 dark:text-teal-400" />
        <span className="text-sm font-bold text-teal-800 dark:text-teal-200 uppercase tracking-wide">
          Herkunfts-Mix Heute
        </span>
        <span className="ml-auto rounded-full bg-teal-100 dark:bg-teal-900/40 px-2 py-0.5 text-xs font-semibold text-teal-700 dark:text-teal-300">
          {mix.gesamt} Bestellungen
        </span>
      </div>

      <div className="flex items-center gap-4">
        <DonutChart mix={mix} />

        <div className="flex flex-col gap-1.5 flex-1">
          {typen.map((typ) => {
            const val = mix[typ];
            const p = pct(val, mix.gesamt);
            const cfg = KONFIGURATION[typ];
            return (
              <div key={typ} className="flex items-center gap-2">
                <span className={`flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${cfg.bg} ${cfg.text}`}>
                  {cfg.icon}
                  {cfg.label}
                </span>
                <div className="flex-1 h-1.5 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{ width: `${p}%`, backgroundColor: FARBEN[typ] }}
                  />
                </div>
                <span className="text-[11px] font-black tabular-nums text-gray-700 dark:text-gray-300 w-8 text-right">
                  {p}%
                </span>
                <span className="text-[10px] text-gray-500 dark:text-gray-400 w-4 text-right">
                  {val}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
