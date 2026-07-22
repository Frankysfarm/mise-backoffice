"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { Bike, CheckCircle2, ChefHat, Clock, MapPin, Navigation, Package } from "lucide-react";

// ETA Live Proximity Board (Storefront)
// Zeigt Echtzeit-Lieferstatus mit Phase-Progress, dynamischem Countdown
// und Fahrer-Nähe-Indikator. 20-Sek-Polling, 1-Sek-Countdown-Tick.

type DeliveryPhase = "preparing" | "ready" | "picked_up" | "delivering" | "delivered";

interface TrackingData {
  phase: DeliveryPhase;
  eta_min: number | null;
  driver_name: string | null;
  driver_eta_sec: number | null;
  driver_distance_km: number | null;
  on_track: boolean;
}

const PHASES: DeliveryPhase[] = ["preparing", "ready", "picked_up", "delivering", "delivered"];

const PHASE_META: Record<DeliveryPhase, { label: string; icon: React.ElementType; color: string; bg: string }> = {
  preparing:  { label: "Zubereitung",   icon: ChefHat,       color: "text-amber-600",  bg: "bg-amber-100" },
  ready:      { label: "Fertig",         icon: Package,       color: "text-green-600",  bg: "bg-green-100" },
  picked_up:  { label: "Abgeholt",       icon: Navigation,    color: "text-blue-600",   bg: "bg-blue-100" },
  delivering: { label: "Unterwegs",      icon: Bike,          color: "text-indigo-600", bg: "bg-indigo-100" },
  delivered:  { label: "Zugestellt ✓",   icon: CheckCircle2,  color: "text-green-700",  bg: "bg-green-200" },
};

type Props = {
  orderId: string;
  locationId: string;
};

function secToLabel(sec: number): string {
  if (sec <= 0) return "0:00";
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

const FALLBACK: TrackingData = {
  phase: "preparing",
  eta_min: 25,
  driver_name: null,
  driver_eta_sec: null,
  driver_distance_km: null,
  on_track: true,
};

export function EtaLiveProximityBoard({ orderId, locationId }: Props) {
  const [data, setData] = useState<TrackingData>(FALLBACK);
  const [etaSec, setEtaSec] = useState<number | null>(null);
  const etaSecRef = useRef<number | null>(null);
  const [driverEtaSec, setDriverEtaSec] = useState<number | null>(null);
  const driverEtaRef = useRef<number | null>(null);
  const [tick, setTick] = useState(0);

  async function loadData() {
    try {
      const res = await fetch(`/api/delivery/eta/${orderId}`);
      if (!res.ok) return;
      const json = await res.json() as TrackingData;
      setData(json);
      const newEta = json.eta_min != null ? json.eta_min * 60 : null;
      etaSecRef.current = newEta;
      setEtaSec(newEta);
      const deta = json.driver_eta_sec ?? null;
      driverEtaRef.current = deta;
      setDriverEtaSec(deta);
    } catch {
      // keep existing data on error
    }
  }

  // 1-sec tick
  useEffect(() => {
    const iv = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(iv);
  }, []);

  useEffect(() => {
    if (etaSecRef.current !== null) {
      etaSecRef.current = Math.max(0, etaSecRef.current - 1);
      setEtaSec(etaSecRef.current);
    }
    if (driverEtaRef.current !== null) {
      driverEtaRef.current = Math.max(0, driverEtaRef.current - 1);
      setDriverEtaSec(driverEtaRef.current);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick]);

  useEffect(() => {
    loadData();
    const iv = setInterval(loadData, 20_000);
    return () => clearInterval(iv);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId, locationId]);

  const phaseIdx = PHASES.indexOf(data.phase);
  const PhaseIcon = PHASE_META[data.phase].icon;
  const isDelivered = data.phase === "delivered";

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm w-full max-w-sm mx-auto">
      {/* Phase indicator */}
      <div className={cn("flex items-center gap-2 rounded-xl px-3 py-2 mb-4", PHASE_META[data.phase].bg)}>
        <PhaseIcon className={cn("w-5 h-5 shrink-0", PHASE_META[data.phase].color)} />
        <span className={cn("text-sm font-bold", PHASE_META[data.phase].color)}>
          {PHASE_META[data.phase].label}
        </span>
        {!data.on_track && !isDelivered && (
          <span className="ml-auto text-xs font-bold text-red-600 bg-red-100 rounded px-1.5 py-0.5">
            Verzögerung
          </span>
        )}
      </div>

      {/* Progress dots */}
      <div className="flex items-center gap-1 mb-4">
        {PHASES.map((p, i) => (
          <div key={p} className="flex items-center flex-1">
            <div className={cn(
              "h-2 rounded-full transition-all duration-700 w-full",
              i < phaseIdx ? "bg-green-500" :
              i === phaseIdx ? "bg-green-400 animate-pulse" : "bg-gray-200",
            )} />
          </div>
        ))}
      </div>

      {/* ETA countdown */}
      {!isDelivered && etaSec !== null && (
        <div className="text-center mb-4">
          <div className="text-xs text-gray-500 mb-0.5">Voraussichtliche Lieferung in</div>
          <div className={cn(
            "text-4xl font-bold tabular-nums",
            (etaSec ?? 0) < 300 ? "text-red-500" :
            (etaSec ?? 0) < 600 ? "text-yellow-600" : "text-green-700",
          )}>
            {etaSec > 60
              ? `${Math.ceil(etaSec / 60)} min`
              : `0:${String(etaSec).padStart(2, "0")}`}
          </div>
        </div>
      )}

      {isDelivered && (
        <div className="text-center py-2 mb-4">
          <CheckCircle2 className="w-10 h-10 text-green-500 mx-auto mb-1" />
          <div className="text-base font-bold text-green-700">Zugestellt!</div>
        </div>
      )}

      {/* Driver info */}
      {data.driver_name && !isDelivered && (
        <div className="rounded-lg border border-indigo-100 bg-indigo-50 p-2.5 flex items-center gap-3">
          <Bike className="w-4 h-4 text-indigo-600 shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="text-xs font-bold text-indigo-800">{data.driver_name}</div>
            {driverEtaSec !== null && (
              <div className="text-xs text-indigo-600">
                {driverEtaSec <= 60
                  ? "Gleich da!"
                  : `Ankunft in ${Math.ceil(driverEtaSec / 60)} min`}
              </div>
            )}
          </div>
          {data.driver_distance_km != null && (
            <div className="flex items-center gap-1 text-xs text-indigo-600 font-bold shrink-0">
              <MapPin className="w-3 h-3" />
              {data.driver_distance_km < 1
                ? `${Math.round(data.driver_distance_km * 1000)} m`
                : `${data.driver_distance_km.toFixed(1)} km`}
            </div>
          )}
        </div>
      )}

      {/* Phase labels */}
      <div className="flex mt-3">
        {PHASES.map((p, i) => (
          <div key={p} className="flex-1 text-center">
            <div className={cn(
              "text-[9px] leading-tight",
              i === phaseIdx ? "font-bold text-green-700" :
              i < phaseIdx ? "text-gray-500" : "text-gray-300",
            )}>
              {PHASE_META[p].label.replace(" ✓", "")}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
