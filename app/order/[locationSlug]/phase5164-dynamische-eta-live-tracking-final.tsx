'use client'

import { useState, useEffect, useCallback } from 'react'
import { Clock, MapPin, CheckCircle2, ChefHat, Bike, Package, Star, Navigation, AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

// Phase 5164 — Dynamische ETA & Live-Tracking Final
// Bestellstatus-Timeline (Neu/Küche/Unterwegs/Geliefert);
// Live-ETA-Countdown farbkodiert (grün>15min/gelb 5-15min/rot<5min);
// Fahrer-Distanz-Indikator SVG-Ring;
// Bewertungs-Prompt nach Lieferung;
// Live-Polling 15s; Mobile-first; Mock-Fallback

type StatusPhase = 'bestaetigt' | 'kueche' | 'unterwegs' | 'geliefert'

interface TrackingData {
  status: StatusPhase
  etaMinutes: number
  driverName: string
  driverRating: number
  driverDistanceM: number
  orderNumber: string
  estimatedTime: string
}

const MOCK_DATA: TrackingData = {
  status: 'unterwegs',
  etaMinutes: 8,
  driverName: 'Nico W.',
  driverRating: 4.9,
  driverDistanceM: 750,
  orderNumber: '#1042',
  estimatedTime: '14:42',
}

const STATUS_STEPS: { key: StatusPhase; label: string; icon: React.ReactNode }[] = [
  { key: 'bestaetigt', label: 'Bestätigt',  icon: <CheckCircle2 className="h-4 w-4" /> },
  { key: 'kueche',     label: 'In Küche',   icon: <ChefHat className="h-4 w-4" /> },
  { key: 'unterwegs',  label: 'Unterwegs',  icon: <Bike className="h-4 w-4" /> },
  { key: 'geliefert',  label: 'Geliefert',  icon: <Package className="h-4 w-4" /> },
]

const STATUS_ORDER: StatusPhase[] = ['bestaetigt', 'kueche', 'unterwegs', 'geliefert']

function DriverRing({ distanceM }: { distanceM: number }) {
  const r = 40, circ = 2 * Math.PI * r
  const max = 3000
  const pct = Math.max(0, Math.min(1, 1 - distanceM / max))
  const stroke = distanceM < 500 ? '#22c55e' : distanceM < 1500 ? '#eab308' : '#3b82f6'
  const label = distanceM < 1000 ? `${distanceM}m` : `${(distanceM / 1000).toFixed(1)}km`
  return (
    <svg width="100" height="100">
      <circle cx="50" cy="50" r={r} fill="none" stroke="#1f1f23" strokeWidth="6" />
      <circle cx="50" cy="50" r={r} fill="none" stroke={stroke} strokeWidth="6"
        strokeDasharray={circ} strokeDashoffset={circ * (1 - pct)}
        strokeLinecap="round" transform="rotate(-90 50 50)" />
      <text x="50" y="44" textAnchor="middle" dominantBaseline="middle"
        fontSize="13" fontWeight="bold" fill={stroke}>{label}</text>
      <text x="50" y="60" textAnchor="middle" dominantBaseline="middle"
        fontSize="9" fill="#71717a">entfernt</text>
    </svg>
  )
}

function CountdownColor(minutes: number): string {
  if (minutes > 15) return 'text-emerald-400'
  if (minutes > 5)  return 'text-yellow-300'
  return 'text-red-400'
}

export function Phase5164DynamischeEtaLiveTrackingFinal({
  orderId,
  locationSlug,
  className,
}: {
  orderId?: string | null
  locationSlug?: string
  className?: string
}) {
  const [data, setData] = useState<TrackingData>(MOCK_DATA)
  const [elapsed, setElapsed] = useState(0)
  const [showRating, setShowRating] = useState(false)
  const [rating, setRating] = useState(0)
  const [ratingDone, setRatingDone] = useState(false)

  const load = useCallback(async () => {
    if (!orderId) return
    try {
      const res = await fetch(`/api/delivery/tracking?orderId=${orderId}&locationSlug=${locationSlug ?? ''}`)
      if (!res.ok) throw new Error()
      const json = await res.json()
      setData(json ?? MOCK_DATA)
      setElapsed(0)
      if (json?.status === 'geliefert') setShowRating(true)
    } catch { /* Mock-Fallback */ }
  }, [orderId, locationSlug])

  useEffect(() => { load() }, [load])
  useEffect(() => { const id = setInterval(load, 15_000); return () => clearInterval(id) }, [load])
  useEffect(() => { const id = setInterval(() => setElapsed(e => e + 1), 60); return () => clearInterval(id) }, [])

  const liveEta = Math.max(0, data.etaMinutes - Math.floor(elapsed / 60))
  const stepIdx = STATUS_ORDER.indexOf(data.status)

  return (
    <div className={cn('bg-zinc-950 text-white rounded-2xl overflow-hidden', className)}>
      {/* Status-Header */}
      <div className="bg-gradient-to-r from-zinc-900 to-zinc-800 px-4 pt-4 pb-3">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs text-zinc-400">Bestellung {data.orderNumber}</span>
          <span className="text-xs text-zinc-400">{data.estimatedTime} Uhr</span>
        </div>

        {/* Status-Timeline */}
        <div className="flex items-center gap-0">
          {STATUS_STEPS.map((step, i) => {
            const done = i <= stepIdx
            const active = i === stepIdx
            return (
              <div key={step.key} className="flex items-center flex-1">
                <div className="flex flex-col items-center gap-1 flex-1">
                  <div className={cn('w-8 h-8 rounded-full flex items-center justify-center transition-colors',
                    active ? 'bg-blue-500 text-white ring-2 ring-blue-400/50' :
                    done ? 'bg-emerald-500/20 text-emerald-400' :
                    'bg-zinc-800 text-zinc-600')}>
                    {step.icon}
                  </div>
                  <span className={cn('text-xs text-center leading-none',
                    active ? 'text-blue-300 font-semibold' : done ? 'text-emerald-400' : 'text-zinc-600')}>
                    {step.label}
                  </span>
                </div>
                {i < STATUS_STEPS.length - 1 && (
                  <div className={cn('h-0.5 flex-1 mx-1 transition-colors',
                    i < stepIdx ? 'bg-emerald-500/50' : 'bg-zinc-700')} />
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* ETA + Driver */}
      {data.status !== 'geliefert' && (
        <div className="p-4 flex items-center gap-4">
          <DriverRing distanceM={data.driverDistanceM} />
          <div className="flex-1">
            <div className="text-xs text-zinc-500 mb-1">Geschätzte Ankunft</div>
            <div className={cn('text-4xl font-bold font-mono', CountdownColor(liveEta))}>
              {liveEta} min
            </div>
            {liveEta <= 5 && (
              <div className="flex items-center gap-1 mt-1 text-xs text-red-300">
                <AlertCircle className="h-3 w-3" /> Fast da!
              </div>
            )}
            <div className="mt-3 flex items-center gap-2">
              <Bike className="h-4 w-4 text-blue-400 shrink-0" />
              <div>
                <div className="text-sm font-medium">{data.driverName}</div>
                <div className="flex items-center gap-1 text-xs text-yellow-400">
                  <Star className="h-3 w-3 fill-yellow-400" />
                  {data.driverRating.toFixed(1)}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Geliefert-State */}
      {data.status === 'geliefert' && !showRating && (
        <div className="p-6 text-center space-y-2">
          <Package className="h-12 w-12 text-emerald-400 mx-auto" />
          <p className="font-semibold text-emerald-300 text-lg">Geliefert!</p>
          <p className="text-xs text-zinc-400">Guten Appetit 🍽️</p>
          <button onClick={() => setShowRating(true)}
            className="mt-2 text-xs text-blue-400 underline">Jetzt bewerten</button>
        </div>
      )}

      {/* Bewertungs-Prompt */}
      {showRating && !ratingDone && (
        <div className="p-4 space-y-3">
          <div className="text-center">
            <p className="text-sm font-medium mb-3">Wie war deine Erfahrung?</p>
            <div className="flex justify-center gap-2">
              {[1, 2, 3, 4, 5].map(star => (
                <button key={star} onClick={() => setRating(star)}
                  className="transition-transform hover:scale-110">
                  <Star className={cn('h-8 w-8', star <= rating ? 'fill-yellow-400 text-yellow-400' : 'text-zinc-600')} />
                </button>
              ))}
            </div>
          </div>
          <button
            onClick={() => { if (rating > 0) setRatingDone(true) }}
            className={cn('w-full py-2.5 rounded-xl text-sm font-medium transition-colors',
              rating > 0 ? 'bg-blue-600 text-white hover:bg-blue-700' : 'bg-zinc-800 text-zinc-600 cursor-not-allowed')}>
            Bewertung abschicken
          </button>
        </div>
      )}

      {ratingDone && (
        <div className="p-4 text-center space-y-1">
          <CheckCircle2 className="h-8 w-8 text-emerald-400 mx-auto" />
          <p className="text-sm text-emerald-300">Danke für deine Bewertung!</p>
        </div>
      )}

      <p className="text-center text-xs text-zinc-700 pb-2">15s-Polling · Phase 5164</p>
    </div>
  )
}
