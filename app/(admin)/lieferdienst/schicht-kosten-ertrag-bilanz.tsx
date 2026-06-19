'use client';

import { useEffect, useState, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { TrendingUp, TrendingDown, Euro, Bike, Minus } from 'lucide-react';

interface BilanzData {
  umsatz: number;
  kosten: number;
  marge: number;
  margePct: number;
  fahrerpauschale: number;
  lieferungenAnzahl: number;
}

function fetchBilanz(locationId: string | null): Promise<BilanzData | null> {
  const params = new URLSearchParams({ action: 'profitability_shift' });
  if (locationId) params.set('locationId', locationId);
  return fetch(`/api/delivery/admin/profitability?${params}`, { cache: 'no-store' })
    .then(r => r.ok ? r.json() : null)
    .catch(() => null);
}

function MargeArc({ pct, color }: { pct: number; color: string }) {
  const r = 28;
  const circ = Math.PI * r;
  const offset = circ * (1 - Math.min(1, Math.max(0, pct) / 100));
  return (
    <svg width="64" height="36" viewBox="0 0 64 36">
      <path d="M 4 34 A 28 28 0 0 1 60 34" fill="none" stroke="#e5e7eb" strokeWidth="6" strokeLinecap="round" />
      <path
        d="M 4 34 A 28 28 0 0 1 60 34"
        fill="none"
        stroke={color}
        strokeWidth="6"
        strokeLinecap="round"
        strokeDasharray={circ}
        strokeDashoffset={offset}
        style={{ transition: 'stroke-dashoffset 0.9s ease' }}
      />
    </svg>
  );
}

interface Props {
  locationId: string | null;
}

export function SchichtKostenErtragBilanz({ locationId }: Props) {
  const [data, setData] = useState<BilanzData | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const d = await fetchBilanz(locationId);
    if (d) setData(d);
    setLoading(false);
  }, [locationId]);

  useEffect(() => {
    load();
    const iv = setInterval(load, 120_000);
    return () => clearInterval(iv);
  }, [load]);

  // Skeleton
  if (loading) {
    return (
      <div className="rounded-xl border bg-white p-4 animate-pulse space-y-3">
        <div className="h-4 w-36 bg-gray-100 rounded" />
        <div className="grid grid-cols-3 gap-2">
          {[0, 1, 2].map(i => <div key={i} className="h-14 bg-gray-100 rounded-lg" />)}
        </div>
      </div>
    );
  }

  // No data: show placeholder
  if (!data) {
    const mock: BilanzData = {
      umsatz: 0, kosten: 0, marge: 0, margePct: 0,
      fahrerpauschale: 0, lieferungenAnzahl: 0,
    };
    return <BilanzCard data={mock} noData />;
  }

  return <BilanzCard data={data} />;
}

function BilanzCard({ data, noData }: { data: BilanzData; noData?: boolean }) {
  const { umsatz, kosten, marge, margePct, fahrerpauschale, lieferungenAnzahl } = data;

  const margeColor = margePct >= 30 ? '#10b981' : margePct >= 15 ? '#f59e0b' : '#ef4444';
  const TrendIcon = marge > 0 ? TrendingUp : marge < 0 ? TrendingDown : Minus;

  const fmtEur = (v: number) => `€${Math.abs(v).toFixed(0)}`;

  return (
    <div className="rounded-xl border bg-white shadow-sm overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 border-b bg-gray-50">
        <Euro size={14} className="text-gray-500" />
        <span className="text-xs font-semibold text-gray-700 flex-1">Schicht-Bilanz</span>
        <span className="text-[10px] text-gray-400">
          {lieferungenAnzahl} Lieferung{lieferungenAnzahl !== 1 ? 'en' : ''}
        </span>
      </div>

      <div className="p-4">
        {/* Gauge + label */}
        <div className="flex items-center gap-4">
          <div className="relative shrink-0">
            <MargeArc pct={margePct} color={noData ? '#e5e7eb' : margeColor} />
            <div className="absolute inset-0 flex items-end justify-center pb-0.5">
              <span className="text-[11px] font-black tabular-nums" style={{ color: noData ? '#9ca3af' : margeColor }}>
                {noData ? '–' : `${margePct.toFixed(0)}%`}
              </span>
            </div>
          </div>

          <div className="flex-1 space-y-2">
            {/* Umsatz */}
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-gray-500">Umsatz</span>
              <span className="text-[13px] font-black tabular-nums text-matcha-700">
                {noData ? '–' : fmtEur(umsatz)}
              </span>
            </div>
            {/* Kosten */}
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-gray-500 flex items-center gap-1">
                <Bike size={10} /> Fahrerkosten
              </span>
              <span className="text-[12px] font-bold tabular-nums text-red-500">
                {noData ? '–' : `−${fmtEur(fahrerpauschale || kosten)}`}
              </span>
            </div>
            {/* Divider */}
            <div className="h-px bg-gray-100" />
            {/* Marge */}
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-gray-700 flex items-center gap-1">
                <TrendIcon size={11} style={{ color: noData ? '#9ca3af' : margeColor }} />
                Deckungsbeitrag
              </span>
              <span
                className="text-[13px] font-black tabular-nums"
                style={{ color: noData ? '#9ca3af' : margeColor }}
              >
                {noData ? '–' : (marge >= 0 ? '+' : '−') + fmtEur(marge)}
              </span>
            </div>
          </div>
        </div>

        {/* Status Banner */}
        {!noData && (
          <div className={cn(
            'mt-3 rounded-lg px-3 py-2 text-[11px] font-semibold flex items-center gap-1.5',
            margePct >= 30 ? 'bg-emerald-50 text-emerald-800 border border-emerald-100'
              : margePct >= 15 ? 'bg-amber-50 text-amber-800 border border-amber-100'
              : 'bg-red-50 text-red-800 border border-red-100',
          )}>
            <TrendIcon size={12} style={{ color: margeColor, flexShrink: 0 }} />
            {margePct >= 30
              ? `Gute Marge — ${margePct.toFixed(0)}% Deckungsbeitrag`
              : margePct >= 15
              ? `Moderate Marge — Kosten im Blick behalten`
              : `Niedrige Marge — Kosten optimieren`}
          </div>
        )}

        {noData && (
          <div className="mt-3 rounded-lg px-3 py-2 text-[11px] text-gray-400 text-center border border-dashed">
            Noch keine Daten für diese Schicht
          </div>
        )}
      </div>
    </div>
  );
}
