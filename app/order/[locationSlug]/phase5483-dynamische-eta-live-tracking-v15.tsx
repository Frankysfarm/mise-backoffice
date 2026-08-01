'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Package, ChefHat, Bike, CheckCircle2, Clock, Phone, Navigation2, MapPin, Star, Zap, AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

// Phase 5483 — Dynamische ETA Live-Tracking V15

type OrderPhase = 'ordered' | 'confirmed' | 'preparing' | 'on_way' | 'delivered'

interface PhaseConfig { key: OrderPhase; label: string; icon: React.ReactNode }
interface DriverInfo { name: string; rating: number; phone: string }
interface TrackingData { status: OrderPhase; etaSeconds: number; estimatedTime: string; driver?: DriverInfo }

const PHASES: PhaseConfig[] = [
  { key: 'ordered',   label: 'Bestellt',    icon: <Package      className="w-4 h-4" /> },
  { key: 'confirmed', label: 'Bestätigt',   icon: <CheckCircle2 className="w-4 h-4" /> },
  { key: 'preparing', label: 'Zubereitung', icon: <ChefHat      className="w-4 h-4" /> },
  { key: 'on_way',    label: 'Unterwegs',   icon: <Bike         className="w-4 h-4" /> },
  { key: 'delivered', label: 'Geliefert',   icon: <Zap          className="w-4 h-4" /> },
]

const PHASE_ORDER: OrderPhase[] = ['ordered', 'confirmed', 'preparing', 'on_way', 'delivered']

const MOCK_DATA: TrackingData = {
  status: 'on_way',
  etaSeconds: 840,
  estimatedTime: '14:47',
  driver: { name: 'Marco B.', rating: 4.8, phone: '+4917612345678' },
}

function fmt(s: number): string {
  const a = Math.abs(s)
  return `${s < 0 ? '-' : ''}${Math.floor(a / 60)}:${(a % 60).toString().padStart(2, '0')}`
}

function ETARing({ seconds }: { seconds: number }) {
  const r = 52, circ = 2 * Math.PI * r
  const pct = Math.max(0, Math.min(1, seconds / (40 * 60)))
  const stroke = seconds > 600 ? '#16a34a' : seconds > 300 ? '#d97706' : '#dc2626'
  return (
    <svg width="128" height="128">
      <circle cx="64" cy="64" r={r} fill="none" stroke="#f3f4f6" strokeWidth="7" />
      <circle cx="64" cy="64" r={r} fill="none" stroke={stroke} strokeWidth="7"
        strokeDasharray={`${circ}`} strokeDashoffset={`${circ * (1 - pct)}`}
        strokeLinecap="round" transform="rotate(-90 64 64)" />
      <text x="64" y="57" textAnchor="middle" dominantBaseline="middle"
        fontSize="22" fontWeight="bold" fill={stroke}>{fmt(seconds)}</text>
      <text x="64" y="76" textAnchor="middle" dominantBaseline="middle"
        fontSize="11" fill="#6b7280">verbleibend</text>
    </svg>
  )
}

