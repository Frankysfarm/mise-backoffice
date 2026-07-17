'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { Heart, ChevronDown, ChevronUp, Lightbulb } from 'lucide-react';

interface WiederkaufData {
  stammkunden_count: number;
  stammkunden_anteil: number;
  gesamt_kunden: number;
}

interface Props {
  driverId: string | null;
  locationId: string | null;
  isOnline: boolean;
}

const MOCK: WiederkaufData = {
  stammkunden_count: 12,
  stammkunden_anteil: 62,
  gesamt_kunden: 20,
};

const POLL_MS = 60 * 60 * 1000;

const TIPPS = [
  'Du kennst viele Kunden bereits — das macht dich zum besten Aushängeschild des Teams!',
  'Stammkunden schätzen vertraute Gesichter. Deine Zuverlässigkeit zahlt sich aus.',
  'Mehr Stammkunden bedeuten mehr Trinkgeld und bessere Bewertungen — gut gemacht!',
];

export function FahrerPhase2051MeineStammkundenTouren({ driverId, locationId, isOnline }: Props) {
  const [open, setOpen] = useState(true);
  const [data, setData] = useState<WiederkaufData | null>(null);

  useEffect(() => {
    if (!driverId || !locationId) return;
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch(`/api/delivery/admin/kunden-wiederkauf-rate?location_id=${locationId}`);
        if (!res.ok) throw new Error();
        const json: WiederkaufData = await res.json();
        if (!cancelled) setData(json);
      } catch {
        if (!cancelled) setData(MOCK);
      }
    };
    load();
    const iv = setInterval(load, POLL_MS);
    return () => { cancelled = true; clearInterval(iv); };
  }, [driverId, locationId]);

  if (!isOnline) return null;

  const d = data ?? MOCK;
  const tippIndex = d.stammkunden_count % TIPPS.length;

  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900 overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 text-sm font-semibold text-gray-100 hover:bg-gray-800 transition-colors"
      >
        <span className="flex items-center gap-2">
          <Heart className="w-4 h-4 text-pink-400" />
          Meine Stammkunden
        </span>
        {open ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-3">
          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-lg bg-gray-800 px-3 py-2 text-center">
              <div className="text-xl font-bold text-pink-300">{d.stammkunden_count}</div>
              <div className="text-[10px] text-gray-400 mt-0.5">Stammkunden</div>
            </div>
            <div className="rounded-lg bg-gray-800 px-3 py-2 text-center">
              <div className="text-xl font-bold text-gray-200">{d.gesamt_kunden}</div>
              <div className="text-[10px] text-gray-400 mt-0.5">Gesamt</div>
            </div>
            <div className="rounded-lg bg-gray-800 px-3 py-2 text-center">
              <div className={cn('text-xl font-bold', d.stammkunden_anteil >= 50 ? 'text-green-400' : 'text-amber-400')}>
                {d.stammkunden_anteil}%
              </div>
              <div className="text-[10px] text-gray-400 mt-0.5">Anteil</div>
            </div>
          </div>

          <div className="rounded-lg bg-pink-950 border border-pink-800 px-3 py-2 text-sm font-semibold text-pink-300 text-center">
            Du kennst {d.stammkunden_count} Kunden bereits!
          </div>

          <div className="h-2 rounded-full bg-gray-700 overflow-hidden">
            <div
              className="h-full rounded-full bg-pink-500 transition-all duration-700"
              style={{ width: `${d.stammkunden_anteil}%` }}
            />
          </div>

          <div className="flex gap-2 rounded-lg bg-blue-950 border border-blue-800 px-3 py-2 text-xs text-blue-300">
            <Lightbulb className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
            <span>{TIPPS[tippIndex]}</span>
          </div>
        </div>
      )}
    </div>
  );
}
