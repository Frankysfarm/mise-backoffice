'use client'

import { useState, useEffect, useCallback } from 'react'
import { Navigation, MapPin, Phone, CheckCircle2, Clock, ChevronRight, Package, Bike, Route, Zap, AlertTriangle } from 'lucide-react'
import { cn } from '@/lib/utils'

// Phase 5501 — Tour-Stops Nav Hub V13
// V12+: Stopp-Bestätigung via API; Verkehrsampel Live; Gesamtfortschritts-Ring SVG;
// Aktueller Stopp prominent mit CountdownRing + One-Tap Navigation + Geliefert-CTA;
// Nächste Stopps Liste; 30-Sek-Polling; Mobile-first dark

type Traffic = 'leicht' | 'mittel' | 'schwer'

interface Stop {
  id: string; seq: number; address: string; addressShort: string
  lat: number; lng: number; customerName: string; phone: string
  eta: string; etaSeconds: number; amount: number; orderNumber: string; completed: boolean
}

interface TourData { stops: Stop[]; traffic: Traffic; driver_name: string }

const MOCK_TOUR: TourData = {
  driver_name: 'Du',
  traffic: 'mittel',
  stops: [
    { id: 's1', seq: 1, address: 'Hauptstraße 12, 80331 München',        addressShort: 'Hauptstr. 12',       lat: 48.1351, lng: 11.5820, customerName: 'Maximilian S.', phone: '+4917612345678', eta: '14:32', etaSeconds: 420,  amount: 24.50, orderNumber: '#1042', completed: true  },
    { id: 's2', seq: 2, address: 'Leopoldstraße 45, 80802 München',       addressShort: 'Leopoldstr. 45',     lat: 48.1540, lng: 11.5856, customerName: 'Anna Schmidt',   phone: '+4917687654321', eta: '14:47', etaSeconds: 900,  amount: 31.80, orderNumber: '#1043', completed: false },
    { id: 's3', seq: 3, address: 'Sendlinger Straße 22, 80331 München',   addressShort: 'Sendlinger Str. 22', lat: 48.1340, lng: 11.5680, customerName: 'Peter Bauer',    phone: '+4917611223344', eta: '15:05', etaSeconds: 1800, amount: 18.90, orderNumber: '#1044', completed: false },
    { id: 's4', seq: 4, address: 'Maximilianstraße 8, 80538 München',     addressShort: 'Maximilianstr. 8',   lat: 48.1400, lng: 11.5900, customerName: 'Lisa Weber',     phone: '+4917655667788', eta: '15:22', etaSeconds: 2700, amount: 42.00, orderNumber: '#1045', completed: false },
  ],
}

