'use client'

import { useState } from 'react'
import { Truck, Power, Plus } from 'lucide-react'
import { useDriver } from '@/lib/driver-app/driver-context'
import { ExternalOrderModal } from './external-order-modal'

export function WaitingScreen() {
  const { driver, toggleOnline, simulateNewOrder } = useDriver()
  const [showExternalModal, setShowExternalModal] = useState(false)

  return (
    <div className="flex flex-col h-full bg-zinc-950">
      {/* Status */}
      <div className="flex-1 flex flex-col items-center justify-center p-6">
        <div className={`w-36 h-36 rounded-full flex items-center justify-center mb-8 transition-all duration-500 ${
          driver.isOnline 
            ? 'bg-emerald-500/20 border-4 border-emerald-500' 
            : 'bg-zinc-800 border-4 border-zinc-700'
        }`}>
          <Truck className={`w-16 h-16 transition-colors ${driver.isOnline ? 'text-emerald-500' : 'text-zinc-600'}`} />
        </div>
        
        <h2 className="text-2xl font-bold text-white mb-2">
          {driver.isOnline ? 'Warte auf Bestellungen' : 'Du bist offline'}
        </h2>
        <p className="text-zinc-500 text-center text-base">
          {driver.isOnline 
            ? 'Neue Bestellungen werden automatisch angezeigt' 
            : 'Gehe online um Bestellungen zu erhalten'
          }
        </p>

        {driver.isOnline && (
          <div className="mt-6 flex items-center gap-2">
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
            </span>
            <span className="text-emerald-500 text-sm font-medium">Aktiv</span>
          </div>
        )}
      </div>

      {/* Bottom actions */}
      <div className="p-6 space-y-4 pb-8">
        <button
          onClick={toggleOnline}
          className={`w-full h-16 rounded-2xl font-bold text-lg flex items-center justify-center gap-3 transition-all ${
            driver.isOnline
              ? 'bg-zinc-800 text-red-400 border border-zinc-700'
              : 'bg-emerald-500 text-white'
          }`}
        >
          <Power className="w-6 h-6" />
          {driver.isOnline ? 'Offline gehen' : 'Online gehen'}
        </button>

        {driver.isOnline && (
          <button
            onClick={() => {
              simulateNewOrder()
              setTimeout(() => simulateNewOrder(), 100)
              setTimeout(() => simulateNewOrder(), 200)
              setTimeout(() => simulateNewOrder(), 300)
            }}
            className="w-full h-12 rounded-xl text-sm bg-zinc-900 text-zinc-500 border border-zinc-800"
          >
            Demo: 4 Bestellungen simulieren
          </button>
        )}

        {driver.isOnline && (
          <button
            onClick={() => setShowExternalModal(true)}
            className="w-full h-12 rounded-xl text-sm bg-zinc-800 text-emerald-500 border border-emerald-500/30 flex items-center justify-center gap-2"
          >
            <Plus className="w-5 h-5" />
            Externe Bestellung (Uber, etc.)
          </button>
        )}
      </div>

      {/* External order modal */}
      <ExternalOrderModal 
        isOpen={showExternalModal} 
        onClose={() => setShowExternalModal(false)} 
      />
    </div>
  )
}
