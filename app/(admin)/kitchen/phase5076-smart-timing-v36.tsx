'use client';

import React, { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { ChefHat, Clock, Flame, CheckCircle2, AlertCircle, Zap, Users } from 'lucide-react';

interface BatchGroup {
  batch_id: string;
  orders: Array<{
    id: string;
    bestellnummer?: string | null;
    items_count: number;
    rest_min: number;
    fahrer_eta_min?: number | null;
    status: 'cooking' | 'ready' | 'waiting';
  }>;
  cook_start?: string | null;
  estimated_ready_min: number;
  fahrer_eta_min?: number | null;
  synced: boolean;
}

interface Props {
  locationId: string | null;
}

type Ampel = 'gruen' | 'gelb' | 'rot' | 'fertig';

function getAmpel(restMin: number, fahrerEta: number | null): Ampel {
  if (restMin <= 0) return 'fertig';
  if (fahrerEta !== null && restMin <= fahrerEta - 1) return 'gruen';
  if (fahrerEta !== null && restMin >= fahrerEta + 3) return 'gelb';
  if (restMin <= 2) return 'rot';
  return 'gelb';
}

const AMPEL_STYLES: Record<Ampel, { dot: string; bg: string; text: string; label: string }> = {
  gruen: { dot: 'bg-emerald-400', bg: 'bg-emerald-500/10', text: 'text-emerald-400', label: 'Sync OK' },
  gelb: { dot: 'bg-amber-400', bg: 'bg-amber-500/10', text: 'text-amber-400', label: 'Bald fertig' },
  rot: { dot: 'bg-red-400 animate-pulse', bg: 'bg-red-500/10', text: 'text-red-400', label: 'Kritisch' },
  fertig: { dot: 'bg-slate-500', bg: 'bg-slate-700/30', text: 'text-slate-400', label: 'Fertig' },
};

const MOCK_BATCHES: BatchGroup[] = [
  {
    batch_id: 'B-001',
    orders: [
      { id: 'o1', bestellnummer: '#4201', items_count: 3, rest_min: 4, fahrer_eta_min: 6, status: 'cooking' },
      { id: 'o2', bestellnummer: '#4202', items_count: 2, rest_min: 4, fahrer_eta_min: 6, status: 'cooking' },
    ],
    estimated_ready_min: 4,
    fahrer_eta_min: 6,
    synced: true,
  },
  {
    batch_id: 'B-002',
    orders: [
      { id: 'o3', bestellnummer: '#4203', items_count: 4, rest_min: 1, fahrer_eta_min: 3, status: 'cooking' },
    ],
    estimated_ready_min: 1,
    fahrer_eta_min: 3,
    synced: false,
  },
  {
    batch_id: 'B-003',
    orders: [
      { id: 'o4', bestellnummer: '#4204', items_count: 2, rest_min: 0, fahrer_eta_min: null, status: 'ready' },
      { id: 'o5', bestellnummer: '#4205', items_count: 1, rest_min: 0, fahrer_eta_min: null, status: 'waiting' },
    ],
    estimated_ready_min: 0,
    fahrer_eta_min: null,
    synced: false,
  },
];

function MinuteCountdown({ minutes }: { minutes: number }) {
  const [ticks, setTicks] = useState(0);
  useEffect(() => {
    const iv = setInterval(() => setTicks(t => t + 1), 1000);
    return () => clearInterval(iv);
  }, []);
  const display = Math.max(0, minutes);
  return <span>{display}<span className="text-xs opacity-60 ml-0.5">min</span></span>;
}

export function KitchenPhase5076SmartTimingV36({ locationId }: Props) {
  const [batches, setBatches] = useState<BatchGroup[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!locationId) { setLoading(false); return; }

    async function load() {
      try {
        const res = await fetch(`/api/delivery/kitchen/queue?location_id=${locationId}&batches=true`);
        if (res.ok) {
          const data = await res.json();
          setBatches(data.batches ?? MOCK_BATCHES);
        } else {
          setBatches(MOCK_BATCHES);
        }
      } catch {
        setBatches(MOCK_BATCHES);
      } finally {
        setLoading(false);
      }
    }

    load();
    const iv = setInterval(load, 15_000);
    return () => clearInterval(iv);
  }, [locationId]);

  const kritisch = batches.filter(b => getAmpel(b.estimated_ready_min, b.fahrer_eta_min ?? null) === 'rot').length;
  const fertig = batches.filter(b => b.estimated_ready_min <= 0).length;
  const aktiv = batches.length - fertig;

  return (
    <div className="rounded-xl border border-white/10 bg-slate-900/60 p-3 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-orange-500/20">
            <Flame className="h-4 w-4 text-orange-400" />
          </div>
          <div>
            <p className="text-sm font-semibold text-white">Batch-Timing V36</p>
            <p className="text-xs text-slate-400">Kochstart · Fahrer-Sync</p>
          </div>
        </div>
        <div className="flex gap-2 text-xs">
          <span className="px-2 py-0.5 rounded-full bg-slate-700/50 text-slate-300">{aktiv} aktiv</span>
          {kritisch > 0 && (
            <span className="px-2 py-0.5 rounded-full bg-red-500/20 text-red-400 animate-pulse">{kritisch} kritisch</span>
          )}
        </div>
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-3 gap-2">
        {[
          { label: 'Aktiv', val: aktiv, icon: ChefHat, color: 'text-blue-400' },
          { label: 'Kritisch', val: kritisch, icon: AlertCircle, color: 'text-red-400' },
          { label: 'Fertig', val: fertig, icon: CheckCircle2, color: 'text-emerald-400' },
        ].map(({ label, val, icon: Icon, color }) => (
          <div key={label} className="rounded-lg bg-slate-800/50 p-2 text-center">
            <Icon className={cn('h-3.5 w-3.5 mx-auto mb-0.5', color)} />
            <p className={cn('text-lg font-bold', color)}>{val}</p>
            <p className="text-xs text-slate-500">{label}</p>
          </div>
        ))}
      </div>

      {/* Batch List */}
      <div className="space-y-2">
        {loading ? (
          <div className="text-center py-4 text-slate-500 text-sm">Lade Batches…</div>
        ) : batches.length === 0 ? (
          <div className="text-center py-4 text-slate-500 text-sm">Keine aktiven Batches</div>
        ) : (
          batches.map(batch => {
            const ampel = getAmpel(batch.estimated_ready_min, batch.fahrer_eta_min ?? null);
            const styles = AMPEL_STYLES[ampel];
            return (
              <div key={batch.batch_id} className={cn('rounded-lg border p-2.5 space-y-1.5', styles.bg, 'border-white/5')}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className={cn('w-2 h-2 rounded-full flex-shrink-0', styles.dot)} />
                    <span className="text-xs font-semibold text-white">{batch.batch_id}</span>
                    <div className="flex items-center gap-1">
                      <Users className="h-3 w-3 text-slate-500" />
                      <span className="text-xs text-slate-400">{batch.orders.length} Bestellungen</span>
                    </div>
                  </div>
                  <div className={cn('flex items-center gap-1.5', styles.text)}>
                    <Clock className="h-3.5 w-3.5" />
                    <span className="text-sm font-bold tabular-nums">
                      <MinuteCountdown minutes={batch.estimated_ready_min} />
                    </span>
                  </div>
                </div>

                {/* Bestellungen */}
                <div className="flex flex-wrap gap-1.5">
                  {batch.orders.map(o => (
                    <span key={o.id} className="text-xs bg-slate-800/60 text-slate-300 px-1.5 py-0.5 rounded">
                      {o.bestellnummer ?? o.id} · {o.items_count} Items
                    </span>
                  ))}
                </div>

                {/* Fahrer-Sync */}
                <div className="flex items-center justify-between text-xs">
                  <span className={cn('font-medium', styles.text)}>{styles.label}</span>
                  {batch.fahrer_eta_min != null ? (
                    <span className="text-slate-400">
                      Fahrer in <span className="font-semibold text-white">{batch.fahrer_eta_min}min</span>
                      {batch.synced && <span className="ml-1 text-emerald-400">✓ Sync</span>}
                    </span>
                  ) : (
                    <span className="text-slate-500 flex items-center gap-1">
                      <Zap className="h-3 w-3" />Kein Fahrer
                    </span>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
