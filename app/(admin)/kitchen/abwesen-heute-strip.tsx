'use client';
/**
 * KitchenAbwesenHeuteStrip
 * Shows absent drivers today affecting kitchen throughput.
 * Polls /api/delivery/admin/driver-absences?action=today every 5min.
 */
import { useEffect, useState } from 'react';
import { CalendarOff, AlertTriangle } from 'lucide-react';

interface AbsentDriver {
  driver_id: string;
  driver_name: string | null;
  vehicle: string | null;
  absence_type: string;
}

export function KitchenAbwesenHeuteStrip() {
  const [absent, setAbsent] = useState<AbsentDriver[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    try {
      const res = await fetch('/api/delivery/admin/driver-absences?action=today');
      if (!res.ok) return;
      const json = await res.json() as { absences?: AbsentDriver[] };
      setAbsent(json.absences ?? []);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  };

  useEffect(() => {
    load();
    const t = setInterval(load, 5 * 60 * 1000);
    return () => clearInterval(t);
  }, []);

  if (loading || absent.length === 0) return null;

  const typeLabel: Record<string, string> = {
    sick_day: 'Krank',
    vacation: 'Urlaub',
    personal_day: 'Persönlich',
    training: 'Training',
    other: 'Sonstiges',
  };

  return (
    <div className="mx-4 mb-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 flex items-start gap-3">
      <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-xs font-bold text-amber-800 flex items-center gap-1.5">
          <CalendarOff className="h-3.5 w-3.5" />
          {absent.length} Fahrer heute abwesend — eingeschränkte Abholkapazität
        </p>
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {absent.map((a) => (
            <span
              key={a.driver_id}
              className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-700"
            >
              {a.driver_name ?? 'Fahrer'}
              <span className="text-amber-500">·</span>
              {typeLabel[a.absence_type] ?? a.absence_type}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
