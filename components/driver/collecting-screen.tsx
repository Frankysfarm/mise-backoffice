'use client'

import { useState } from 'react'
import { Package, MapPin, Euro, Banknote, Phone, MessageCircle, Plus } from 'lucide-react'
import { useDriver } from '@/lib/driver-app/driver-context'
import { ExternalOrderModal } from './external-order-modal'

export function CollectingScreen() {
  const { collectedOrders, startCollecting, simulateNewOrder } = useDriver()
  const [showExternalModal, setShowExternalModal] = useState(false)

  const totalAmount = collectedOrders.reduce((sum, order) => sum + order.totalAmount, 0)
  const cashOrders = collectedOrders.filter(order => order.paymentMethod === 'cash')
  const totalCash = cashOrders.reduce((sum, order) => sum + order.totalAmount, 0)

  return (
    <div className="flex flex-col h-full bg-zinc-950">
      {/* Header */}
      <div className="p-6 border-b border-zinc-800">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">Gesammelte Bestellungen</h1>
            <p className="text-zinc-500 mt-1">{collectedOrders.length} Bestellung{collectedOrders.length !== 1 ? 'en' : ''} bereit</p>
          </div>
          <button
            onClick={() => setShowExternalModal(true)}
            className="w-12 h-12 bg-emerald-500 rounded-xl flex items-center justify-center"
          >
            <Plus className="w-6 h-6 text-white" />
          </button>
        </div>
      </div>

      {/* Orders list */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {collectedOrders.map((order, index) => (
          <div 
            key={order.id}
            className={`rounded-2xl p-4 ${
              order.paymentMethod === 'cash' 
                ? 'bg-amber-500/10 border-2 border-amber-500/50' 
                : 'bg-zinc-900 border border-zinc-800'
            }`}
          >
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                  order.paymentMethod === 'cash' ? 'bg-amber-500 text-black' : 'bg-emerald-500 text-white'
                }`}>
                  {index + 1}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-white">{order.customerName}</p>
                    {order.isExternal && (
                      <span className="px-2 py-0.5 bg-zinc-700 text-zinc-300 text-xs rounded-full">
                        {order.externalPlatform?.toUpperCase()}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-zinc-500">{order.items.length} Artikel</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-lg font-bold text-white">{order.totalAmount.toFixed(2)}EUR</p>
                {order.paymentMethod === 'cash' && (
                  <div className="flex items-center gap-1 text-amber-500 text-sm font-medium">
                    <Banknote className="w-4 h-4" />
                    BAR
                  </div>
                )}
              </div>
            </div>
            
            <div className="flex items-center gap-2 text-zinc-400 text-sm mb-3">
              <MapPin className="w-4 h-4" />
              <span className="truncate">{order.customerAddress}</span>
            </div>
            
            {/* Contact buttons */}
            <div className="flex gap-2">
              <button
                onClick={() => window.open(`tel:${order.customerPhone}`, '_self')}
                className="flex-1 h-9 rounded-lg bg-zinc-800 text-white text-sm font-medium flex items-center justify-center gap-2"
              >
                <Phone className="w-4 h-4 text-emerald-500" />
                Anrufen
              </button>
              <button
                onClick={() => window.open(`sms:${order.customerPhone}`, '_self')}
                className="flex-1 h-9 rounded-lg bg-zinc-800 text-white text-sm font-medium flex items-center justify-center gap-2"
              >
                <MessageCircle className="w-4 h-4 text-emerald-500" />
                Chat
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Cash info - subtle but visible */}
      {cashOrders.length > 0 && (
        <div className="mx-4 px-4 py-3 bg-amber-500/10 border border-amber-500/30 rounded-xl flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Banknote className="w-5 h-5 text-amber-500" />
            <span className="text-amber-500 font-medium text-sm">
              {cashOrders.length}x Bar
            </span>
          </div>
          <span className="text-amber-500 font-bold">{totalCash.toFixed(2)}€</span>
        </div>
      )}

      {/* Summary & Actions */}
      <div className="p-4 space-y-3 border-t border-zinc-800 pb-8">
        <div className="flex items-center justify-between p-4 bg-zinc-900 rounded-2xl">
          <div className="flex items-center gap-3">
            <Package className="w-6 h-6 text-emerald-500" />
            <span className="text-white font-medium">Gesamt</span>
          </div>
          <div className="flex items-center gap-2">
            <Euro className="w-5 h-5 text-emerald-500" />
            <span className="text-2xl font-bold text-white">{totalAmount.toFixed(2)}</span>
          </div>
        </div>

        <button
          onClick={startCollecting}
          className="w-full h-16 bg-emerald-500 hover:bg-emerald-600 text-white text-xl font-bold rounded-2xl transition-colors"
        >
          Bestellungen abholen
        </button>

        <button
          onClick={simulateNewOrder}
          className="w-full h-12 bg-zinc-900 text-zinc-500 text-sm rounded-xl border border-zinc-800"
        >
          Demo: Weitere Bestellung
        </button>
      </div>

      {/* External order modal */}
      <ExternalOrderModal 
        isOpen={showExternalModal} 
        onClose={() => setShowExternalModal(false)} 
      />
    </div>
  )
}
