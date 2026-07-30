'use client';

import { useEffect, useState } from 'react';
import { Clock, MapPin, CheckCircle2, Package, Bike, ChefHat, AlertTriangle, Zap, Navigation, Star } from 'lucide-react';

interface EtaData {
  status: 'bestellt' | 'bestaetigt' | 'in_zubereitung' | 'fertig' | 'unterwegs' | 'geliefert';
  eta_min: number | null;
  eta_min_low: number | null;
  eta_min_high: number | null;
  kueche_pct: number;
  fahrer_name: string | null;
  fahrer_eta_min: number | null;
  fahrer_distanz_km: number | null;
  bestellnummer: string;
  live_tracking: boolean;
  bewertung_offen: boolean;
  letzte_aktualisierung_sek: number;
  alert: string | null;
}

const STATUS_STEPS: { key: string; label: string; Icon: typeof Clock }[] = [
  { key: 'bestellt',        label: 'Bestellt',      Icon: Package },
  { key: 'in_zubereitung',  label: 'In Zubereitung', Icon: ChefHat },
  { key: 'fertig',          label: 'Fertig',         Icon: CheckCircle2 },
  { key: 'unterwegs',       label: 'Unterwegs',      Icon: Bike },
  { key: 'geliefert',       label: 'Geliefert',      Icon: MapPin },
];

const STATUS_ORDER = ['bestellt', 'bestaetigt', 'in_zubereitung', 'fertig', 'unterwegs', 'geliefert'];

const MOCK: EtaData = {
  status: 'unterwegs',
  eta_min: 8,
  eta_min_low: 6,
  eta_min_high: 11,
  kueche_pct: 100,
  fahrer_name: 'Jonas M.',
  fahrer_eta_min: 8,
  fahrer_distanz_km: 2.1,
  bestellnummer: '#1108',
  live_tracking: true,
  bewertung_offen: false,
  letzte_aktualisierung_sek: 12,
  alert: null,
};

function statusIndex(s: string) {
  const idx = STATUS_ORDER.indexOf(s);
  return idx === -1 ? 0 : idx;
}

