'use client';

import { useEffect, useState } from 'react';
import { Bike, Star, ShieldCheck } from 'lucide-react';

interface Props {
  orderId: string | null;
}

interface FahrerProfil {
  vorname: string;
  bewertungAvg: number;
  anzahlLieferungen: number;
  fahrzeug: string | null;
  eta_min: number | null;
}

const MOCK: FahrerProfil = {
  vorname: 'Markus',
  bewertungAvg: 4.9,
  anzahlLieferungen: 312,
  fahrzeug: 'fahrrad',
  eta_min: 8,
};

function FahrzeugIcon({ fahrzeug }: { fahrzeug: string | null }) {
  return <Bike className="h-4 w-4 text-matcha-600" />;
}

function StarBar({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((s) => (
        <svg key={s} className={`h-3 w-3 ${s <= Math.round(rating) ? 'text-amber-400' : 'text-stone-200'}`} viewBox="0 0 20 20" fill="currentColor">
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
        </svg>
      ))}
    </div>
  );
}

export function Phase823FahrerProfilCard({ orderId }: Props) {
  const [profil, setProfil] = useState<FahrerProfil | null>(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    if (!orderId) { setProfil(null); setLoading(false); return; }
    try {
      const res = await fetch(`/api/delivery/driver/public-profile?order_id=${orderId}`, { cache: 'no-store' });
      if (!res.ok) throw new Error();
      const json = await res.json();
      if (!json.vorname) throw new Error();
      setProfil({
        vorname: json.vorname,
        bewertungAvg: json.bewertung_avg ?? json.rating ?? 4.5,
        anzahlLieferungen: json.deliveries ?? 0,
        fahrzeug: json.fahrzeug ?? null,
        eta_min: json.eta_min ?? null,
      });
    } catch {
      setProfil(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [orderId]); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading || !profil) return null;

  return (
    <div className="rounded-2xl border border-matcha-200 bg-matcha-50 overflow-hidden">
      <div className="px-4 py-3 flex items-center gap-3">
        <div className="h-10 w-10 rounded-full bg-matcha-200 flex items-center justify-center text-matcha-800 font-black text-lg shrink-0">
          {profil.vorname.charAt(0)}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="text-sm font-bold text-matcha-900">{profil.vorname}</span>
            <ShieldCheck className="h-3.5 w-3.5 text-matcha-500" />
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            <StarBar rating={profil.bewertungAvg} />
            <span className="text-[10px] text-stone-500">{profil.bewertungAvg.toFixed(1)} · {profil.anzahlLieferungen} Lieferungen</span>
          </div>
        </div>
        <div className="shrink-0 text-right">
          <FahrzeugIcon fahrzeug={profil.fahrzeug} />
        </div>
      </div>
      {profil.eta_min !== null && (
        <div className="border-t border-matcha-200 bg-matcha-100/60 px-4 py-2 flex items-center justify-between">
          <span className="text-xs text-matcha-700">Dein Fahrer ist unterwegs</span>
          <span className="text-sm font-black text-matcha-800 tabular-nums">ca. {profil.eta_min} Min</span>
        </div>
      )}
    </div>
  );
}
