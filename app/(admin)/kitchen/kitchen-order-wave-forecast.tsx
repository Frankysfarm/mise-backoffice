'use client';

import { useEffect, useState } from 'react';
import { Loader2, Waves } from 'lucide-react';
import { cn } from '@/lib/utils';

type WaveIntensity = 'low' | 'medium' | 'high' | 'peak';

interface WaveSlot {
  slotStart: string;
  slotEnd: string;
  hourLabel: string;
  expectedOrders: number;
  historicAvg: number;
  confidence: number;
  intensity: WaveIntensity;
}

interface WaveSummary {
  peakSlot: string | null;
  peakExpected: number;
  totalExpected4h: number;
  highSlots: number;
}

interface ApiResponse {
  ok: boolean;
  slots: WaveSlot[];
  summary: WaveSummary;
  generatedAt: string;
}

interface Props {
  locationId: string | null;
}

const intensityStyle: Record<WaveIntensity, { bar: string; badge: string; label: string; bg: string }> = {
  low:    { bar: 'bg-blue-300',   badge: 'bg-blue-100 text-blue-700',    label: 'Ruhig',   bg: 'bg-blue-50' },
  medium: { bar: 'bg-amber-400',  badge: 'bg-amber-100 text-amber-700',  label: 'Normal',  bg: 'bg-amber-50' },
  high:   { bar: 'bg-orange-500', badge: 'bg-orange-100 text-orange-700', label: 'Viel',   bg: 'bg-orange-50' },
  peak:   { bar: 'bg-red-500',    badge: 'bg-red-100 text-red-700',      label: 'Peak',    bg: 'bg-red-50' },
};

function BarChart({ slots }: { slots: WaveSlot[] }) {
  const maxOrders = Math.max(...slots.map((s) => s.expectedOrders), 1);
  return (
    <div className="flex items-end gap-1.5 h-20 px-5 pb-1">
      {slots.map((slot) => {
        const s = intensityStyle[slot.intensity];
        const heightPct = (slot.expectedOrders / maxOrders) * 100;
        return (
          <div key={slot.slotStart} className="flex-1 flex flex-col items-center gap-0.5">
            <span className="text-[9px] text-stone-500 font-mono tabular-nums">{slot.expectedOrders}</span>
            <div className="w-full relative flex items-end" style={{ height: '52px' }}>
              <div
                className={cn('w-full rounded-t transition-all duration-700', s.bar)}
                style={{ height: `${Math.max(4, heightPct)}%` }}
              />
            </div>
            <span className="text-[9px] text-stone-400 leading-none text-center" style={{ fontSize: '8px' }}>
              {slot.hourLabel.split('–')[0]}
            </span>
          </div>
        );
      })}
    </div>
  );
}

