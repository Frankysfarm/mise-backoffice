"use client";

import { useEffect, useRef, useState } from "react";
import { CheckCircle2, ChefHat, Loader2, MapPin, RefreshCw, Truck, User } from "lucide-react";
import { cn } from "@/lib/utils";

type EtaPhase = "preparing" | "ready" | "picked_up" | "delivering" | "delivered";
type Confidence = "high" | "medium" | "low";

interface EtaResponse {
  eta_min: number;
  confidence: Confidence;
  driver_name?: string;
  driver_eta_min?: number;
  phase: EtaPhase;
}

type Props = {
  orderId: string;
  locationId: string;
  bestellnummer: string;
};

const FALLBACK: EtaResponse = {
  eta_min: 25,
  confidence: "medium",
  phase: "preparing",
};

const PHASE_META: Record<EtaPhase, { label: string; emoji: string; color: string }> = {
  preparing: { label: "Wird zubereitet", emoji: "🍳", color: "text-amber-600" },
  ready: { label: "Fertig", emoji: "✅", color: "text-green-600" },
  picked_up: { label: "Abgeholt", emoji: "🚴", color: "text-blue-600" },
  delivering: { label: "Unterwegs", emoji: "🏠", color: "text-indigo-600" },
  delivered: { label: "Zugestellt", emoji: "🎉", color: "text-green-700" },
};

const CONFIDENCE_META: Record<Confidence, { label: string; style: string }> = {
  high: { label: "Sehr genau", style: "bg-green-100 text-green-800 border-green-200" },
  medium: { label: "Schätzung", style: "bg-yellow-100 text-yellow-800 border-yellow-200" },
  low: { label: "Ungefähr", style: "bg-gray-100 text-gray-700 border-gray-200" },
};

const PHASE_ORDER: EtaPhase[] = ["preparing", "ready", "picked_up", "delivering", "delivered"];

function PhaseProgressBar({ current }: { current: EtaPhase }) {
  const currentIndex = PHASE_ORDER.indexOf(current);
  return (
    <div className="flex items-center gap-0.5 w-full mt-4">
      {PHASE_ORDER.map((phase, i) => {
        const meta = PHASE_META[phase];
        const done = i < currentIndex;
        const active = i === currentIndex;
        return (
          <div key={phase} className="flex flex-col items-center flex-1 min-w-0">
            <div
              className={cn(
                "h-2 w-full rounded-full transition-all duration-500",
                done && "bg-green-500",
                active && "bg-green-400 animate-pulse",
                !done && !active && "bg-gray-200"
              )}
            />
            <span
              className={cn(
                "text-[10px] mt-1 font-medium truncate max-w-full text-center leading-tight",
                active ? meta.color : done ? "text-green-500" : "text-gray-400"
              )}
            >
              {meta.emoji}
            </span>
          </div>
        );
      })}
    </div>
  );
}

