'use client'

import { useEffect, useRef, useState } from 'react'
import { ChefHat, Package, Bike, CheckCircle2, Clock, Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'

interface EtaLiveFortschrittBannerProps {
  orderId: string
  initialStatus: string | null
  initialEtaMin: number | null
}

const PHASES = [
  { key: 'in_zubereitung', label: 'Wird zubereitet', icon: ChefHat, progress: 25 },
  { key: 'fertig',         label: 'Fertig!',         icon: Package,       progress: 55 },
  { key: 'unterwegs',      label: 'Unterwegs',       icon: Bike,          progress: 80 },
  { key: 'geliefert',      label: 'Geliefert ✓',    icon: CheckCircle2,  progress: 100 },
]

const STATUS_PROGRESS: Record<string, number> = {
  neu: 8, bestätigt: 15, angenommen: 15,
  in_zubereitung: 30, preparing: 30,
  fertig: 55, ready: 55,
  unterwegs: 80, out_for_delivery: 80, picked_up: 80,
  geliefert: 100, delivered: 100, completed: 100,
}

function activePhaseIndex(status: string | null): number {
  if (!status) return 0
  const progress = STATUS_PROGRESS[status] ?? 0
  for (let i = PHASES.length - 1; i >= 0; i--) {
    if (progress >= PHASES[i].progress) return i
  }
  return 0
}

export function EtaLiveFortschrittBanner({
  orderId,
  initialStatus,
  initialEtaMin,
}: EtaLiveFortschrittBannerProps) {
  const [status, setStatus]         = useState<string | null>(initialStatus)
  const [etaMin, setEtaMin]         = useState<number | null>(initialEtaMin)
  const [driverNear, setDriverNear] = useState(false)
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date())
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Poll every 20 s
  useEffect(() => {
    async function poll() {
      try {
        const res = await fetch(`/api/delivery/eta/${orderId}`)
        if (!res.ok) return
        const data = await res.json() as { eta_min: number; status: string; driver_near: boolean }
        setStatus(data.status)
        setEtaMin(data.eta_min)
        setDriverNear(data.driver_near)
        setLastUpdated(new Date())
      } catch {
        // silently keep last known data
      }
    }

    intervalRef.current = setInterval(poll, 20_000)
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [orderId])

  const progress   = STATUS_PROGRESS[status ?? ''] ?? 8
  const isDelivered = progress >= 100
  const isUnterwegs = (status === 'unterwegs' || status === 'out_for_delivery' || status === 'picked_up') && !isDelivered
  const activeIdx  = activePhaseIndex(status)

  const formattedTime = lastUpdated.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit', second: '2-digit' })

  return (
    <div className="rounded-2xl border bg-card overflow-hidden shadow-sm">
      {/* Animated fill bar at the very top */}
      <div className="relative h-2 w-full bg-muted">
        <div
          className="absolute inset-y-0 left-0 bg-matcha-500 transition-all duration-1000"
          style={{ width: `${progress}%` }}
        />
        {isUnterwegs && (
          <span
            className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 text-base leading-none animate-bounce"
            style={{ left: `${progress}%` }}
            aria-hidden
          >
            🚴
          </span>
        )}
      </div>

      <div className="px-4 pt-3 pb-4 space-y-4">
        {/* Phase stepper */}
        <div className="flex items-start">
          {PHASES.map((phase, idx) => {
            const Icon    = phase.icon
            const isActive = idx === activeIdx
            const isPast   = idx < activeIdx
            const colored  = isActive || isPast
            return (
              <div key={phase.key} className="flex-1 flex flex-col items-center gap-1">
                <Icon
                  className={cn(
                    'h-5 w-5 transition-colors duration-500',
                    colored ? 'text-matcha-600' : 'text-muted-foreground/40',
                    isActive && 'drop-shadow-[0_0_4px_rgba(var(--matcha-500)/0.6)]',
                  )}
                />
                <span
                  className={cn(
                    'text-[10px] text-center leading-tight',
                    colored ? 'text-matcha-600 font-medium' : 'text-muted-foreground/50',
                  )}
                >
                  {phase.label}
                </span>
              </div>
            )
          })}
        </div>

        {/* Center countdown / delivered state */}
        {isDelivered ? (
          <div className="flex flex-col items-center gap-1 py-2">
            <CheckCircle2 className="h-10 w-10 text-green-500" />
            <p className="text-lg font-semibold text-green-600">Genossen! 🎉</p>
            <p className="text-sm text-muted-foreground">Deine Bestellung wurde geliefert.</p>
          </div>
        ) : (
          <div className="flex items-center justify-center gap-2 py-1">
            {etaMin != null && etaMin > 3 ? (
              <>
                <Clock className="h-5 w-5 text-matcha-500 shrink-0" />
                <span className="text-2xl font-bold tracking-tight text-foreground">
                  Noch&nbsp;~{etaMin}&nbsp;Min
                </span>
              </>
            ) : (
              <>
                <Sparkles className="h-5 w-5 text-matcha-500 shrink-0" />
                <span className="text-2xl font-bold tracking-tight text-foreground">
                  Bald bei dir!
                </span>
              </>
            )}
            {driverNear && (
              <span className="ml-2 rounded-full bg-matcha-100 px-2 py-0.5 text-xs font-medium text-matcha-700 animate-pulse">
                Fahrer in der Nähe
              </span>
            )}
          </div>
        )}

        {/* Last updated */}
        <p className="text-right text-[10px] text-muted-foreground/60 tabular-nums">
          Letzte Aktualisierung: {formattedTime}
        </p>
      </div>
    </div>
  )
}
