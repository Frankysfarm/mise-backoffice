'use client';
import { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, ChefHat, Clock, MapPin, Package, Truck, Zap } from 'lucide-react';

type Phase = 'bestaetigt' | 'in_zubereitung' | 'bereit' | 'unterwegs' | 'geliefert';

interface DriverPosition {
  distanz_km: number;
  eta_min: number;
  naehe: boolean;
}

interface ApiData {
  order_id: string;
  phase: Phase;
  eta_min: number;
  eta_min_latest: number;
  konfidenz_pct: number;
  verzoegerung: boolean;
  verzoegerung_grund: string | null;
  fahrer?: DriverPosition;
  prep_pct: number;
}

const MOCK: ApiData = {
  order_id: 'ord-888',
  phase: 'unterwegs',
  eta_min: 12,
  eta_min_latest: 17,
  konfidenz_pct: 84,
  verzoegerung: false,
  verzoegerung_grund: null,
  prep_pct: 100,
  fahrer: { distanz_km: 1.4, eta_min: 12, naehe: true },
};

const PHASES: { key: Phase; icon: React.ReactNode; label: string }[] = [
  { key: 'bestaetigt', icon: <CheckCircle2 className="h-3.5 w-3.5" />, label: 'Bestätigt' },
  { key: 'in_zubereitung', icon: <ChefHat className="h-3.5 w-3.5" />, label: 'Zubereitung' },
  { key: 'bereit', icon: <Package className="h-3.5 w-3.5" />, label: 'Bereit' },
  { key: 'unterwegs', icon: <Truck className="h-3.5 w-3.5" />, label: 'Unterwegs' },
  { key: 'geliefert', icon: <MapPin className="h-3.5 w-3.5" />, label: 'Geliefert' },
];

const PHASE_IDX: Record<Phase, number> = {
  bestaetigt: 0, in_zubereitung: 1, bereit: 2, unterwegs: 3, geliefert: 4,
};

function konfidenzLabel(pct: number): { text: string; color: string } {
  if (pct >= 85) return { text: 'Sehr genau', color: 'text-green-400' };
  if (pct >= 70) return { text: 'Gut', color: 'text-blue-400' };
  if (pct >= 55) return { text: 'Ungefähr', color: 'text-amber-400' };
  return { text: 'Schätzung', color: 'text-gray-500' };
}

