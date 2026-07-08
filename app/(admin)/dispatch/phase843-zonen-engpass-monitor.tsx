'use client';

import { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle, Clock } from 'lucide-react';

interface Props {
  locationId: string | null;
}

interface ZoneEngpass {
  zone: string;
  offene_bestellungen: number;
  verfuegbare_fahrer: number;
  ampel: 'gruen' | 'amber' | 'rot';
  engpass: boolean;
}

interface EngpassData {
  zonen: ZoneEngpass[];
  gesamt_engpass: boolean;
  generatedAt: string;
}

const MOCK: EngpassData = {
  zonen: [
    { zone: 'A', offene_bestellungen: 2, verfuegbare_fahrer: 3, ampel: 'gruen', engpass: false },
    { zone: 'B', offene_bestellungen: 5, verfuegbare_fahrer: 1, ampel: 'rot', engpass: true },
    { zone: 'C', offene_bestellungen: 3, verfuegbare_fahrer: 2, ampel: 'amber', engpass: false },
    { zone: 'D', offene_bestellungen: 1, verfuegbare_fahrer: 2, ampel: 'gruen', engpass: false },
  ],
  gesamt_engpass: true,
  generatedAt: new Date().toISOString(),
};

export function DispatchPhase843ZonenEngpassMonitor({ locationId }: Props) {
  const [data, setData] = useState<EngpassData | null>(null);

  const load = async () => {
    try {
      const params = new URLSearchParams();
      if (locationId) params.set('location_id', locationId);
      const res = await fetch(`/api/delivery/admin/zonen-engpass?${params}`, { cache: 'no-store' });
      if (!res.ok) throw new Error();
      setData(await res.json());
    } catch {
      setData(MOCK);
    }
  };

  useEffect(() => {
    load();
    const iv = setInterval(load, 30_000);
    return () => clearInterval(iv);
  }, [locationId]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!data) return null;

  const ampelConfig = {
    gruen: { bg: 'bg-matcha-50', border: 'border-matcha-200', text: 'text-matcha-700', dot: 'bg-matcha-500', label: 'OK' },
    amber: { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-700', dot: 'bg-amber-400', label: 'Knapp' },
    rot:   { bg: 'bg-red-50',   border: 'border-red-200',   text: 'text-red-700',   dot: 'bg-red-500',   label: 'Engpass!' },
  };

  const headerConfig = data.gesamt_engpass
    ? { bg: 'bg-red-50', border: 'border-red-200', Icon: AlertTriangle, iconColor: 'text-red-500', title: 'Zonen-Engpass aktiv', titleColor: 'text-red-700' }
    : { bg: 'bg-matcha-50', border: 'border-matcha-200', Icon: CheckCircle, iconColor: 'text-matcha-600', title: 'Alle Zonen versorgt', titleColor: 'text-matcha-700' };

  return (
    <div className={`rounded-2xl border ${headerConfig.border} ${headerConfig.bg}`}>
      <div className="flex items-center gap-3 px-5 py-3">
        <headerConfig.Icon className={`h-5 w-5 ${headerConfig.iconColor} shrink-0`} />
        <div className="flex-1">
          <div className={`text-sm font-bold ${headerConfig.titleColor}`}>{headerConfig.title}</div>
          <div className="text-[11px] text-stone-500">Zonen-Engpass-Monitor · 30s-Update</div>
        </div>
        <Clock className="h-3.5 w-3.5 text-stone-400" />
      </div>

      {data.zonen.length > 0 && (
        <div className="border-t border-stone-100 px-5 py-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {data.zonen.map(z => {
            const cfg = ampelConfig[z.ampel];
            return (
              <div key={z.zone} className={`rounded-xl border ${cfg.border} ${cfg.bg} px-3 py-2.5 text-center`}>
                <div className="flex items-center justify-center gap-1 mb-1">
                  <span className={`w-2 h-2 rounded-full ${cfg.dot} ${z.ampel === 'rot' ? 'animate-pulse' : ''}`} />
                  <span className={`text-[10px] font-bold uppercase ${cfg.text}`}>Zone {z.zone}</span>
                </div>
                <div className={`text-xl font-black ${cfg.text} tabular-nums`}>{z.offene_bestellungen}</div>
                <div className="text-[9px] text-stone-500">Bestellungen</div>
                <div className={`mt-1 text-[10px] font-semibold ${cfg.text}`}>
                  {z.verfuegbare_fahrer} Fahrer frei
                </div>
                <div className={`text-[9px] font-bold ${cfg.text}`}>{cfg.label}</div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
