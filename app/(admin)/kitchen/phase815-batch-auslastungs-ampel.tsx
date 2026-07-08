'use client';

import { useEffect, useState } from 'react';
import { Activity, Layers } from 'lucide-react';

interface BatchAuslastung {
  aktiveBatches: number;
  kapazitaet: number;
  auslastungPct: number;
  status: 'ok' | 'busy' | 'overloaded';
}

const MOCK: BatchAuslastung = {
  aktiveBatches: 4,
  kapazitaet: 8,
  auslastungPct: 50,
  status: 'ok',
};

const STATUS_COLOR = {
  ok: { bg: 'bg-emerald-50', border: 'border-emerald-200', bar: 'bg-emerald-500', text: 'text-emerald-700', label: 'Normal' },
  busy: { bg: 'bg-amber-50', border: 'border-amber-200', bar: 'bg-amber-400', text: 'text-amber-700', label: 'Ausgelastet' },
  overloaded: { bg: 'bg-red-50', border: 'border-red-200', bar: 'bg-red-500', text: 'text-red-700', label: 'Überlastet' },
};

interface Props {
  locationId: string | null;
}

export function KitchenPhase815BatchAuslastungsAmpel({ locationId }: Props) {
  const [data, setData] = useState<BatchAuslastung | null>(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    if (!locationId) { setData(MOCK); setLoading(false); return; }
    try {
      const res = await fetch(`/api/delivery/admin/zonen-auslastung-realtime?location_id=${locationId}`);
      if (!res.ok) throw new Error('fetch');
      const json = await res.json();
      // Ableiten: Batch-Auslastung aus Zonen-Daten
      const zones = json.zones ?? [];
      const aktiveBatches: number = zones.reduce((s: number, z: { assignedDrivers?: number }) => s + (z.assignedDrivers ?? 0), 0);
      const kapazitaet = Math.max(aktiveBatches + 2, 8);
      const auslastungPct = Math.round((aktiveBatches / kapazitaet) * 100);
      const status: BatchAuslastung['status'] =
        auslastungPct >= 90 ? 'overloaded' : auslastungPct >= 60 ? 'busy' : 'ok';
      setData({ aktiveBatches, kapazitaet, auslastungPct, status });
    } catch {
      setData(MOCK);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    const id = setInterval(load, 30_000);
    return () => clearInterval(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locationId]);

  if (loading) return null;
  if (!data) return null;

  const c = STATUS_COLOR[data.status];

  return (
    <div className={`rounded-xl border p-3 ${c.bg} ${c.border} mb-3`}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5">
          <Layers className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-xs font-semibold text-foreground">Batch-Auslastung</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Activity className={`h-3 w-3 ${c.text}`} />
          <span className={`text-[10px] font-bold uppercase tracking-wide ${c.text}`}>{c.label}</span>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div className="flex-1">
          <div className="h-2 w-full rounded-full bg-white/60 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${c.bar}`}
              style={{ width: `${Math.min(100, data.auslastungPct)}%` }}
            />
          </div>
        </div>
        <span className={`text-sm font-bold tabular-nums ${c.text}`}>
          {data.aktiveBatches}/{data.kapazitaet}
        </span>
        <span className={`text-xs font-bold tabular-nums ${c.text}`}>
          {data.auslastungPct}%
        </span>
      </div>
    </div>
  );
}
