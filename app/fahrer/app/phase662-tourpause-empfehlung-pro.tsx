'use client';

import { useEffect, useState } from 'react';
import { Coffee, MapPin, Clock, TrendingUp, Loader2, Battery } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PausenEmpfehlung {
  driver_id: string;
  level: 'kein_bedarf' | 'optional' | 'empfohlen' | 'jetzt_optimal' | 'dringend';
  grund: string;
  empfohlenePauseDauer: number;
  schichtDauerMin: number;
  aktiveSeit: string | null;
}

interface ApiResponse {
  ok: boolean;
  fahrer: PausenEmpfehlung[];
  generatedAt: string;
}

interface HotspotTip {
  name: string;
  distanzMin: number;
  typ: 'cafe' | 'parkplatz' | 'tankstelle';
}

const HOTSPOT_TIPS: HotspotTip[] = [
  { name: 'Café am Marktplatz', distanzMin: 3, typ: 'cafe' },
  { name: 'Großparkplatz Süd', distanzMin: 2, typ: 'parkplatz' },
  { name: 'Tankstelle Nord', distanzMin: 4, typ: 'tankstelle' },
  { name: 'Café Central', distanzMin: 5, typ: 'cafe' },
];

function getHotspotIcon(typ: HotspotTip['typ']) {
  if (typ === 'cafe') return '☕';
  if (typ === 'parkplatz') return '🅿️';
  return '⛽';
}

function getHotspotSuggestion(driverIndex: number): HotspotTip {
  return HOTSPOT_TIPS[driverIndex % HOTSPOT_TIPS.length];
}

interface Props {
  driverId: string;
  driverIndex?: number;
}

export function FahrerPhase662TourpauseEmpfehlungPro({ driverId, driverIndex = 0 }: Props) {
  const [data, setData] = useState<PausenEmpfehlung | null>(null);
  const [loading, setLoading] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (!driverId) return;
    let active = true;
    setDismissed(false);

    async function load() {
      setLoading(true);
      try {
        const res = await fetch(`/api/delivery/admin/fahrer-pausen-empfehlung?location_id=driver&driver_id=${driverId}`);
        if (!res.ok) return;
        const json = await res.json() as ApiResponse;
        const mine = json.fahrer?.find(f => f.driver_id === driverId);
        if (active) setData(mine ?? null);
      } catch {
        // noop
      } finally {
        if (active) setLoading(false);
      }
    }

    load();
    const timer = setInterval(load, 300_000);
    return () => { active = false; clearInterval(timer); };
  }, [driverId]);

  if (loading && !data) return null;
  if (!data) return null;
  if (data.level === 'kein_bedarf' || data.level === 'optional') return null;
  if (dismissed) return null;

  const hotspot = getHotspotSuggestion(driverIndex);

  const headerConfig = {
    empfohlen: { bg: 'bg-blue-500', label: 'Pause empfohlen', icon: Coffee },
    jetzt_optimal: { bg: 'bg-emerald-500', label: 'Jetzt optimale Pause', icon: TrendingUp },
    dringend: { bg: 'bg-red-500', label: 'Pause dringend nötig', icon: Battery },
  } as const;

  const cfg = headerConfig[data.level as 'empfohlen' | 'jetzt_optimal' | 'dringend'] ?? headerConfig.empfohlen;
  const Icon = cfg.icon;

  const schichtH = Math.floor(data.schichtDauerMin / 60);
  const schichtM = data.schichtDauerMin % 60;

  return (
    <div className="rounded-2xl border border-stone-200 overflow-hidden">
      <div className={cn('flex items-center justify-between px-4 py-3 text-white', cfg.bg)}>
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4" />
          <span className="text-sm font-bold">{cfg.label}</span>
        </div>
        <button
          onClick={() => setDismissed(true)}
          className="rounded-full bg-white/20 px-2 py-0.5 text-[10px] font-bold hover:bg-white/30 transition"
        >
          Verstecken
        </button>
      </div>

      <div className="bg-white p-4 space-y-3">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-stone-100 text-lg">
            <Coffee className="h-5 w-5 text-stone-600" />
          </div>
          <div>
            <div className="text-sm font-semibold text-stone-800">{data.grund}</div>
            <div className="flex items-center gap-3 mt-1 text-[11px] text-stone-500">
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                Schicht: {schichtH}h {schichtM}min
              </span>
              <span className="flex items-center gap-1 font-bold text-stone-700">
                Empfohlen: {data.empfohlenePauseDauer} Min Pause
              </span>
            </div>
          </div>
        </div>

        <div className="rounded-xl bg-stone-50 border border-stone-100 p-3">
          <div className="text-[10px] font-bold uppercase tracking-wider text-stone-400 mb-2">
            Nächster Hotspot
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xl">{getHotspotIcon(hotspot.typ)}</span>
            <div>
              <div className="text-sm font-bold text-stone-800">{hotspot.name}</div>
              <div className="flex items-center gap-1 text-[11px] text-stone-500">
                <MapPin className="h-3 w-3" />
                ca. {hotspot.distanzMin} Min Fahrzeit
              </div>
            </div>
          </div>
        </div>

        {data.level === 'dringend' && (
          <div className="rounded-xl bg-red-50 border border-red-200 px-3 py-2 text-[11px] text-red-700 font-medium">
            ⚠️ Gesetzliche Pausenpflicht: Nach 6h Arbeitszeit sind 30 Min Pause vorgeschrieben.
          </div>
        )}
      </div>
    </div>
  );
}
