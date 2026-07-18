'use client';
import { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, TrendingUp, TrendingDown, Minus, Zap } from 'lucide-react';

interface FahrerReaktionszeit {
  id: string;
  name: string;
  avg_sek: number;
  avg_sek_vw: number;
  min_sek: number;
  touren: number;
  trend: 'up' | 'down' | 'neutral';
  ampel: 'gruen' | 'gelb' | 'rot';
  alert: boolean;
}

interface ApiData {
  fahrer_single: FahrerReaktionszeit;
  team_avg_sek: number;
}

function ampelBg(a: string) {
  if (a === 'gruen') return 'bg-green-50 border-green-200 text-green-800';
  if (a === 'gelb') return 'bg-yellow-50 border-yellow-200 text-yellow-800';
  return 'bg-red-50 border-red-200 text-red-700';
}

function ampelRing(a: string) {
  if (a === 'gruen') return 'text-green-600';
  if (a === 'gelb') return 'text-yellow-600';
  return 'text-red-600';
}

function ampelBar(a: string) {
  if (a === 'gruen') return 'bg-green-500';
  if (a === 'gelb') return 'bg-yellow-500';
  return 'bg-red-500';
}

function coachingTipp(f: FahrerReaktionszeit): string {
  if (f.alert) return 'Reaktionszeit >120s — Tour-Benachrichtigungen sofort annehmen, Handy nicht stumm schalten!';
  if (f.ampel === 'gruen' && f.trend === 'up') return 'Ausgezeichnet! Schnelle Reaktion hilft der Küche und dem Kunden.';
  if (f.ampel === 'gruen') return 'Super Reaktionszeit! Weiter so — du bist einer der Schnellsten im Team.';
  if (f.ampel === 'gelb') return 'Reaktionszeit im mittleren Bereich — versuche unter 60s zu kommen.';
  return 'Reaktionszeit über dem Ziel — neue Tour-Benachrichtigungen sofort annehmen.';
}

function fmtSek(sek: number) {
  if (sek === 0) return '—';
  if (sek >= 60) return `${Math.floor(sek / 60)}m ${sek % 60}s`;
  return `${sek}s`;
}

function TrendIcon({ trend }: { trend: string }) {
  if (trend === 'up') return <TrendingUp size={14} className="text-green-600" />;
  if (trend === 'down') return <TrendingDown size={14} className="text-red-500" />;
  return <Minus size={14} className="text-gray-400" />;
}

interface Props {
  driverId: string | null;
  locationId: string | null;
  isOnline: boolean;
}

export function FahrerPhase2380MeineReaktionszeit({ driverId, locationId, isOnline }: Props) {
  const [data, setData] = useState<ApiData | null>(null);
  const [open, setOpen] = useState(true);

  async function load() {
    if (!driverId || !locationId || !isOnline) return;
    try {
      const r = await fetch(
        `/api/delivery/admin/fahrer-reaktionszeit-analyse?location_id=${locationId}&driver_id=${driverId}`
      );
      if (r.ok) setData(await r.json());
    } catch {}
  }

  useEffect(() => {
    load();
    const t = setInterval(load, 30 * 60 * 1000);
    return () => clearInterval(t);
  }, [driverId, locationId, isOnline]);

  if (!isOnline) return null;

  const f = data?.fahrer_single;
  const barPct = f ? Math.min(Math.round((f.avg_sek / 180) * 100), 100) : 0;

  return (
    <div className={`rounded-xl border mb-3 ${f ? ampelBg(f.ampel) : 'border-indigo-200 bg-indigo-50'}`}>
      <button
        className="w-full flex items-center justify-between px-4 py-3 text-left"
        onClick={() => setOpen(o => !o)}
      >
        <div className="flex items-center gap-2">
          <Zap size={16} className={f ? ampelRing(f.ampel) : 'text-indigo-600'} />
          <span className="font-semibold text-sm">
            Meine Reaktionszeit {f ? `— ${fmtSek(f.avg_sek)}` : ''}
          </span>
        </div>
        {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-3">
          {!f ? (
            <p className="text-xs text-gray-500">Lade…</p>
          ) : (
            <>
              {/* Main value */}
              <div className="text-center py-2">
                <div className={`text-4xl font-bold ${ampelRing(f.ampel)}`}>{fmtSek(f.avg_sek)}</div>
                <div className="text-xs text-gray-500 mt-1">Ø Reaktionszeit heute</div>
              </div>

              {/* Progress bar 0–180s with goal at 60s */}
              <div className="space-y-1">
                <div className="relative h-4 rounded-full bg-gray-200 overflow-hidden">
                  <div
                    className={`absolute left-0 top-0 h-full rounded-full transition-all ${ampelBar(f.ampel)}`}
                    style={{ width: `${barPct}%` }}
                  />
                  <div className="absolute top-0 h-full border-l-2 border-green-700 border-dashed opacity-70" style={{ left: '33.3%' }} />
                  <div className="absolute top-0 h-full border-l-2 border-yellow-600 border-dashed opacity-70" style={{ left: '66.6%' }} />
                </div>
                <div className="flex justify-between text-xs text-gray-400">
                  <span>0s</span>
                  <span className="text-green-600">60s Ziel</span>
                  <span className="text-yellow-600">120s</span>
                  <span>180s+</span>
                </div>
              </div>

              {/* KPI Grid */}
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-lg bg-white bg-opacity-60 p-2 text-center">
                  <div className="text-sm font-bold">{f.touren}</div>
                  <div className="text-xs text-gray-500">Touren</div>
                </div>
                <div className="rounded-lg bg-white bg-opacity-60 p-2 text-center">
                  <div className="text-sm font-bold">{fmtSek(f.min_sek)}</div>
                  <div className="text-xs text-gray-500">Schnellste</div>
                </div>
                <div className="rounded-lg bg-white bg-opacity-60 p-2 text-center">
                  <div className="flex items-center justify-center gap-1">
                    <TrendIcon trend={f.trend} />
                    <span className="text-sm font-bold">{fmtSek(f.avg_sek_vw)}</span>
                  </div>
                  <div className="text-xs text-gray-500">Vorwoche</div>
                </div>
                <div className="rounded-lg bg-white bg-opacity-60 p-2 text-center">
                  <div className="text-sm font-bold">{fmtSek(data?.team_avg_sek ?? 0)}</div>
                  <div className="text-xs text-gray-500">Team-Ø</div>
                </div>
              </div>

              {/* Coaching tip */}
              <div className="rounded-lg bg-white bg-opacity-70 border px-3 py-2">
                <p className="text-xs text-gray-700">{coachingTipp(f)}</p>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
