'use client'

import { useState, useEffect, useCallback } from 'react'
import { Navigation, MapPin, Phone, CheckCircle2, Clock, ChevronRight, Package, Bike, Route } from 'lucide-react'
import { cn } from '@/lib/utils'

// Phase 5493 — Tour-Stops Nav Hub V12
// Aktueller Stopp prominent mit CountdownRing + One-Tap Navigation + Geliefert-CTA;
// Nächste Stopps Liste; Verkehr-Level Badge; 30-Sek-Polling; Mobile-first dark

type Traffic = 'leicht' | 'mittel' | 'schwer'

interface Stop {
  id: string; seq: number; address: string; addressShort: string
  lat: number; lng: number; customerName: string; phone: string
  eta: string; etaSeconds: number; amount: number; orderNumber: string; completed: boolean
}

interface TourData { stops: Stop[]; traffic: Traffic }

const MOCK_TOUR: TourData = {
  traffic: 'mittel',
  stops: [
    { id: 's1', seq: 1, address: 'Hauptstraße 12, 80331 München',        addressShort: 'Hauptstr. 12',       lat: 48.1351, lng: 11.5820, customerName: 'Maximilian S.', phone: '+4917612345678', eta: '14:32', etaSeconds: 420,  amount: 24.50, orderNumber: '#1042', completed: true  },
    { id: 's2', seq: 2, address: 'Leopoldstraße 45, 80802 München',       addressShort: 'Leopoldstr. 45',     lat: 48.1540, lng: 11.5856, customerName: 'Anna Schmidt',   phone: '+4917687654321', eta: '14:47', etaSeconds: 900,  amount: 31.80, orderNumber: '#1043', completed: false },
    { id: 's3', seq: 3, address: 'Sendlinger Straße 22, 80331 München',   addressShort: 'Sendlinger Str. 22', lat: 48.1340, lng: 11.5680, customerName: 'Peter Bauer',    phone: '+4917611223344', eta: '15:05', etaSeconds: 1800, amount: 18.90, orderNumber: '#1044', completed: false },
    { id: 's4', seq: 4, address: 'Maximilianstraße 8, 80538 München',     addressShort: 'Maximilianstr. 8',   lat: 48.1400, lng: 11.5900, customerName: 'Lisa Weber',     phone: '+4917655667788', eta: '15:22', etaSeconds: 2700, amount: 42.00, orderNumber: '#1045', completed: false },
    { id: 's5', seq: 5, address: 'Nymphenburger Straße 3, 80335 München', addressShort: 'Nymphenburger Str.', lat: 48.1450, lng: 11.5450, customerName: 'Klaus Müller',   phone: '+4917699887766', eta: '15:40', etaSeconds: 3600, amount: 15.50, orderNumber: '#1046', completed: false },
  ],
}

const TRAFFIC_STYLES: Record<Traffic, string> = {
  leicht: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
  mittel: 'bg-yellow-500/20  text-yellow-300  border-yellow-500/30',
  schwer: 'bg-red-500/20     text-red-300     border-red-500/30',
}

function fmt(s: number): string {
  const a = Math.abs(s)
  return `${s < 0 ? '-' : ''}${Math.floor(a / 60)}:${(a % 60).toString().padStart(2, '0')}`
}

function CountdownRing({ seconds }: { seconds: number }) {
  const r = 38, circ = 2 * Math.PI * r
  const pct = Math.max(0, Math.min(1, seconds / (25 * 60)))
  const stroke = seconds > 600 ? '#22c55e' : seconds > 300 ? '#eab308' : '#ef4444'
  return (
    <svg width="92" height="92" className="shrink-0">
      <circle cx="46" cy="46" r={r} fill="none" stroke="#27272a" strokeWidth="6" />
      <circle cx="46" cy="46" r={r} fill="none" stroke={stroke} strokeWidth="6"
        strokeDasharray={`${circ}`} strokeDashoffset={`${circ * (1 - pct)}`} strokeLinecap="round"
        transform="rotate(-90 46 46)" />
      <text x="46" y="43" textAnchor="middle" dominantBaseline="middle"
        fontSize="13" fontWeight="bold" fill={stroke}>{fmt(seconds)}</text>
      <text x="46" y="58" textAnchor="middle" dominantBaseline="middle"
        fontSize="9" fill="#71717a">ETA</text>
    </svg>
  )
}

