'use client'

import { useState, useEffect, useCallback } from 'react'
import { Navigation, MapPin, Phone, CheckCircle2, Clock, ChevronRight, Package, MessageSquare, ChevronDown, ChevronUp, AlertCircle, Bike } from 'lucide-react'
import { cn } from '@/lib/utils'

// Phase 5505 — Tour-Stops Nav Hub V14
// V13+: Swipe-to-Confirm Geste (Tap-Hold 800ms → Bestätigung);
// Kunden-Kontakt-Schnell-Aktionen tel + WhatsApp;
// Live-Kundendistanz-Ring SVG farbkodiert;
// Paketübergabe-Checkliste (2-Klick: Foto vorhanden / Klingel gedrückt);
// Gesamtfortschritts-Balken + Stopp-Abschluss-CTA;
// 30-Sek-Poll; Mock-Fallback; Mobile-first dark

type Traffic = 'leicht' | 'mittel' | 'schwer'

interface CheckItem { id: string; label: string; done: boolean }
interface Stop {
  id: string; seq: number; address: string; addressShort: string
  lat: number; lng: number; customerName: string; phone: string
  eta: string; etaSeconds: number; amount: number; orderNumber: string
  completed: boolean; distanceM: number
  checklist: CheckItem[]
}
interface TourData { stops: Stop[]; traffic: Traffic; driverLat: number; driverLng: number }