export function StorefrontPhase5483DynamischeEtaLiveTrackingV15({
  orderId,
  locationSlug,
  initialStatus,
  initialEta,
  className,
}: {
  orderId: string
  locationSlug: string
  initialStatus?: string
  initialEta?: string | null
  className?: string
}) {
  const [data, setData]       = useState<TrackingData>({
    ...MOCK_DATA,
    status: (initialStatus as OrderPhase | undefined) ?? MOCK_DATA.status,
    estimatedTime: initialEta ?? MOCK_DATA.estimatedTime,
  })
  const [elapsed, setElapsed] = useState(0)
  const channelRef = useRef<ReturnType<ReturnType<typeof createClient>['channel']> | null>(null)

  const load = useCallback(async () => {
    try {
      const r = await fetch(`/api/order/${locationSlug}/${orderId}/tracking`)
      if (!r.ok) throw new Error()
      const d = await r.json()
      if (d) { setData(d); setElapsed(0) }
    } catch { /* keep current data */ }
  }, [orderId, locationSlug])

  useEffect(() => {
    load()
    const poll = setInterval(load, 30_000)
    try {
      const supabase = createClient()
      const ch = supabase
        .channel(`order-tracking-${orderId}`)
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'orders', filter: `id=eq.${orderId}` },
          (payload: { new: Record<string, unknown> }) => {
            if (payload.new) {
              setData(prev => ({
                ...prev,
                status: payload.new.status as OrderPhase ?? prev.status,
                etaSeconds: typeof payload.new.eta_seconds === 'number' ? payload.new.eta_seconds : prev.etaSeconds,
                estimatedTime: typeof payload.new.estimated_time === 'string' ? payload.new.estimated_time : prev.estimatedTime,
              }))
              setElapsed(0)
            }
          })
        .subscribe()
      channelRef.current = ch
    } catch { /* Supabase unavailable — polling fallback active */ }
    return () => { clearInterval(poll); channelRef.current?.unsubscribe() }
  }, [load, orderId])

  useEffect(() => { const id = setInterval(() => setElapsed(e => e + 1), 1_000); return () => clearInterval(id) }, [])

  const liveSeconds     = Math.max(0, data.etaSeconds - elapsed)
  const currentPhaseIdx = PHASE_ORDER.indexOf(data.status)
  const isOnWay         = data.status === 'on_way'
  const isDelivered     = data.status === 'delivered'

  return (
    <div className={cn('bg-white min-h-screen p-4 space-y-4 max-w-md mx-auto', className)}>
      {/* Header */}
      <div className="flex items-center gap-3 pt-2">
        <div className="w-9 h-9 rounded-full bg-green-100 flex items-center justify-center">
          <Package className="w-5 h-5 text-green-600" />
        </div>
        <div className="flex-1">
          <h1 className="font-bold text-gray-900">Bestellung verfolgen</h1>
          <p className="text-gray-400 text-xs">#{orderId}</p>
        </div>
        {isOnWay
          ? <span className="flex items-center gap-1 text-xs bg-green-100 text-green-700 px-2.5 py-1 rounded-full font-semibold"><Zap className="w-3 h-3" />Live</span>
          : !isDelivered && <span className="flex items-center gap-1 text-xs bg-gray-100 text-gray-500 px-2.5 py-1 rounded-full"><Clock className="w-3 h-3" />{data.estimatedTime}</span>
        }
      </div>

      {/* Status Timeline */}
      <div className="bg-gray-50 rounded-2xl p-4">
        {PHASES.map((phase, i) => {
          const passed = i < currentPhaseIdx
          const active = i === currentPhaseIdx
          const isLast = i === PHASES.length - 1
          return (
            <div key={phase.key} className="flex items-start gap-3">
              <div className="flex flex-col items-center shrink-0">
                <div className={cn(
                  'w-8 h-8 rounded-full flex items-center justify-center transition-all',
                  passed   ? 'bg-green-500 text-white' :
                  active   ? 'bg-white text-green-600 ring-2 ring-green-500 ring-offset-2 ring-offset-gray-50' :
                             'bg-gray-200 text-gray-400',
                )}>
                  {phase.icon}
                </div>
                {!isLast && (
                  <div className={cn('w-0.5 h-6 my-0.5 transition-colors', passed ? 'bg-green-400' : 'bg-gray-200')} />
                )}
              </div>
              <div className={cn('pt-1', isLast ? '' : 'pb-2')}>
                <p className={cn('text-sm font-semibold leading-tight',
                  active ? 'text-green-700' : passed ? 'text-gray-700' : 'text-gray-400')}>
                  {phase.label}
                </p>
                {active && !isDelivered && <p className="text-xs text-green-500 mt-0.5">In Bearbeitung …</p>}
                {passed && <p className="text-xs text-gray-400 mt-0.5">Erledigt</p>}
              </div>
            </div>
          )
        })}
      </div>

      {/* ETA Countdown */}
      {!isDelivered && (
        <div className="flex flex-col items-center py-2 gap-2">
          <ETARing seconds={liveSeconds} />
          <p className="text-gray-500 text-sm">
            Geschätzte Ankunft: <span className="font-bold text-gray-900">{data.estimatedTime} Uhr</span>
          </p>
          {liveSeconds < 300 && liveSeconds > 0 && (
            <span className="flex items-center gap-1 text-xs text-orange-600 bg-orange-50 px-3 py-1 rounded-full">
              <AlertCircle className="w-3 h-3" />Fahrer ist gleich da!
            </span>
          )}
        </div>
      )}

      {isDelivered && (
        <div className="text-center py-6 space-y-2">
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-12 h-12 text-green-500" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900">Geliefert!</h2>
          <p className="text-gray-500">Guten Appetit!</p>
        </div>
      )}

      {/* Driver Card */}
      {isOnWay && data.driver && (
        <div className="bg-gray-50 rounded-2xl p-4">
          <p className="text-xs text-gray-400 font-semibold mb-3 flex items-center gap-1.5">
            <Bike className="w-3.5 h-3.5" />Ihr Fahrer ist unterwegs
          </p>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-green-200 flex items-center justify-center text-green-700 font-bold text-base">
                {data.driver.name.split(' ').map(n => n[0]).join('')}
              </div>
              <div>
                <p className="font-semibold text-gray-900">{data.driver.name}</p>
                <div className="flex items-center gap-1 mt-0.5">
                  <Star className="w-3.5 h-3.5 fill-yellow-400 text-yellow-400" />
                  <span className="text-sm text-gray-600 font-medium">{data.driver.rating}</span>
                </div>
              </div>
            </div>
            <a href={`tel:${data.driver.phone}`}
              className="w-11 h-11 bg-green-500 hover:bg-green-600 rounded-full flex items-center justify-center text-white transition-colors shadow-md shadow-green-200">
              <Phone className="w-5 h-5" />
            </a>
          </div>
        </div>
      )}

      {isOnWay && (
        <div className="relative bg-green-50 border border-green-100 rounded-2xl h-36 overflow-hidden flex items-center justify-center">
          <div className="relative flex flex-col items-center gap-2">
            <div className="relative w-5 h-5">
              <div className="absolute inset-0 bg-green-400 rounded-full animate-ping opacity-60" />
              <div className="w-5 h-5 bg-green-500 rounded-full flex items-center justify-center relative z-10">
                <Bike className="w-3 h-3 text-white" />
              </div>
            </div>
            <span className="flex items-center gap-1.5 text-xs text-green-700 font-semibold bg-white rounded-full px-3 py-1.5 shadow-sm">
              <Navigation2 className="w-3.5 h-3.5" />Fahrer nähert sich
            </span>
          </div>
          <span className="absolute bottom-2 right-3 text-[10px] text-gray-400 flex items-center gap-1">
            <MapPin className="w-2.5 h-2.5" />Echtzeit-Tracking
          </span>
        </div>
      )}
    </div>
  )
}
