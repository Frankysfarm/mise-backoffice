'use client';

import { useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { TrendingUp, ChevronDown, ChevronUp, Zap, Users, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';

interface HourSlot {
  hour: number;
  label: string;
  orders: number;
  isCurrent: boolean;
  isPeak: boolean;
  driversNeeded: number;
}

interface Props {
  locationId: string | null;
}

interface ApiSlot {
  hour: number;
  avg_bestellungen: number;
  peak_klasse: string;
}

function buildMockSlots(now: Date): HourSlot[] {
  const currentHour = now.getHours();
  const pattern: Record<number, number> = {
    10: 4, 11: 8, 12: 22, 13: 18, 14: 10, 15: 8,
    16: 12, 17: 20, 18: 32, 19: 28, 20: 16, 21: 8, 22: 4,
  };
  return Array.from({ length: 13 }, (_, i) => {
    const hour = 10 + i;
    const orders = pattern[hour] ?? 2;
    const driversNeeded = Math.max(1, Math.ceil(orders / 3));
    return {
      hour,
      label: `${String(hour).padStart(2, '0')}:00`,
      orders,
      isCurrent: hour === currentHour,
      isPeak: orders >= 20,
      driversNeeded,
    };
  });
}

export function SchichtSpitzenAnalyse({ locationId }: Props) {
  const [slots, setSlots] = useState<HourSlot[]>([]);
  const [collapsed, setCollapsed] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const now = new Date();

    if (!locationId) {
      setSlots(buildMockSlots(now));
      setLoading(false);
      return;
    }

    fetch(`/api/delivery/admin/tages-muster?location_id=${encodeURIComponent(locationId)}&wochentag=${now.getDay()}`)
      .then((r) => r.ok ? r.json() : null)
      .then((data: { slots?: ApiSlot[] } | null) => {
        if (data?.slots && Array.isArray(data.slots) && data.slots.length > 0) {
          const currentHour = now.getHours();
          const mapped: HourSlot[] = data.slots
            .filter((s: ApiSlot) => s.hour >= 10 && s.hour <= 22)
            .map((s: ApiSlot) => ({
              hour: s.hour,
              label: `${String(s.hour).padStart(2, '0')}:00`,
              orders: Math.round(s.avg_bestellungen),
              isCurrent: s.hour === currentHour,
              isPeak: s.peak_klasse === 'peak' || s.peak_klasse === 'high',
              driversNeeded: Math.max(1, Math.ceil(s.avg_bestellungen / 3)),
            }));
          setSlots(mapped);
        } else {
          setSlots(buildMockSlots(now));
        }
      })
      .catch(() => setSlots(buildMockSlots(now)))
      .finally(() => setLoading(false));
  }, [locationId]);

  useEffect(() => {
    if (!locationId) return;
    const iv = setInterval(() => {
      const now = new Date();
      setSlots((prev) =>
        prev.map((s) => ({ ...s, isCurrent: s.hour === now.getHours() })),
      );
    }, 60_000);
    return () => clearInterval(iv);
  }, [locationId]);

  if (loading) {
    return (
      <div className="rounded-2xl border border-stone-200 bg-white p-5">
        <div className="h-4 w-40 bg-stone-100 rounded animate-pulse mb-3" />
        <div className="h-20 bg-stone-100 rounded-xl animate-pulse" />
      </div>
    );
  }

  const currentSlot = slots.find((s) => s.isCurrent);
  const peakSlots = slots.filter((s) => s.isPeak);
  const maxOrders = Math.max(...slots.map((s) => s.orders), 1);
  const nextPeak = slots.find((s) => s.isPeak && !s.isCurrent && s.hour > (currentSlot?.hour ?? 0));

  return (
    <div className="rounded-2xl border border-stone-200 bg-white overflow-hidden">
      <button
        onClick={() => setCollapsed((c) => !c)}
        className="w-full flex items-center gap-3 px-5 py-4 border-b border-stone-100 hover:bg-stone-50 transition-colors text-left"
      >
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-violet-100 text-violet-700 shrink-0">
          <TrendingUp className="h-4 w-4" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-bold text-stone-800">Schicht-Spitzen-Analyse</div>
          <div className="text-xs text-stone-400">
            {peakSlots.length} Stoßzeit{peakSlots.length !== 1 ? 'en' : ''} heute
            {nextPeak ? ` · Nächste Peak: ${nextPeak.label}` : ''}
          </div>
        </div>
        {collapsed ? <ChevronDown className="h-4 w-4 text-stone-400" /> : <ChevronUp className="h-4 w-4 text-stone-400" />}
      </button>

      {!collapsed && (
        <div className="p-5 space-y-4">
          {/* KPI row */}
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-xl bg-violet-50 p-3">
              <div className="flex items-center gap-1.5 mb-1">
                <Zap className="w-3.5 h-3.5 text-violet-500" />
                <span className="text-[10px] font-semibold text-stone-500 uppercase tracking-wide">Stoßzeiten</span>
              </div>
              <div className="text-lg font-black text-violet-700">{peakSlots.length}</div>
            </div>
            <div className="rounded-xl bg-amber-50 p-3">
              <div className="flex items-center gap-1.5 mb-1">
                <Users className="w-3.5 h-3.5 text-amber-500" />
                <span className="text-[10px] font-semibold text-stone-500 uppercase tracking-wide">Max Fahrer</span>
              </div>
              <div className="text-lg font-black text-amber-700">
                {Math.max(...slots.map((s) => s.driversNeeded))}
              </div>
            </div>
            <div className="rounded-xl bg-matcha-50 p-3">
              <div className="flex items-center gap-1.5 mb-1">
                <Clock className="w-3.5 h-3.5 text-matcha-600" />
                <span className="text-[10px] font-semibold text-stone-500 uppercase tracking-wide">Jetzt</span>
              </div>
              <div className="text-lg font-black text-matcha-700">
                {currentSlot ? `${currentSlot.orders} B/h` : '–'}
              </div>
            </div>
          </div>

          {/* Bar chart */}
          <div className="h-28">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={slots} barSize={10} margin={{ top: 0, right: 0, left: -28, bottom: 0 }}>
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 8, fill: '#a8a29e' }}
                  tickLine={false}
                  axisLine={false}
                  interval={1}
                />
                <Tooltip
                  formatter={(value) => [`${Number(value ?? 0)} Best./h`, 'Erwartete Bestellungen']}
                  contentStyle={{ fontSize: 11, borderRadius: 8 }}
                />
                <Bar dataKey="orders" radius={[3, 3, 0, 0]}>
                  {slots.map((s) => (
                    <Cell
                      key={s.hour}
                      fill={s.isCurrent ? '#7c3aed' : s.isPeak ? '#f59e0b' : '#86efac'}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Legend */}
          <div className="flex items-center gap-4 text-[10px] text-stone-500">
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-sm bg-violet-500 inline-block" />
              Jetzt
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-sm bg-amber-400 inline-block" />
              Stoßzeit
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-sm bg-matcha-400 inline-block" />
              Normal
            </span>
          </div>

          {/* Peak recommendations */}
          {peakSlots.length > 0 && (
            <div className="rounded-xl bg-amber-50 border border-amber-200 p-3 space-y-1.5">
              <div className="text-[10px] font-black uppercase tracking-wider text-amber-600">
                Empfehlung Fahrer-Besetzung
              </div>
              {peakSlots.slice(0, 3).map((s) => (
                <div key={s.hour} className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-stone-700">{s.label}</span>
                  <span className={cn(
                    'font-black',
                    s.driversNeeded >= 6 ? 'text-red-600' : s.driversNeeded >= 4 ? 'text-amber-600' : 'text-matcha-600',
                  )}>
                    ≥ {s.driversNeeded} Fahrer
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