export function KitchenOrderWaveForecast({ locationId }: Props) {
  const [slots, setSlots] = useState<WaveSlot[]>([]);
  const [summary, setSummary] = useState<WaveSummary | null>(null);
  const [open, setOpen] = useState(true);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<string | null>(null);

  async function load() {
    if (!locationId) return;
    try {
      const res = await fetch(`/api/delivery/admin/order-wave-forecast?location_id=${locationId}`);
      if (!res.ok) return;
      const data: ApiResponse = await res.json();
      if (data.ok) {
        setSlots(data.slots);
        setSummary(data.summary);
        setLastUpdate(data.generatedAt);
      }
    } catch {
      // silent fail
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    const iv = setInterval(load, 120_000);
    return () => clearInterval(iv);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locationId]);

  if (!loading && slots.length === 0) return null;

  const hasPeak = (summary?.highSlots ?? 0) > 0;

  return (
    <div className="border border-stone-200 rounded-xl shadow-sm bg-white overflow-hidden">
      {/* Header */}
      <button
        className="w-full flex items-center gap-3 px-5 py-3 bg-stone-50 hover:bg-stone-100 transition-colors text-left"
        onClick={() => setOpen((v) => !v)}
      >
        <Waves className={cn('w-4 h-4 shrink-0', hasPeak ? 'text-orange-500' : 'text-teal-500')} />
        <span className="font-semibold text-stone-800 text-sm flex-1">Bestell-Wellen-Prognose (4h)</span>
        {loading && <Loader2 className="w-4 h-4 animate-spin text-stone-400" />}
        {!loading && summary && (
          <span className={cn(
            'text-xs font-bold px-2 py-0.5 rounded-full',
            hasPeak ? 'bg-orange-100 text-orange-700' : 'bg-teal-100 text-teal-700',
          )}>
            ~{summary.totalExpected4h} Bestellungen erwartet
          </span>
        )}
        <span className="text-stone-400 text-xs">{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div>
          {/* Summary KPIs */}
          {summary && (
            <div className="grid grid-cols-3 divide-x divide-stone-100 border-b border-stone-100">
              <div className="px-4 py-3 text-center">
                <div className="text-xl font-black tabular-nums text-stone-800">{summary.totalExpected4h}</div>
                <div className="text-[10px] text-stone-500 uppercase tracking-wide">Bestellungen (4h)</div>
              </div>
              <div className="px-4 py-3 text-center">
                <div className={cn('text-xl font-black tabular-nums', hasPeak ? 'text-orange-600' : 'text-teal-600')}>
                  {summary.peakExpected}
                </div>
                <div className="text-[10px] text-stone-500 uppercase tracking-wide">
                  Peak: {summary.peakSlot ?? '–'}
                </div>
              </div>
              <div className="px-4 py-3 text-center">
                <div className={cn('text-xl font-black tabular-nums', summary.highSlots > 0 ? 'text-orange-600' : 'text-stone-400')}>
                  {summary.highSlots}
                </div>
                <div className="text-[10px] text-stone-500 uppercase tracking-wide">Hoch-Slots</div>
              </div>
            </div>
          )}

          {/* Bar Chart */}
          {slots.length > 0 && <BarChart slots={slots} />}

          {/* Slot Table */}
          <div className="divide-y divide-stone-100 px-5">
            {slots.map((slot) => {
              const s = intensityStyle[slot.intensity];
              const conf = slot.confidence;
              return (
                <div key={slot.slotStart} className={cn('py-2.5 flex items-center gap-3', s.bg === 'bg-blue-50' ? '' : s.bg)}>
                  {/* Time */}
                  <div className="w-28 shrink-0 font-mono text-xs text-stone-600 font-medium">
                    {slot.hourLabel}
                  </div>

                  {/* Bar */}
                  <div className="flex-1 min-w-0">
                    <div className="h-2 bg-stone-100 rounded-full overflow-hidden">
                      <div
                        className={cn('h-full rounded-full transition-all duration-700', s.bar)}
                        style={{ width: `${Math.min(100, (slot.expectedOrders / Math.max(...slots.map((x) => x.expectedOrders), 1)) * 100)}%` }}
                      />
                    </div>
                  </div>

                  {/* Orders */}
                  <div className="w-8 text-right font-black text-sm tabular-nums text-stone-700">
                    {slot.expectedOrders}
                  </div>

                  {/* Badge */}
                  <div className={cn('text-[10px] font-bold rounded-full px-2 py-0.5 shrink-0', s.badge)}>
                    {s.label}
                  </div>

                  {/* Confidence */}
                  <div className="w-12 shrink-0 text-right text-[10px] text-stone-400">
                    {conf}% sicher
                  </div>
                </div>
              );
            })}
          </div>

          {lastUpdate && (
            <div className="px-5 py-2 text-[10px] text-stone-400 border-t border-stone-100 text-right">
              Aktualisiert: {new Date(lastUpdate).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })} · alle 2 Min
            </div>
          )}
        </div>
      )}
    </div>
  );
}