export function StorefrontPhase2675DynamischeEtaLiveStatusBoard({
  orderId,
  locationSlug,
}: {
  orderId: string | null;
  locationSlug: string;
}) {
  const [data, setData] = useState<ApiData | null>(null);

  useEffect(() => {
    if (!orderId) { setData(MOCK); return; }
    const load = () =>
      fetch(`/api/delivery/order/eta?order_id=${orderId}&location=${locationSlug}`)
        .then(r => r.json())
        .then((d: ApiData) => setData(d))
        .catch(() => setData(MOCK));
    load();
    const p = setInterval(load, 20_000);
    return () => clearInterval(p);
  }, [orderId, locationSlug]);

  const d = data ?? MOCK;
  const phaseIdx = PHASE_IDX[d.phase];
  const konfidenz = konfidenzLabel(d.konfidenz_pct);

  return (
    <div className="rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm bg-white dark:bg-gray-900 overflow-hidden mb-4">
      {/* ETA-Header */}
      <div className={`px-4 py-4 ${d.verzoegerung ? 'bg-amber-50 dark:bg-amber-950/20' : 'bg-blue-50 dark:bg-blue-950/20'}`}>
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Clock className={`h-4 w-4 ${d.verzoegerung ? 'text-amber-500' : 'text-blue-500'}`} />
              <span className="text-sm font-bold text-gray-800 dark:text-white">
                {d.phase === 'geliefert' ? 'Geliefert!' : 'Ankunft in'}
              </span>
            </div>
            {d.phase !== 'geliefert' && (
              <div className="flex items-baseline gap-1">
                <span className={`text-4xl font-black tabular-nums ${d.verzoegerung ? 'text-amber-600 dark:text-amber-400' : 'text-blue-600 dark:text-blue-400'}`}>
                  {d.eta_min}–{d.eta_min_latest}
                </span>
                <span className="text-lg text-gray-500 dark:text-gray-400">Min</span>
              </div>
            )}
            <div className={`text-xs ${konfidenz.color} mt-0.5`}>{konfidenz.text} ({d.konfidenz_pct}%)</div>
          </div>

          {d.fahrer && (
            <div className="text-right">
              <div className={`flex items-center gap-1 ${d.fahrer.naehe ? 'text-green-600 dark:text-green-400' : 'text-blue-600 dark:text-blue-400'} text-sm font-bold`}>
                <Truck className="h-4 w-4" />
                {d.fahrer.distanz_km < 0.5 ? 'Fast da!' : `${d.fahrer.distanz_km} km`}
              </div>
              {d.fahrer.naehe && (
                <span className="text-[10px] bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded-full px-2 py-0.5 font-bold animate-pulse">
                  Fahrer nähert sich
                </span>
              )}
            </div>
          )}
        </div>

        {d.verzoegerung && d.verzoegerung_grund && (
          <div className="mt-2 flex items-start gap-2 bg-amber-100 dark:bg-amber-900/30 rounded-lg px-3 py-2">
            <AlertTriangle className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
            <span className="text-xs text-amber-700 dark:text-amber-300">{d.verzoegerung_grund}</span>
          </div>
        )}
      </div>

      {/* Phase-Timeline */}
      <div className="px-4 py-4">
        <div className="flex items-center gap-0">
          {PHASES.map((ph, i) => {
            const done = i < phaseIdx;
            const active = i === phaseIdx;
            const pending = i > phaseIdx;
            return (
              <div key={ph.key} className="flex items-center flex-1">
                <div className={`flex flex-col items-center gap-1 flex-shrink-0 ${active ? 'scale-110' : ''} transition-transform`}>
                  <div className={`h-8 w-8 rounded-full flex items-center justify-center border-2 transition-all ${
                    done ? 'bg-green-500 border-green-500 text-white' :
                    active ? 'bg-blue-500 border-blue-500 text-white shadow-lg shadow-blue-500/30 animate-pulse' :
                    'bg-gray-100 dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-400 dark:text-gray-600'
                  }`}>
                    {done ? <CheckCircle2 className="h-4 w-4" /> : ph.icon}
                  </div>
                  <span className={`text-[8px] font-medium text-center leading-tight max-w-[50px] ${
                    done ? 'text-green-600 dark:text-green-400' :
                    active ? 'text-blue-600 dark:text-blue-400 font-bold' :
                    'text-gray-400'
                  }`}>{ph.label}</span>
                </div>
                {i < PHASES.length - 1 && (
                  <div className={`flex-1 h-0.5 mb-4 mx-0.5 transition-all ${done ? 'bg-green-400' : active ? 'bg-gradient-to-r from-green-400 to-blue-400' : 'bg-gray-200 dark:bg-gray-700'}`} />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Prep Bar (if cooking) */}
      {(d.phase === 'in_zubereitung' || d.phase === 'bereit') && (
        <div className="border-t border-gray-100 dark:border-gray-800 px-4 py-3">
          <div className="flex items-center justify-between text-xs mb-1">
            <span className="text-gray-500 dark:text-gray-400 flex items-center gap-1">
              <ChefHat className="h-3 w-3" />Zubereitung
            </span>
            <span className="text-gray-700 dark:text-gray-300 font-bold tabular-nums">{d.prep_pct}%</span>
          </div>
          <div className="h-2 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-orange-400 to-orange-500 transition-all duration-1000"
              style={{ width: `${d.prep_pct}%` }}
            />
          </div>
        </div>
      )}

      <div className="flex items-center justify-between px-4 py-2 border-t border-gray-100 dark:border-gray-800">
        <span className="text-[9px] text-gray-400 flex items-center gap-1">
          <Zap className="h-2.5 w-2.5 text-blue-400" />Live-Updates alle 20 Sek
        </span>
        <span className="text-[9px] text-gray-400">#{orderId ?? d.order_id}</span>
      </div>
    </div>
  );
}
