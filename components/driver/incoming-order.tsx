'use client'

import { useEffect, useRef } from 'react'
import { MapPin, Banknote } from 'lucide-react'
import { useDriver } from '@/lib/driver-app/driver-context'

export function IncomingOrder() {
  const { incomingOrder, acceptOrder, isRinging, pendingOrders, acceptedOrders } = useDriver()
  const audioRef = useRef<HTMLAudioElement | null>(null)

  // Klingeln und Vibrieren ohne aufhören bis angenommen
  useEffect(() => {
    if (!isRinging) return
    
    // Audio starten
    audioRef.current = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3')
    audioRef.current.loop = true
    audioRef.current.play().catch(() => {})
    
    // Vibration Pattern: 500ms an, 200ms aus - wiederholt sich
    let vibrationInterval: NodeJS.Timeout | null = null
    if (navigator.vibrate) {
      // Initiale Vibration
      navigator.vibrate([500, 200, 500, 200, 500])
      // Wiederhole alle 2.4 Sekunden
      vibrationInterval = setInterval(() => {
        navigator.vibrate([500, 200, 500, 200, 500])
      }, 2400)
    }
    
    return () => {
      if (audioRef.current) {
        audioRef.current.pause()
        audioRef.current = null
      }
      if (vibrationInterval) {
        clearInterval(vibrationInterval)
      }
      // Vibration stoppen
      if (navigator.vibrate) {
        navigator.vibrate(0)
      }
    }
  }, [isRinging])

  if (!incomingOrder) return null

  const isCash = incomingOrder.paymentMethod === 'cash'
  const orderNumber = acceptedOrders.length + 1
  const totalPending = (pendingOrders?.length ?? 0) + acceptedOrders.length + 1

  return (
    <div 
      className={`fixed inset-0 z-50 flex flex-col ${
        isCash ? 'bg-amber-500' : 'bg-emerald-500'
      }`}
    >
      {/* Pulsing animation overlay */}
      <div className={`absolute inset-0 ${isCash ? 'bg-amber-400' : 'bg-emerald-400'} animate-pulse opacity-30`} />
      
      {/* Content */}
      <div className="relative z-10 flex flex-col h-full p-6">
        {/* Header */}
        <div className="text-center pt-8 pb-6">
          <p className="text-white/80 text-lg font-medium mb-2">
            Bestellung {orderNumber} von {orderNumber + totalPending - 1}
          </p>
          <h1 className="text-4xl font-black text-white">NEUE BESTELLUNG</h1>
        </div>

        {/* Cash indicator - simple badge */}
        {isCash && (
          <div className="bg-white/20 rounded-xl px-4 py-2 mb-4 flex items-center justify-center gap-2">
            <Banknote className="w-5 h-5 text-white" />
            <span className="text-white font-bold">BAR: {incomingOrder.totalAmount.toFixed(2)}€</span>
          </div>
        )}

        {/* Order info card */}
        <div className="bg-white rounded-2xl p-5 flex-1 flex flex-col overflow-hidden">
          {/* Customer - Hauptfokus */}
          <div className="mb-4 pb-4 border-b border-zinc-200">
            <p className="text-zinc-500 text-xs font-semibold uppercase tracking-wider mb-1">Lieferung an</p>
            <div className="flex items-start gap-2">
              <MapPin className={`w-5 h-5 mt-0.5 flex-shrink-0 ${isCash ? 'text-amber-500' : 'text-emerald-500'}`} />
              <div>
                <p className="text-zinc-900 text-2xl font-bold">{incomingOrder.customerName}</p>
                <p className="text-zinc-600 text-base mt-1">{incomingOrder.customerAddress}</p>
              </div>
            </div>
          </div>

          {/* Order value */}
          <div className={`rounded-xl p-4 mb-4 ${isCash ? 'bg-amber-50 border-2 border-amber-200' : 'bg-emerald-50 border-2 border-emerald-200'}`}>
            <div className="flex items-center justify-between">
              <span className="text-zinc-700 font-semibold">Bestellwert</span>
              <span className={`text-3xl font-black ${isCash ? 'text-amber-600' : 'text-emerald-600'}`}>
                {incomingOrder.totalAmount.toFixed(2)}€
              </span>
            </div>
          </div>

          {/* Items */}
          <div className="flex-1 overflow-y-auto">
            <p className="text-zinc-500 text-xs font-semibold uppercase tracking-wider mb-2">
              {incomingOrder.items.length} Artikel
            </p>
            <div className="space-y-2">
              {incomingOrder.items.map((item) => (
                <div key={item.id} className="flex justify-between items-center py-2 border-b border-zinc-100">
                  <span className="text-zinc-800 font-medium">{item.quantity}x {item.name}</span>
                  <span className="text-zinc-500">{(item.price * item.quantity).toFixed(2)}€</span>
                </div>
              ))}
            </div>
          </div>

          {/* Distance & Time */}
          <div className="grid grid-cols-2 gap-3 mt-4 pt-4 border-t border-zinc-200">
            <div className="bg-zinc-100 rounded-xl p-3 text-center">
              <p className="text-zinc-900 text-lg font-bold">{incomingOrder.distance}</p>
              <p className="text-zinc-500 text-xs">Distanz</p>
            </div>
            <div className="bg-zinc-100 rounded-xl p-3 text-center">
              <p className="text-zinc-900 text-lg font-bold">{incomingOrder.estimatedTime}</p>
              <p className="text-zinc-500 text-xs">Zeit</p>
            </div>
          </div>
        </div>

        {/* Accept button */}
        <button
          onClick={acceptOrder}
          className="w-full h-20 mt-4 rounded-2xl font-black text-2xl flex items-center justify-center bg-white text-zinc-900 active:scale-95 transition-transform"
        >
          ANNEHMEN
        </button>
      </div>
    </div>
  )
}