const TRAFFIC_STYLES: Record<Traffic, { label: string; color: string; bg: string }> = {
  leicht: { label: 'Leichter Verkehr', color: 'text-emerald-300', bg: 'bg-emerald-500/20 border-emerald-500/30' },
  mittel: { label: 'Mittlerer Verkehr', color: 'text-yellow-300',  bg: 'bg-yellow-500/20  border-yellow-500/30'  },
  schwer: { label: 'Schwerer Verkehr',  color: 'text-red-300',     bg: 'bg-red-500/20     border-red-500/30'      },
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

function ProgressRing({ done, total }: { done: number; total: number }) {
  const r = 18, circ = 2 * Math.PI * r
  const pct = total > 0 ? done / total : 0
  return (
    <svg width="44" height="44">
      <circle cx="22" cy="22" r={r} fill="none" stroke="#27272a" strokeWidth="4" />
      <circle cx="22" cy="22" r={r} fill="none" stroke="#8b5cf6" strokeWidth="4"
        strokeDasharray={`${circ}`} strokeDashoffset={`${circ * (1 - pct)}`} strokeLinecap="round"
        transform="rotate(-90 22 22)" />
      <text x="22" y="22" textAnchor="middle" dominantBaseline="middle"
        fontSize="9" fontWeight="bold" fill="#c4b5fd">{done}/{total}</text>
    </svg>
  )
}

export function FahrerPhase5501TourStopsNavHubV13({
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
  const [confirming, setConfirming] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const r = await fetch(`/api/delivery/driver/tour-stops?driverId=${driverId}&locationId=${locationId}`)
      if (!r.ok) throw new Error()
      const d = await r.json()
      setTour(d ?? MOCK_TOUR)
      setElapsed(0)
    } catch { /* Mock-Fallback */ }
  }, [driverId, locationId])

  useEffect(() => { load(); const iv = setInterval(load, 30_000); return () => clearInterval(iv); }, [load])
  useEffect(() => { const iv = setInterval(() => setElapsed(e => e + 1), 1000); return () => clearInterval(iv); }, [])

  const activeStop = tour.stops.find(s => !s.completed)
  const doneCount  = tour.stops.filter(s => s.completed).length
  const remaining  = tour.stops.filter(s => !s.completed)
  const tf         = TRAFFIC_STYLES[tour.traffic]

  const confirmDelivery = async (stopId: string) => {
    setConfirming(stopId)
    try {
      await fetch('/api/delivery/driver/confirm-stop', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ stopId, driverId }) })
      await load()
    } catch { /* ignore */ }
    finally { setConfirming(null) }
  }

  const navUrl = (s: Stop) => `https://www.google.com/maps/dir/?api=1&destination=${s.lat},${s.lng}`

  return (
    <div className={cn('space-y-3', className)}>
      {/* Header strip */}
      <div className={cn('flex items-center gap-2 rounded-xl border px-3 py-1.5 text-xs', tf.bg)}>
        <Route className={cn('h-3.5 w-3.5', tf.color)} />
        <span className={tf.color}>{tf.label}</span>
        <div className="ml-auto flex items-center gap-2">
          <ProgressRing done={doneCount} total={tour.stops.length} />
        </div>
      </div>

      {/* Active Stop */}
      {activeStop ? (
        <div className="rounded-2xl bg-zinc-900 border border-zinc-700 p-4 space-y-3">
          <div className="flex items-center gap-1.5">
            <Bike className="h-4 w-4 text-violet-400" />
            <span className="text-xs font-semibold text-zinc-300 uppercase tracking-wide">Jetzt anfahren</span>
            <span className="ml-auto text-[10px] text-zinc-600 font-mono">Stopp {activeStop.seq}/{tour.stops.length}</span>
          </div>
          <div className="flex items-start gap-3">
            <CountdownRing seconds={Math.max(0, activeStop.etaSeconds - elapsed)} />
            <div className="flex-1 min-w-0 space-y-1">
              <p className="text-sm font-bold text-white leading-tight">{activeStop.customerName}</p>
              <p className="text-xs text-zinc-400 leading-snug">{activeStop.address}</p>
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono text-emerald-400">{activeStop.amount.toFixed(2)} €</span>
                <span className="text-[10px] text-zinc-600">{activeStop.orderNumber}</span>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <a href={navUrl(activeStop)} target="_blank" rel="noreferrer"
              className="flex items-center justify-center gap-1 rounded-xl bg-violet-600 hover:bg-violet-500 py-2.5 transition-colors">
              <Navigation className="h-4 w-4 text-white" />
              <span className="text-xs font-semibold text-white">Navi</span>
            </a>
            <a href={`tel:${activeStop.phone}`}
              className="flex items-center justify-center gap-1 rounded-xl bg-zinc-700 hover:bg-zinc-600 py-2.5 transition-colors">
              <Phone className="h-4 w-4 text-zinc-200" />
              <span className="text-xs font-semibold text-zinc-200">Anrufen</span>
            </a>
            <button onClick={() => confirmDelivery(activeStop.id)} disabled={!!confirming}
              className="flex items-center justify-center gap-1 rounded-xl bg-emerald-700 hover:bg-emerald-600 disabled:opacity-50 py-2.5 transition-colors">
              <CheckCircle2 className="h-4 w-4 text-white" />
              <span className="text-xs font-semibold text-white">{confirming === activeStop.id ? '…' : 'Geliefert'}</span>
            </button>
          </div>
        </div>
      ) : (
        <div className="rounded-2xl bg-emerald-900/30 border border-emerald-500/30 p-4 flex items-center gap-3">
          <CheckCircle2 className="h-6 w-6 text-emerald-400 shrink-0" />
          <div>
            <p className="text-sm font-semibold text-emerald-300">Alle Stopps abgeschlossen!</p>
            <p className="text-xs text-emerald-500">Tour erfolgreich abgeliefert</p>
          </div>
        </div>
      )}

      {/* Next stops */}
      {remaining.slice(1).length > 0 && (
        <div className="space-y-2">
          <p className="text-[10px] text-zinc-600 uppercase tracking-wide font-semibold px-1">Nächste Stopps</p>
          {remaining.slice(1).map(stop => (
            <div key={stop.id} className="flex items-center gap-2 rounded-xl bg-zinc-900 border border-zinc-800 px-3 py-2">
              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-zinc-800 shrink-0">
                <span className="text-[10px] font-bold text-zinc-400">{stop.seq}</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-white truncate">{stop.customerName}</p>
                <p className="text-[10px] text-zinc-500 truncate">{stop.addressShort}</p>
              </div>
              <div className="flex flex-col items-end shrink-0">
                <span className="text-[10px] font-mono text-zinc-400">{stop.eta}</span>
                <span className="text-[10px] text-emerald-500">{stop.amount.toFixed(2)} €</span>
              </div>
              <ChevronRight className="h-3.5 w-3.5 text-zinc-700 shrink-0" />
            </div>
          ))}
        </div>
      )}

      <div className="text-center text-[10px] text-zinc-700 flex items-center justify-center gap-1">
        <Zap className="h-2.5 w-2.5" />
        Live · 30s-Polling
      </div>
    </div>
  )
}