export function FahrerPhase5493TourStopsNavHubV12({
  driverId,
  locationId,
  className,
}: {
  driverId: string
  locationId?: string | null
  className?: string
}) {
  const [tour, setTour]       = useState<TourData>(MOCK_TOUR)
  const [elapsed, setElapsed] = useState(0)

  const load = useCallback(async () => {
    try {
      const r = await fetch(`/api/delivery/driver/tour-stops?driverId=${driverId}&locationId=${locationId}`)
      if (!r.ok) throw new Error()
      const d = await r.json()
      setTour(d ?? MOCK_TOUR)
      setElapsed(0)
    } catch {
      setTour(MOCK_TOUR)
      setElapsed(0)
    }
  }, [driverId, locationId])

  useEffect(() => { load() }, [load])
  useEffect(() => { const id = setInterval(load, 30_000); return () => clearInterval(id) }, [load])
  useEffect(() => { const id = setInterval(() => setElapsed(e => e + 1), 1_000); return () => clearInterval(id) }, [])

  const liveStops = tour.stops.map(s => ({ ...s, etaSeconds: Math.max(0, s.etaSeconds - elapsed) }))
  const pending   = liveStops.filter(s => !s.completed)
  const current   = pending[0] ?? null
  const nextStops = pending.slice(1)
  const completed = liveStops.filter(s => s.completed).length
  const total     = liveStops.length

  const confirmDelivery = useCallback(() => {
    if (!current) return
    setTour(prev => ({ ...prev, stops: prev.stops.map(s => s.id === current.id ? { ...s, completed: true } : s) }))
  }, [current])

  return (
    <div className={cn('bg-zinc-950 min-h-screen p-4 space-y-4 max-w-lg mx-auto', className)}>
      {/* Header */}
      <div className="flex items-center justify-between pt-1">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 bg-emerald-500/10 rounded-full flex items-center justify-center">
            <Bike className="w-5 h-5 text-emerald-400" />
          </div>
          <div>
            <h1 className="text-white font-bold leading-tight">Aktuelle Tour</h1>
            <p className="text-zinc-500 text-xs">{completed}/{total} Stopps erledigt</p>
          </div>
        </div>
        <span className={cn('text-xs px-2.5 py-1 rounded-full border font-medium', TRAFFIC_STYLES[tour.traffic])}>
          <Route className="w-3 h-3 inline mr-1" />{tour.traffic}
        </span>
      </div>

      {/* Progress Bar */}
      <div className="w-full bg-zinc-800 rounded-full h-2 overflow-hidden">
        <div className="h-2 bg-emerald-500 rounded-full transition-all duration-700"
          style={{ width: `${total > 0 ? (completed / total) * 100 : 0}%` }} />
      </div>

      {/* Current Stop */}
      {current ? (
        <div className="bg-zinc-900 border border-zinc-700 rounded-2xl p-4 space-y-3">
          <div className="flex items-start gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-zinc-400 text-xs mb-1">Aktueller Stopp</p>
              <p className="text-white font-bold text-2xl leading-tight">{current.customerName}</p>
              <div className="flex items-start gap-1.5 mt-1.5">
                <MapPin className="w-3.5 h-3.5 text-zinc-500 mt-0.5 shrink-0" />
                <p className="text-zinc-300 text-sm leading-snug">{current.address}</p>
              </div>
            </div>
            <CountdownRing seconds={current.etaSeconds} />
          </div>

          {/* Navigation Buttons */}
          <div className="grid grid-cols-2 gap-2">
            <a href={`https://maps.google.com/?q=${current.lat},${current.lng}`} target="_blank" rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white rounded-xl py-3 text-sm font-semibold transition-colors">
              <Navigation className="w-4 h-4" />Google Maps
            </a>
            <a href={`waze://?ll=${current.lat},${current.lng}&navigate=yes`} target="_blank" rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 bg-sky-600 hover:bg-sky-500 active:bg-sky-700 text-white rounded-xl py-3 text-sm font-semibold transition-colors">
              <Route className="w-4 h-4" />Waze
            </a>
          </div>

          {/* Order Info + Call */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-3 text-sm">
              <span className="flex items-center gap-1 text-zinc-400"><Package className="w-3.5 h-3.5" />{current.orderNumber}</span>
              <span className="text-emerald-400 font-bold">€{current.amount.toFixed(2)}</span>
            </div>
            <a href={`tel:${current.phone}`}
              className="flex items-center gap-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors">
              <Phone className="w-4 h-4" />Anrufen
            </a>
          </div>

          {/* Geliefert CTA */}
          <button onClick={confirmDelivery}
            className="w-full bg-emerald-600 hover:bg-emerald-500 active:scale-[0.98] text-white rounded-xl py-4 font-bold text-base flex items-center justify-center gap-2 transition-all shadow-lg shadow-emerald-900/40">
            <CheckCircle2 className="w-5 h-5" />Geliefert
          </button>
        </div>
      ) : (
        <div className="bg-zinc-900 border border-emerald-500/30 rounded-2xl p-8 text-center">
          <CheckCircle2 className="w-14 h-14 text-emerald-400 mx-auto mb-3" />
          <p className="text-white font-bold text-lg">Tour abgeschlossen!</p>
          <p className="text-zinc-400 text-sm mt-1">Alle {total} Stopps erledigt</p>
        </div>
      )}

      {/* Next Stops List */}
      {nextStops.length > 0 && (
        <div className="space-y-2">
          <p className="text-zinc-500 text-xs font-semibold uppercase tracking-wider px-1">Nächste Stopps</p>
          <div className="space-y-1.5 max-h-64 overflow-y-auto">
            {nextStops.map(s => (
              <div key={s.id} className="bg-zinc-900 border border-zinc-800 rounded-xl p-3 flex items-center gap-3">
                <div className="w-7 h-7 rounded-full bg-zinc-800 flex items-center justify-center text-xs font-bold text-zinc-400 shrink-0">
                  {s.seq}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-zinc-300 text-sm font-medium truncate">{s.addressShort}</p>
                  <p className="text-zinc-600 text-xs">{s.customerName}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0 text-xs">
                  <span className="flex items-center gap-1 text-zinc-400"><Clock className="w-3 h-3" />{s.eta}</span>
                  <span className="text-emerald-400 font-semibold">€{s.amount.toFixed(2)}</span>
                  <ChevronRight className="w-3.5 h-3.5 text-zinc-700" />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