const MOCK_TOUR: TourData = {
  traffic: 'mittel', driverLat: 48.1380, driverLng: 11.5750,
  stops: [
    { id: 's1', seq: 1, address: 'Hauptstraße 12, 80331 München',        addressShort: 'Hauptstr. 12',       lat: 48.1351, lng: 11.5820, customerName: 'Maximilian S.', phone: '+4917612345678', eta: '14:32', etaSeconds: 420,  amount: 24.50, orderNumber: '#1042', completed: true,  distanceM: 0,    checklist: [{ id: 'c1', label: 'Klingel gedrückt', done: true }, { id: 'c2', label: 'Foto aufgenommen', done: true }] },
    { id: 's2', seq: 2, address: 'Leopoldstraße 45, 80802 München',       addressShort: 'Leopoldstr. 45',     lat: 48.1540, lng: 11.5856, customerName: 'Anna Schmidt',   phone: '+4917687654321', eta: '14:47', etaSeconds: 900,  amount: 31.80, orderNumber: '#1043', completed: false, distanceM: 620,  checklist: [{ id: 'c1', label: 'Klingel gedrückt', done: false }, { id: 'c2', label: 'Foto aufgenommen', done: false }] },
    { id: 's3', seq: 3, address: 'Sendlinger Straße 22, 80331 München',   addressShort: 'Sendlinger Str. 22', lat: 48.1340, lng: 11.5680, customerName: 'Peter Bauer',    phone: '+4917611223344', eta: '15:05', etaSeconds: 1800, amount: 18.90, orderNumber: '#1044', completed: false, distanceM: 2100, checklist: [{ id: 'c1', label: 'Klingel gedrückt', done: false }, { id: 'c2', label: 'Foto aufgenommen', done: false }] },
    { id: 's4', seq: 4, address: 'Maximilianstraße 8, 80538 München',     addressShort: 'Maximilianstr. 8',   lat: 48.1400, lng: 11.5900, customerName: 'Lisa Weber',     phone: '+4917655667788', eta: '15:22', etaSeconds: 2700, amount: 42.00, orderNumber: '#1045', completed: false, distanceM: 3800, checklist: [{ id: 'c1', label: 'Klingel gedrückt', done: false }, { id: 'c2', label: 'Foto aufgenommen', done: false }] },
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

function DistanzRing({ meters }: { meters: number }) {
  const r = 36, circ = 2 * Math.PI * r
  const max = 3000
  const pct = Math.max(0, Math.min(1, 1 - meters / max))
  const stroke = meters < 300 ? '#22c55e' : meters < 1000 ? '#eab308' : '#ef4444'
  const label = meters < 1000 ? `${meters}m` : `${(meters / 1000).toFixed(1)}km`
  return (
    <svg width="88" height="88" className="shrink-0">
      <circle cx="44" cy="44" r={r} fill="none" stroke="#27272a" strokeWidth="5" />
      <circle cx="44" cy="44" r={r} fill="none" stroke={stroke} strokeWidth="5"
        strokeDasharray={circ} strokeDashoffset={circ * (1 - pct)}
        strokeLinecap="round" transform="rotate(-90 44 44)" />
      <text x="44" y="40" textAnchor="middle" dominantBaseline="middle"
        fontSize="12" fontWeight="bold" fill={stroke}>{label}</text>
      <text x="44" y="56" textAnchor="middle" dominantBaseline="middle"
        fontSize="8" fill="#71717a">entfernt</text>
    </svg>
  )
}

export function FahrerPhase5505TourStopsNavHubV14({
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
  const [holding, setHolding] = useState<string | null>(null)
  const [holdProgress, setHoldProgress] = useState(0)
  const [expandedChecklist, setExpandedChecklist] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const r = await fetch(`/api/delivery/driver/tour-stops?driverId=${driverId}&locationId=${locationId ?? ''}`)
      if (!r.ok) throw new Error()
      const d = await r.json()
      setTour(d ?? MOCK_TOUR)
    } catch { setTour(MOCK_TOUR) }
  }, [driverId, locationId])

  useEffect(() => { load() }, [load])
  useEffect(() => { const id = setInterval(load, 30_000); return () => clearInterval(id) }, [load])
  useEffect(() => { const id = setInterval(() => setElapsed(e => e + 1), 1_000); return () => clearInterval(id) }, [])

  // Hold-to-confirm logic
  useEffect(() => {
    if (!holding) { setHoldProgress(0); return }
    const start = Date.now()
    const id = setInterval(() => {
      const pct = Math.min(1, (Date.now() - start) / 800)
      setHoldProgress(pct)
      if (pct >= 1) {
        clearInterval(id)
        setTour(prev => ({
          ...prev,
          stops: prev.stops.map(s => s.id === holding ? { ...s, completed: true } : s)
        }))
        setHolding(null)
        setHoldProgress(0)
      }
    }, 30)
    return () => clearInterval(id)
  }, [holding])

  const toggleCheck = (stopId: string, checkId: string) => {
    setTour(prev => ({
      ...prev,
      stops: prev.stops.map(s =>
        s.id === stopId
          ? { ...s, checklist: s.checklist.map(c => c.id === checkId ? { ...c, done: !c.done } : c) }
          : s
      )
    }))
  }

  const liveStops  = tour.stops.map(s => ({ ...s, etaSeconds: Math.max(0, s.etaSeconds - elapsed) }))
  const pending    = liveStops.filter(s => !s.completed)
  const current    = pending[0] ?? null
  const nextStops  = pending.slice(1)
  const completed  = liveStops.filter(s => s.completed).length
  const total      = liveStops.length
  const allChecked = current ? current.checklist.every(c => c.done) : false

  return (
    <div className={cn('bg-zinc-950 text-white min-h-screen p-4 space-y-4', className)}>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Bike className="h-5 w-5 text-blue-400" />
          <span className="font-semibold">Tour-Navigation V14</span>
        </div>
        <div className={cn('text-xs px-2 py-1 rounded-full border', TRAFFIC_STYLES[tour.traffic])}>
          {tour.traffic === 'leicht' ? '🟢' : tour.traffic === 'mittel' ? '🟡' : '🔴'} {tour.traffic}
        </div>
      </div>

      {/* Fortschritts-Balken */}
      <div className="space-y-1">
        <div className="flex justify-between text-xs text-zinc-400">
          <span>{completed}/{total} Stopps erledigt</span>
          <span>{Math.round((completed / Math.max(1, total)) * 100)}%</span>
        </div>
        <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
          <div className="h-full bg-blue-500 rounded-full transition-all"
            style={{ width: `${(completed / Math.max(1, total)) * 100}%` }} />
        </div>
      </div>

      {/* Aktueller Stopp */}
      {current && (
        <div className="bg-zinc-900 rounded-2xl p-4 ring-1 ring-blue-500/50 space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs bg-blue-500/20 text-blue-300 px-2 py-0.5 rounded-full">Nächster Stopp</span>
                <span className="text-xs text-zinc-500">{current.orderNumber}</span>
              </div>
              <h3 className="font-semibold text-base leading-tight">{current.customerName}</h3>
              <p className="text-xs text-zinc-400 mt-0.5 flex items-center gap-1">
                <MapPin className="h-3 w-3 shrink-0" />{current.addressShort}
              </p>
              <div className="flex items-center gap-3 mt-2">
                <span className="flex items-center gap-1 text-sm font-mono text-blue-300">
                  <Clock className="h-3.5 w-3.5" />{fmt(current.etaSeconds)}
                </span>
                <span className="text-sm font-semibold text-emerald-400">{current.amount.toFixed(2)}€</span>
              </div>
            </div>
            <DistanzRing meters={current.distanceM} />
          </div>

          {/* Navigations-Buttons */}
          <div className="grid grid-cols-2 gap-2">
            <a href={`https://maps.google.com/?q=${current.lat},${current.lng}`} target="_blank" rel="noreferrer"
              className="flex items-center justify-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium py-2.5 rounded-xl transition-colors">
              <Navigation className="h-4 w-4" /> Google Maps
            </a>
            <a href={`waze://?ll=${current.lat},${current.lng}&navigate=yes`}
              className="flex items-center justify-center gap-1.5 bg-sky-600 hover:bg-sky-700 text-white text-sm font-medium py-2.5 rounded-xl transition-colors">
              <Navigation className="h-4 w-4" /> Waze
            </a>
          </div>

          {/* Kontakt-Aktionen */}
          <div className="flex gap-2">
            <a href={`tel:${current.phone}`}
              className="flex-1 flex items-center justify-center gap-1.5 bg-zinc-800 hover:bg-zinc-700 text-white text-sm py-2 rounded-xl transition-colors">
              <Phone className="h-3.5 w-3.5 text-green-400" /> Anrufen
            </a>
            <a href={`https://wa.me/${current.phone.replace(/\D/g, '')}`} target="_blank" rel="noreferrer"
              className="flex-1 flex items-center justify-center gap-1.5 bg-zinc-800 hover:bg-zinc-700 text-white text-sm py-2 rounded-xl transition-colors">
              <MessageSquare className="h-3.5 w-3.5 text-emerald-400" /> WhatsApp
            </a>
          </div>

          {/* Übergabe-Checkliste */}
          <div className="border-t border-zinc-800 pt-3">
            <button className="w-full flex items-center justify-between text-xs text-zinc-400 mb-2"
              onClick={() => setExpandedChecklist(expandedChecklist === current.id ? null : current.id)}>
              <span className="flex items-center gap-1">
                <Package className="h-3.5 w-3.5" /> Übergabe-Checkliste
                {allChecked && <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 ml-1" />}
              </span>
              {expandedChecklist === current.id ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
            </button>
            {expandedChecklist === current.id && (
              <div className="space-y-2">
                {current.checklist.map(item => (
                  <button key={item.id} onClick={() => toggleCheck(current.id, item.id)}
                    className={cn('w-full flex items-center gap-2 p-2 rounded-lg text-sm transition-colors',
                      item.done ? 'bg-emerald-500/10 text-emerald-300' : 'bg-zinc-800 text-zinc-300')}>
                    <div className={cn('w-4 h-4 rounded-full border-2 shrink-0 flex items-center justify-center',
                      item.done ? 'border-emerald-400 bg-emerald-400' : 'border-zinc-600')}>
                      {item.done && <CheckCircle2 className="h-3 w-3 text-black" />}
                    </div>
                    {item.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Hold-to-Confirm CTA */}
          <div className="relative overflow-hidden rounded-xl">
            <button
              onMouseDown={() => setHolding(current.id)}
              onMouseUp={() => { if (holdProgress < 1) { setHolding(null); setHoldProgress(0) } }}
              onTouchStart={() => setHolding(current.id)}
              onTouchEnd={() => { if (holdProgress < 1) { setHolding(null); setHoldProgress(0) } }}
              className={cn('relative z-10 w-full py-3 rounded-xl font-semibold text-sm transition-colors select-none',
                allChecked ? 'bg-emerald-600 text-white' : 'bg-zinc-700 text-zinc-400 cursor-not-allowed')}
              disabled={!allChecked}>
              {holdProgress > 0 ? `Bestätige... ${Math.round(holdProgress * 100)}%` : '⬤ Halten zum Bestätigen'}
            </button>
            {holdProgress > 0 && (
              <div className="absolute inset-0 bg-emerald-500/30 rounded-xl transition-all"
                style={{ width: `${holdProgress * 100}%` }} />
            )}
          </div>
        </div>
      )}

      {/* Nächste Stopps */}
      {nextStops.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-xs text-zinc-500 uppercase tracking-wide">Nächste Stopps</h4>
          {nextStops.map(s => (
            <div key={s.id} className="flex items-center gap-3 bg-zinc-900 rounded-xl p-3">
              <div className="w-6 h-6 rounded-full bg-zinc-800 flex items-center justify-center text-xs text-zinc-400 shrink-0">
                {s.seq}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">{s.customerName}</div>
                <div className="text-xs text-zinc-500 truncate">{s.addressShort}</div>
              </div>
              <div className="text-right shrink-0">
                <div className="text-xs text-zinc-400">{s.eta}</div>
                <div className="text-xs text-zinc-500">{(s.distanceM / 1000).toFixed(1)}km</div>
              </div>
              <ChevronRight className="h-4 w-4 text-zinc-600 shrink-0" />
            </div>
          ))}
        </div>
      )}

      {pending.length === 0 && (
        <div className="flex flex-col items-center gap-2 py-8">
          <CheckCircle2 className="h-12 w-12 text-emerald-400" />
          <p className="font-semibold text-emerald-300">Tour abgeschlossen!</p>
          <p className="text-xs text-zinc-500">Alle {total} Stopps erledigt</p>
        </div>
      )}

      <p className="text-center text-xs text-zinc-700">30s-Polling · Phase 5505</p>
    </div>
  )
}