export function EtaDynamicLivePanel({ orderId, locationId: _locationId, bestellnummer }: Props) {
  const [data, setData] = useState<EtaResponse>(FALLBACK);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const mountedRef = useRef(true);

  const fetchEta = async (isManual = false) => {
    if (isManual) setRefreshing(true);
    try {
      const res = await fetch(`/api/delivery/eta/${orderId}`, {
        cache: "no-store",
      });
      if (!res.ok) throw new Error("Non-OK response");
      const json: EtaResponse = await res.json();
      if (mountedRef.current) {
        setData(json);
        setLastUpdated(new Date());
      }
    } catch {
      if (mountedRef.current) {
        setData(FALLBACK);
        setLastUpdated(new Date());
      }
    } finally {
      if (mountedRef.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  };

  useEffect(() => {
    mountedRef.current = true;
    fetchEta();
    intervalRef.current = setInterval(() => fetchEta(), 30_000);
    return () => {
      mountedRef.current = false;
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [orderId]);

  const phase = PHASE_META[data.phase];
  const confidence = CONFIDENCE_META[data.confidence];
  const isDelivered = data.phase === "delivered";

  return (
    <div className="w-full max-w-md mx-auto">
      <div className="rounded-2xl bg-white shadow-lg border border-gray-100 overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-green-500 to-emerald-500 px-5 py-4 flex items-center justify-between">
          <div>
            <p className="text-green-100 text-xs font-medium tracking-wide uppercase">
              Bestellung #{bestellnummer}
            </p>
            <p className="text-white font-semibold text-sm mt-0.5">Live-Status</p>
          </div>
          <button
            onClick={() => fetchEta(true)}
            disabled={refreshing}
            aria-label="Aktualisieren"
            className="rounded-full bg-white/20 hover:bg-white/30 transition p-2 disabled:opacity-60"
          >
            {refreshing ? (
              <Loader2 className="w-4 h-4 text-white animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4 text-white" />
            )}
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-6 space-y-5">
          {/* ETA countdown */}
          <div className="flex flex-col items-center gap-2">
            {loading ? (
              <div className="flex items-center gap-2 text-gray-400">
                <Loader2 className="w-6 h-6 animate-spin" />
                <span className="text-sm">Wird geladen…</span>
              </div>
            ) : isDelivered ? (
              <div className="flex flex-col items-center gap-1">
                <CheckCircle2 className="w-14 h-14 text-green-500" />
                <span className="text-2xl font-bold text-green-700">Zugestellt!</span>
              </div>
            ) : (
              <>
                <div className="relative flex items-center justify-center">
                  {/* Pulse rings */}
                  <span className="absolute inline-flex h-full w-full rounded-full bg-green-300 opacity-30 animate-ping" />
                  <div className="relative z-10 bg-green-50 border-2 border-green-400 rounded-full w-32 h-32 flex flex-col items-center justify-center shadow-inner">
                    <span className="text-4xl font-extrabold text-green-700 leading-none">
                      ~{data.eta_min}
                    </span>
                    <span className="text-sm font-semibold text-green-600 mt-0.5">min</span>
                  </div>
                </div>
                {data.driver_eta_min != null && data.driver_eta_min !== data.eta_min && (
                  <p className="text-xs text-gray-500 flex items-center gap-1">
                    <Truck className="w-3 h-3" />
                    Fahrer noch ~{data.driver_eta_min} min entfernt
                  </p>
                )}
              </>
            )}
          </div>

          {/* Phase indicator */}
          <div className="flex items-center gap-2 bg-gray-50 rounded-xl px-4 py-3 border border-gray-100">
            <span className="text-2xl leading-none" role="img" aria-label={phase.label}>
              {phase.emoji}
            </span>
            <div>
              <p className={cn("font-semibold text-sm", phase.color)}>{phase.label}</p>
              <p className="text-xs text-gray-400">Aktueller Status</p>
            </div>
            <div className="ml-auto">
              <span
                className={cn(
                  "text-[11px] font-semibold px-2.5 py-1 rounded-full border",
                  confidence.style
                )}
              >
                {confidence.label}
              </span>
            </div>
          </div>

          {/* Phase progress */}
          <PhaseProgressBar current={data.phase} />

          {/* Driver info */}
          {data.driver_name && (
            <div className="flex items-center gap-2 text-sm text-gray-600 bg-blue-50 rounded-xl px-4 py-2.5 border border-blue-100">
              <User className="w-4 h-4 text-blue-500 shrink-0" />
              <span>
                Ihr Fahrer:{" "}
                <span className="font-semibold text-blue-700">{data.driver_name}</span>
              </span>
              <MapPin className="w-3.5 h-3.5 text-blue-400 ml-auto shrink-0" />
            </div>
          )}

          {/* Last updated */}
          {lastUpdated && (
            <p className="text-center text-[11px] text-gray-400">
              Zuletzt aktualisiert:{" "}
              {lastUpdated.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })} Uhr
              &nbsp;·&nbsp;Aktualisiert alle 30 Sek.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
