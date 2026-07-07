'use client';

interface Order {
  id: string;
  status: string;
  created_at: string;
}

const TAGES_ZIEL = 80;

function calcProgress(orders: Order[]): number {
  const heuteStart = new Date();
  heuteStart.setHours(0, 0, 0, 0);
  return orders.filter(
    (o) =>
      ['fertig', 'geliefert', 'abgeholt', 'abgeschlossen'].includes(o.status) &&
      new Date(o.created_at) >= heuteStart,
  ).length;
}

export function KitchenPhase611TagesBestellzielRing({ orders }: { orders: Order[] }) {
  const abgeschlossen = calcProgress(orders);
  const pct = Math.min(100, Math.round((abgeschlossen / TAGES_ZIEL) * 100));

  const r = 36;
  const circ = 2 * Math.PI * r;
  const dash = (pct / 100) * circ;

  const farbe =
    pct >= 100
      ? { ring: '#7c3aed', text: 'text-violet-700 dark:text-violet-300', bg: 'bg-violet-50 dark:bg-violet-950/30 border-violet-200 dark:border-violet-800' }
      : pct >= 70
      ? { ring: '#f59e0b', text: 'text-amber-700 dark:text-amber-300', bg: 'bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800' }
      : { ring: '#16a34a', text: 'text-green-700 dark:text-green-300', bg: 'bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800' };

  return (
    <div className={`rounded-xl border ${farbe.bg} p-3 shadow-sm mb-4 flex items-center gap-4`}>
      <svg width={84} height={84} viewBox="0 0 84 84" className="shrink-0">
        <circle cx={42} cy={42} r={r} fill="none" stroke="currentColor" strokeWidth={6} className="text-gray-200 dark:text-gray-700" />
        <circle
          cx={42}
          cy={42}
          r={r}
          fill="none"
          stroke={farbe.ring}
          strokeWidth={6}
          strokeLinecap="round"
          strokeDasharray={`${dash} ${circ}`}
          transform="rotate(-90 42 42)"
        />
        <text x={42} y={46} textAnchor="middle" fontSize={13} fontWeight={700} fill={farbe.ring}>
          {pct}%
        </text>
      </svg>
      <div>
        <div className={`text-xs font-bold uppercase tracking-wide ${farbe.text}`}>
          Tages-Bestellziel
        </div>
        <div className="text-2xl font-black tabular-nums text-gray-900 dark:text-gray-100">
          {abgeschlossen}
          <span className="text-sm font-normal text-gray-500 dark:text-gray-400"> / {TAGES_ZIEL}</span>
        </div>
        <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
          {pct >= 100
            ? 'Tagesziel übertroffen!'
            : `Noch ${TAGES_ZIEL - abgeschlossen} Bestellungen bis Ziel`}
        </div>
      </div>
    </div>
  );
}
