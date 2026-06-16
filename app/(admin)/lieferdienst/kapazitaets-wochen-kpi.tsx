'use client';

import { useEffect, useState } from 'react';
import { CalendarRange, CheckCircle, AlertTriangle } from 'lucide-react';
import type { CapacityDashboard } from '@/lib/delivery/capacity-planner';

interface Props {
  locationId: string;
}

interface ApiResponse extends CapacityDashboard {
  ok: boolean;
}

function formatDate(d: string) {
  return new Date(d + 'T12:00:00').toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit' });
}

export function KapazitaetsWochenKpi({ locationId }: Props) {
  const [data, setData] = useState<ApiResponse | null>(null);

  useEffect(() => {
    const load = async () => {
      const res = await fetch(`/api/delivery/admin/capacity-planner?location_id=${locationId}`);
      if (res.ok) setData(await res.json() as ApiResponse);
    };
    void load();
    const iv = setInterval(() => void load(), 10 * 60 * 1000);
    return () => clearInterval(iv);
  }, [locationId]);

  if (!data) return null;

  const { summary } = data;
  const hasGaps = summary.understaffedSlots > 0 || summary.uncoveredSlots > 0;

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4">
      <div className="flex items-center gap-2 mb-3">
        <CalendarRange className="h-4 w-4 text-indigo-500" />
        <h3 className="text-sm font-semibold text-gray-700">Kapazitäts-Planer (7 Tage)</h3>
        {hasGaps ? (
          <AlertTriangle className="h-3.5 w-3.5 text-amber-500 ml-auto" />
        ) : (
          <CheckCircle className="h-3.5 w-3.5 text-emerald-500 ml-auto" />
        )}
      </div>

      {/* Coverage bar */}
      <div className="mb-3">
        <div className="flex justify-between text-xs text-gray-500 mb-1">
          <span>Abdeckung</span>
          <span className="font-medium text-gray-700">{summary.coveragePct}%</span>
        </div>
        <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
          <div
            className={`h-2 rounded-full transition-all ${summary.coveragePct >= 80 ? 'bg-emerald-500' : summary.coveragePct >= 50 ? 'bg-amber-400' : 'bg-red-500'}`}
            style={{ width: `${summary.coveragePct}%` }}
          />
        </div>
      </div>

      {/* Mini stats */}
      <div className="grid grid-cols-3 gap-2 text-center text-xs">
        <div className="bg-gray-50 rounded-lg p-2">
          <p className="font-bold text-emerald-600">{summary.coveredSlots}</p>
          <p className="text-gray-400 mt-0.5">OK</p>
        </div>
        <div className="bg-gray-50 rounded-lg p-2">
          <p className={`font-bold ${summary.understaffedSlots > 0 ? 'text-amber-600' : 'text-gray-400'}`}>
            {summary.understaffedSlots}
          </p>
          <p className="text-gray-400 mt-0.5">Zu wenig</p>
        </div>
        <div className="bg-gray-50 rounded-lg p-2">
          <p className={`font-bold ${summary.uncoveredSlots > 0 ? 'text-red-600' : 'text-gray-400'}`}>
            {summary.uncoveredSlots}
          </p>
          <p className="text-gray-400 mt-0.5">Unbesetzt</p>
        </div>
      </div>

      {summary.worstDate && hasGaps && (
        <p className="text-[10px] text-gray-400 mt-2 text-center">
          Schlechtester Tag: {formatDate(summary.worstDate)} · Lücke: {summary.maxGap} Fahrer
        </p>
      )}

      <a
        href="/delivery/capacity-planner"
        className="block mt-3 text-center text-xs text-indigo-600 hover:underline"
      >
        Vollansicht →
      </a>
    </div>
  );
}