export function Phase4485DynamischeEtaLiveTrackingV8({
  orderId,
  token,
}: {
  orderId?: string;
  token?: string;
}) {
  const [data, setData] = useState<EtaData>(MOCK);
  const [sek, setSek] = useState(0);
  const [bewertung, setBewertung] = useState<number | null>(null);

  useEffect(() => {
    const id = setInterval(() => setSek(s => s + 1), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (!orderId || !token) return;
    async function load() {
      try {
        const r = await fetch(`/api/delivery/tracking/${orderId}?token=${token}&v=8`, { cache: 'no-store' });
        if (r.ok) setData(await r.json());
      } catch {}
    }
    load();
    const id = setInterval(load, 15000);
    return () => clearInterval(id);
  }, [orderId, token]);

  const currentIdx = statusIndex(data.status);
  const isGeliefert = data.status === 'geliefert';

  return (
    <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-5 max-w-sm mx-auto space-y-4 font-sans">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm font-semibold text-gray-800">Bestellung {data.bestellnummer}</div>
          <div className="text-xs text-gray-500 mt-0.5">Live-Tracking</div>
        </div>
        {data.live_tracking && !isGeliefert && (
          <div className="flex items-center gap-1 bg-green-50 border border-green-200 rounded-full px-2 py-0.5">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
            <span className="text-xs text-green-700 font-medium">Live</span>
          </div>
        )}
      </div>

      {/* Alert */}
      {data.alert && (
        <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-xs text-amber-700">
          <AlertTriangle className="w-3 h-3 shrink-0" />
          {data.alert}
        </div>
      )}

      {/* ETA Banner */}
      {!isGeliefert && data.eta_min !== null && (
        <div className="bg-gradient-to-r from-orange-500 to-amber-500 rounded-xl px-4 py-3 text-white text-center">
          <div className="text-3xl font-bold tabular-nums">{data.eta_min} min</div>
          {data.eta_min_low !== null && data.eta_min_high !== null && (
            <div className="text-xs text-orange-100 mt-0.5">
              Geschätzt {data.eta_min_low}–{data.eta_min_high} min
            </div>
          )}
        </div>
      )}

      {/* Status Steps */}
      <div className="relative">
        <div className="absolute left-3 top-3 bottom-3 w-0.5 bg-gray-100" />
        <div className="space-y-3">
          {STATUS_STEPS.map((step, i) => {
            const stepIdx = statusIndex(step.key);
            const isDone = stepIdx < currentIdx;
            const isCurrent = stepIdx === currentIdx;
            return (
              <div key={step.key} className="flex items-center gap-3 relative">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 z-10 ${isDone ? 'bg-green-500' : isCurrent ? 'bg-orange-500 ring-2 ring-orange-200' : 'bg-gray-100'}`}>
                  {isDone
                    ? <CheckCircle2 className="w-3.5 h-3.5 text-white" />
                    : <step.Icon className={`w-3.5 h-3.5 ${isCurrent ? 'text-white' : 'text-gray-400'}`} />
                  }
                </div>
                <span className={`text-sm ${isDone ? 'text-gray-400 line-through' : isCurrent ? 'text-gray-900 font-semibold' : 'text-gray-400'}`}>
                  {step.label}
                </span>
                {isCurrent && data.kueche_pct > 0 && data.kueche_pct < 100 && step.key === 'in_zubereitung' && (
                  <span className="ml-auto text-xs font-medium text-orange-500">{data.kueche_pct}%</span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Küchen-Fortschritt */}
      {data.status === 'in_zubereitung' && (
        <div>
          <div className="flex justify-between text-xs text-gray-500 mb-1">
            <span>Küche</span>
            <span>{data.kueche_pct}%</span>
          </div>
          <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-orange-400 rounded-full transition-all"
              style={{ width: `${data.kueche_pct}%` }}
            />
          </div>
        </div>
      )}

      {/* Fahrer-Info */}
      {data.fahrer_name && data.status === 'unterwegs' && (
        <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-blue-200 flex items-center justify-center">
              <Bike className="w-4 h-4 text-blue-700" />
            </div>
            <div>
              <div className="text-sm font-semibold text-blue-900">{data.fahrer_name}</div>
              {data.fahrer_distanz_km !== null && (
                <div className="text-xs text-blue-500">{data.fahrer_distanz_km} km entfernt</div>
              )}
            </div>
          </div>
          <div className="text-right">
            <div className="text-xl font-bold text-blue-700 tabular-nums">{data.fahrer_eta_min} min</div>
            <div className="text-xs text-blue-400">Ankunft</div>
          </div>
        </div>
      )}

      {/* Geliefert-Zustand + Bewertung */}
      {isGeliefert && (
        <div className="text-center space-y-3 py-2">
          <div className="flex items-center justify-center gap-2">
            <CheckCircle2 className="w-8 h-8 text-green-500" />
            <div>
              <div className="text-base font-bold text-gray-800">Geliefert!</div>
              <div className="text-xs text-gray-500">Guten Appetit 🍽️</div>
            </div>
          </div>
          {data.bewertung_offen && !bewertung && (
            <div>
              <div className="text-xs text-gray-500 mb-2">Wie war Ihre Bestellung?</div>
              <div className="flex justify-center gap-2">
                {[1, 2, 3, 4, 5].map(s => (
                  <button
                    key={s}
                    onClick={() => setBewertung(s)}
                    className={`text-2xl transition-transform hover:scale-110 ${bewertung && bewertung >= s ? 'text-yellow-400' : 'text-gray-300'}`}
                  >
                    ★
                  </button>
                ))}
              </div>
            </div>
          )}
          {bewertung && (
            <div className="text-sm text-green-600 font-medium">Danke für Ihre Bewertung! ⭐{bewertung}</div>
          )}
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between text-xs text-gray-400">
        <div className="flex items-center gap-1">
          <Zap className="w-3 h-3" />
          <span>Aktualisiert vor {sek > data.letzte_aktualisierung_sek ? sek - data.letzte_aktualisierung_sek : data.letzte_aktualisierung_sek}s</span>
        </div>
        <span>15s Polling</span>
      </div>
    </div>
  );
}
