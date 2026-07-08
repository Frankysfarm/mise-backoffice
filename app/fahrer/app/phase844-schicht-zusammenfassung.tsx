'use client';

import { useEffect, useState } from 'react';
import { CheckCircle, Star, Package, MapPin, Euro, Clock } from 'lucide-react';

interface Props {
  driverId: string;
  locationId: string | null;
  isOnline: boolean;
}

interface ZusammenfassungData {
  touren: number;
  stopps: number;
  km: number;
  einnahmen: number;
  trinkgeld: number;
  avg_bewertung: number | null;
  stornos: number;
  schicht_dauer_min: number;
}

const MOCK: ZusammenfassungData = {
  touren: 4,
  stopps: 12,
  km: 38.4,
  einnahmen: 88.0,
  trinkgeld: 14.5,
  avg_bewertung: 4.7,
  stornos: 1,
  schicht_dauer_min: 300,
};

function fmtEur(v: number) {
  return v.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
}

function fmtMin(min: number) {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h > 0 ? `${h} Std ${m} Min` : `${m} Min`;
}

export function FahrerPhase844SchichtZusammenfassung({ driverId, locationId, isOnline }: Props) {
  const [data, setData] = useState<ZusammenfassungData | null>(null);

  const load = async () => {
    try {
      const params = new URLSearchParams({ driver_id: driverId });
      if (locationId) params.set('location_id', locationId);
      const res = await fetch(`/api/delivery/admin/schicht-zusammenfassung?${params}`, { cache: 'no-store' });
      if (!res.ok) throw new Error();
      setData(await res.json());
    } catch {
      setData(MOCK);
    }
  };

  useEffect(() => {
    if (!isOnline) load();
  }, [isOnline, driverId]); // eslint-disable-line react-hooks/exhaustive-deps

  if (isOnline || !data) return null;

  const gesamt = data.einnahmen + data.trinkgeld;

  return (
    <section className="mx-4 rounded-2xl bg-gradient-to-br from-matcha-800 to-matcha-700 text-white p-5 space-y-4">
      <div className="flex items-center gap-2">
        <CheckCircle className="h-5 w-5 text-matcha-200" />
        <span className="font-bold text-base">Schicht beendet — super gemacht! 🎉</span>
      </div>

      <div className="text-center py-2">
        <div className="text-4xl font-black tabular-nums text-white">{fmtEur(gesamt)}</div>
        <div className="text-sm text-matcha-200 mt-0.5">
          Verdienst {fmtEur(data.einnahmen)} + Trinkgeld {fmtEur(data.trinkgeld)}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <div className="rounded-xl bg-white/10 px-3 py-2.5 text-center">
          <Package className="h-4 w-4 text-matcha-200 mx-auto mb-1" />
          <div className="text-xl font-black tabular-nums">{data.touren}</div>
          <div className="text-[10px] text-matcha-200">Touren</div>
        </div>
        <div className="rounded-xl bg-white/10 px-3 py-2.5 text-center">
          <MapPin className="h-4 w-4 text-matcha-200 mx-auto mb-1" />
          <div className="text-xl font-black tabular-nums">{data.stopps}</div>
          <div className="text-[10px] text-matcha-200">Stopps</div>
        </div>
        <div className="rounded-xl bg-white/10 px-3 py-2.5 text-center">
          <Clock className="h-4 w-4 text-matcha-200 mx-auto mb-1" />
          <div className="text-base font-black">{fmtMin(data.schicht_dauer_min)}</div>
          <div className="text-[10px] text-matcha-200">Dauer</div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <div className="rounded-xl bg-white/10 px-3 py-2 text-center">
          <div className="text-lg font-black tabular-nums">{data.km.toFixed(1)} km</div>
          <div className="text-[10px] text-matcha-200">Gefahren</div>
        </div>
        <div className="rounded-xl bg-white/10 px-3 py-2 text-center">
          <div className="flex items-center justify-center gap-1">
            <Star className="h-3.5 w-3.5 text-amber-300 fill-amber-300" />
            <span className="text-lg font-black tabular-nums">
              {data.avg_bewertung != null ? data.avg_bewertung.toFixed(1) : '—'}
            </span>
          </div>
          <div className="text-[10px] text-matcha-200">Ø Bewertung</div>
        </div>
        <div className="rounded-xl bg-white/10 px-3 py-2 text-center">
          <div className="text-lg font-black tabular-nums">{data.stornos}</div>
          <div className="text-[10px] text-matcha-200">Stornos</div>
        </div>
      </div>
    </section>
  );
}
