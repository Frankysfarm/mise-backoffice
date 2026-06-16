'use client';

import React, { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, Flame, ThumbsUp, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';

type DruckLevel = 'entspannt' | 'normal' | 'hoch' | 'kritis';

interface DruckData {
  activeOrders: number;
  inPrepOrders: number;
  waitingOrders: number;
  avgPrepMin: number | null;
  oldestInPrepMin: number | null;
  capacityOrders: number;
}

function calcLevel(data: DruckData): DruckLevel {
  const load = data.inPrepOrders / Math.max(data.capacityOrders, 1);
  if (load >= 0.9 || (data.oldestInPrepMin ?? 0) > 25) return 'kritis';
  if (load >= 0.7 || (data.oldestInPrepMin ?? 0) > 18) return 'hoch';
  if (load >= 0.4) return 'normal';
  return 'entspannt';
}

const LEVEL_CONFIG: Record<DruckLevel, {
  label: string;
  subtext: string;
  tip: string | null;
  bg: string;
  border: string;
  dot: string;
  Icon: React.ElementType;
  iconColor: string;
}> = {
  entspannt: {
    label: 'Entspannt',
    subtext: 'Küche läuft ruhig',
    tip: null,
    bg: 'bg-matcha-50',
    border: 'border-matcha-200',
    dot: 'bg-matcha-500',
    Icon: ThumbsUp,
    iconColor: 'text-matcha-600',
  },
  normal: {
    label: 'Normalbetrieb',
    subtext: 'Gut ausgelastet',
    tip: null,
    bg: 'bg-blue-50',
    border: 'border-blue-200',
    dot: 'bg-blue-500',
    Icon: CheckCircle2,
    iconColor: 'text-blue-600',
  },
  hoch: {
    label: 'Hohe Auslastung',
    subtext: 'Küche unter Druck',
    tip: 'Tipp: Parallele Zubereitung priorisieren',
    bg: 'bg-amber-50',
    border: 'border-amber-200',
    dot: 'bg-amber-500 animate-pulse',
    Icon: Flame,
    iconColor: 'text-amber-600',
  },
  kritis: {
    label: 'Kritisch',
    subtext: 'Überlastung droht',
    tip: 'Sofort: Fahrer informieren, ETA anpassen',
    bg: 'bg-red-50',
    border: 'border-red-200',
    dot: 'bg-red-500 animate-pulse',
    Icon: AlertTriangle,
    iconColor: 'text-red-600',
  },
};

export function KuechenDruckAmpel({ locationId }: { locationId: string | null }) {
  const [data, setData] = useState<DruckData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!locationId) { setLoading(false); return; }
    let mounted = true;

    const load = async () => {
      try {
        const params = new URLSearchParams({ action: 'queue' });
        if (locationId) params.set('location_id', locationId);
        const res = await fetch(`/api/delivery/kitchen/queue?${params}`);
        if (!res.ok) throw new Error('fetch failed');
        const json = await res.json();

        const orders: { status: string; geschaetzte_zubereitung_min: number | null; bestellt_am: string | null }[] =
          json.orders ?? [];

        const now = Date.now();
        const inPrep = orders.filter((o) => o.status === 'in_zubereitung');
        const waiting = orders.filter((o) => o.status === 'bestätigt' || o.status === 'neu');

        let oldestMin: number | null = null;
        for (const o of inPrep) {
          if (o.bestellt_am) {
            const age = (now - new Date(o.bestellt_am).getTime()) / 60_000;
            if (oldestMin === null || age > oldestMin) oldestMin = age;
          }
        }

        const prepTimes = inPrep
          .map((o) => o.geschaetzte_zubereitung_min)
          .filter((v): v is number => v !== null);
        const avgPrep = prepTimes.length > 0
          ? prepTimes.reduce((a, b) => a + b, 0) / prepTimes.length
          : null;

        if (mounted) {
          setData({
            activeOrders: orders.length,
            inPrepOrders: inPrep.length,
            waitingOrders: waiting.length,
            avgPrepMin: avgPrep,
            oldestInPrepMin: oldestMin !== null ? Math.round(oldestMin) : null,
            capacityOrders: 6,
          });
          setLoading(false);
        }
      } catch {
        if (mounted) setLoading(false);
      }
    };

    load();
    const iv = setInterval(load, 30_000);
    return () => { mounted = false; clearInterval(iv); };
  }, [locationId]);

  if (!locationId || loading || !data) return null;

  const level = calcLevel(data);
  const cfg = LEVEL_CONFIG[level];
  const loadPct = Math.min(100, Math.round((data.inPrepOrders / data.capacityOrders) * 100));

  return (
    <div className={cn('rounded-xl border px-4 py-3 flex items-start gap-3', cfg.bg, cfg.border)}>
      {/* Dot + Icon */}
      <div className="flex flex-col items-center gap-1.5 shrink-0 pt-0.5">
        <div className={cn('w-2.5 h-2.5 rounded-full', cfg.dot)} />
        <cfg.Icon className={cn('h-4 w-4', cfg.iconColor)} />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-bold">{cfg.label}</span>
          <span className="text-[10px] font-mono text-muted-foreground tabular-nums">
            {data.inPrepOrders}/{data.capacityOrders} aktiv
          </span>
        </div>

        <p className="text-[11px] text-muted-foreground mt-0.5">{cfg.subtext}</p>

        {/* Load bar */}
        <div className="mt-2 h-1.5 rounded-full bg-black/10 overflow-hidden">
          <div
            className={cn(
              'h-full rounded-full transition-all duration-700',
              level === 'kritis' ? 'bg-red-500' : level === 'hoch' ? 'bg-amber-500' : level === 'normal' ? 'bg-blue-500' : 'bg-matcha-500',
            )}
            style={{ width: `${loadPct}%` }}
          />
        </div>

        {/* Stats */}
        <div className="mt-1.5 flex gap-3 text-[10px] text-muted-foreground">
          {data.waitingOrders > 0 && (
            <span>{data.waitingOrders} wartend</span>
          )}
          {data.avgPrepMin !== null && (
            <span>Ø {data.avgPrepMin.toFixed(0)} Min Prep</span>
          )}
          {data.oldestInPrepMin !== null && (
            <span className={data.oldestInPrepMin > 20 ? 'text-red-600 font-bold' : ''}>
              Älteste: {data.oldestInPrepMin} Min
            </span>
          )}
        </div>

        {/* Tip */}
        {cfg.tip && (
          <div className="mt-2 flex items-start gap-1.5 text-[10px] font-semibold">
            <Zap className="h-3 w-3 shrink-0 mt-0.5 text-amber-500" />
            <span className="text-amber-700">{cfg.tip}</span>
          </div>
        )}
      </div>
    </div>
  );
}
