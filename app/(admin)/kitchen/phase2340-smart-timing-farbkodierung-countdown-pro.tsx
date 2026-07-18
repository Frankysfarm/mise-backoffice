'use client';
import { useEffect, useState, useCallback } from 'react';
import { Clock, CheckCircle2, Flame, AlertTriangle, ChevronDown, ChevronUp, Timer } from 'lucide-react';

interface KochOrder {
  id: string;
  bestellnummer: string;
  status: string;
  prep_min: number | null;
  cook_start_at: string | null;
  ready_target: string | null;
  kunde_name: string;
  item_count: number;
}

interface TimingData {
  orders: KochOrder[];
  on_time_quote: number;
  avg_prep_min: number;
  overdue_count: number;
  generatedAt: string;
}

interface Props { locationId?: string | null; }

function calcSecondsLeft(readyTarget: string | null): number | null {
  if (!readyTarget) return null;
  return Math.floor((new Date(readyTarget).getTime() - Date.now()) / 1000);
}

function farbkodierung(secsLeft: number | null, status: string): { bg: string; text: string; border: string; label: string } {
  if (status === 'ready' || status === 'picked_up') return { bg: 'bg-green-50', text: 'text-green-700', border: 'border-green-200', label: 'Fertig' };
  if (secsLeft === null) return { bg: 'bg-gray-50', text: 'text-gray-500', border: 'border-gray-200', label: '—' };
  if (secsLeft > 120) return { bg: 'bg-green-50', text: 'text-green-700', border: 'border-green-200', label: 'Im Plan' };
  if (secsLeft > 0) return { bg: 'bg-yellow-50', text: 'text-yellow-700', border: 'border-yellow-200', label: 'Bald fällig' };
  return { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200', label: 'Überfällig' };
}

function CountdownDisplay({ secsLeft, status }: { secsLeft: number | null; status: string }) {
  if (status === 'ready' || status === 'picked_up') {
    return <CheckCircle2 className="w-5 h-5 text-green-500" />;
  }
  if (secsLeft === null) return <span className="font-mono text-sm text-gray-400">—</span>;
  const absS = Math.abs(secsLeft);
  const m = Math.floor(absS / 60);
  const s = absS % 60;
  const sign = secsLeft < 0 ? '-' : '';
  return (
    <span className={`font-mono text-sm font-bold tabular-nums ${secsLeft < 0 ? 'text-red-600' : secsLeft < 120 ? 'text-yellow-600' : 'text-green-700'}`}>
      {sign}{m}:{String(s).padStart(2, '0')}
    </span>
  );
}

export function KitchenPhase2340SmartTimingFarbkodierungCountdownPro({ locationId }: Props) {
  const [data, setData] = useState<TimingData | null>(null);
  const [ticks, setTicks] = useState(0);
  const [open, setOpen] = useState(true);

  const load = useCallback(() => {
    if (!locationId) return;
    fetch(`/api/delivery/admin/kitchen-timing-status?location_id=${locationId}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => d && setData(d))
      .catch(() => null);
  }, [locationId]);

  useEffect(() => { load(); const t = setInterval(load, 30_000); return () => clearInterval(t); }, [load]);
  useEffect(() => { const t = setInterval(() => setTicks(x => x + 1), 1000); return () => clearInterval(t); }, []);

  const orders = data?.orders ?? [];
  const cooking = orders.filter(o => o.status === 'cooking' || o.status === 'scheduled');
  const done = orders.filter(o => o.status === 'ready' || o.status === 'picked_up');
  const overdueCount = cooking.filter(o => (calcSecondsLeft(o.ready_target) ?? 1) <= 0).length;

  const hasAlert = overdueCount > 0;

  return (
    <div className={`rounded-xl border ${hasAlert ? 'border-red-200' : 'border-orange-200'} bg-white shadow-sm mb-4`}>
      <button
        onClick={() => setOpen(o => !o)}
        className={`w-full flex items-center justify-between px-4 py-3 ${hasAlert ? 'bg-red-50' : 'bg-orange-50'} rounded-t-xl`}
      >
        <div className="flex items-center gap-2">
          <Timer className={`w-4 h-4 ${hasAlert ? 'text-red-500' : 'text-orange-500'}`} />
          <span className={`font-semibold text-sm ${hasAlert ? 'text-red-800' : 'text-orange-800'}`}>
            Smart-Timing Countdown (Phase 2340)
          </span>
          {hasAlert && (
            <span className="ml-1 rounded-full bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5">
              {overdueCount} überfällig
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[11px] text-gray-500 hidden sm:inline">
            ✓ {data?.on_time_quote ?? 0}% pünktlich · Ø {data?.avg_prep_min ?? 0} min
          </span>
          {open ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
        </div>
      </button>

      {open && (
        <div className="p-4">
          {/* KPI Strip */}
          <div className="grid grid-cols-3 gap-2 mb-4">
            <div className="rounded-lg bg-green-50 p-3 text-center">
              <div className="text-xl font-black text-green-700 tabular-nums">{data?.on_time_quote ?? 0}%</div>
              <div className="text-[10px] text-green-600 font-semibold mt-0.5">On-Time-Quote</div>
            </div>
            <div className="rounded-lg bg-blue-50 p-3 text-center">
              <div className="text-xl font-black text-blue-700 tabular-nums">{data?.avg_prep_min ?? 0}'</div>
              <div className="text-[10px] text-blue-600 font-semibold mt-0.5">Ø Kochzeit</div>
            </div>
            <div className={`rounded-lg p-3 text-center ${overdueCount > 0 ? 'bg-red-50' : 'bg-gray-50'}`}>
              <div className={`text-xl font-black tabular-nums ${overdueCount > 0 ? 'text-red-700' : 'text-gray-500'}`}>{overdueCount}</div>
              <div className={`text-[10px] font-semibold mt-0.5 ${overdueCount > 0 ? 'text-red-600' : 'text-gray-400'}`}>Überfällig</div>
            </div>
          </div>

          {/* Active cooking orders */}
          {cooking.length === 0 ? (
            <div className="text-center py-6 text-sm text-gray-400">Keine aktiven Bestellungen</div>
          ) : (
            <div className="space-y-2">
              <div className="text-[11px] font-semibold text-gray-500 mb-1 flex items-center gap-1">
                <Flame className="w-3 h-3 text-orange-400" /> In Zubereitung
              </div>
              {cooking.map(o => {
                const secsLeft = calcSecondsLeft(o.ready_target);
                const farbe = farbkodierung(secsLeft, o.status);
                return (
                  <div key={o.id} className={`flex items-center gap-3 rounded-lg border ${farbe.border} ${farbe.bg} px-3 py-2`}>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className={`text-xs font-bold ${farbe.text}`}>#{o.bestellnummer}</span>
                        <span className="text-[10px] text-gray-500">{o.kunde_name}</span>
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${farbe.bg} ${farbe.text} border ${farbe.border}`}>
                          {farbe.label}
                        </span>
                        <span className="text-[10px] text-gray-400">{o.item_count} Artikel · {o.prep_min ?? '?'} min geplant</span>
                      </div>
                    </div>
                    <div className="shrink-0 text-right">
                      <CountdownDisplay secsLeft={secsLeft} status={o.status} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Done orders summary */}
          {done.length > 0 && (
            <div className="mt-3 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-green-500" />
              <span className="text-xs text-gray-500">{done.length} Bestellung{done.length !== 1 ? 'en' : ''} fertig / abgeholt</span>
            </div>
          )}

          {!locationId && (
            <div className="text-xs text-gray-400 text-center py-4">Bitte Filiale auswählen</div>
          )}
        </div>
      )}
    </div>
  );
}
