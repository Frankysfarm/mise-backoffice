'use client'

import { MapPin, Phone, MessageCircle, CheckCircle, Banknote, Navigation } from 'lucide-react'
import { useDriver } from '@/lib/driver-app/driver-context'

export function DeliveryScreen() {
  const { acceptedOrders, currentDeliveryIndex, completeDelivery } = useDriver()
  
  const currentOrder = acceptedOrders[currentDeliveryIndex]
  if (!currentOrder) return null

  const isCash = currentOrder.paymentMethod === 'cash'
  const deliveredCount = acceptedOrders.filter(o => o.status === 'delivered').length

  const callCustomer = () => window.open(`tel:${currentOrder.customerPhone}`, '_self')
  const chatCustomer = () => window.open(`sms:${currentOrder.customerPhone}`, '_self')
  
  const openNavigation = () => {
    const url = `https://www.google.com/maps/dir/?api=1&destination=${currentOrder.customerLat},${currentOrder.customerLng}&travelmode=driving`
    window.open(url, '_blank')
  }

  return (
    <div className="flex flex-col min-h-screen bg-zinc-950">
      {/* Header with progress */}
      <div className="bg-zinc-900 px-4 py-4 border-b border-zinc-800">
        <div className="flex items-center justify-between mb-3">
          <span className="text-white font-semibold text-lg">
            Lieferung {currentDeliveryIndex + 1} von {acceptedOrders.length}
          </span>
          <span className="text-emerald-500 font-medium">
            {deliveredCount} erledigt
          </span>
        </div>
        <div className="flex gap-2">
          {acceptedOrders.map((order, index) => (
            <div 
              key={order.id}
              className={`flex-1 h-2 rounded-full ${
                order.status === 'delivered' 
                  ? 'bg-emerald-500' 
                  : index === currentDeliveryIndex 
                    ? 'bg-emerald-500 animate-pulse' 
                    : 'bg-zinc-700'
              }`}
            />
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 p-4 space-y-4 pb-36">
        {/* Cash indicator - visible but not blocking */}
        {isCash && (
          <div className="bg-amber-500/15 border border-amber-500/40 rounded-xl px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Banknote className="w-5 h-5 text-amber-500" />
              <span className="text-amber-500 font-semibold">Barzahlung</span>
            </div>
            <span className="text-amber-500 font-bold text-lg">{currentOrder.totalAmount.toFixed(2)}€</span>
          </div>
        )}

        {/* Customer info */}
        <div className="bg-zinc-900 rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <p className="text-white text-2xl font-bold">{currentOrder.customerName}</p>
            <span className="text-2xl font-bold text-white">{currentOrder.totalAmount.toFixed(2)}€</span>
          </div>
          
          <div className="flex items-start gap-3 mb-5 bg-zinc-800 rounded-xl p-4">
            <MapPin className="w-5 h-5 text-emerald-500 mt-0.5 flex-shrink-0" />
            <p className="text-white font-medium">{currentOrder.customerAddress}</p>
          </div>

          {/* Navigation button */}
          <button
            onClick={openNavigation}
            className="w-full h-14 rounded-xl bg-blue-600 text-white font-semibold flex items-center justify-center gap-3 mb-3"
          >
            <Navigation className="w-5 h-5" />
            Navigation öffnen
          </button>

          {/* Contact buttons */}
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={callCustomer}
              className="h-12 rounded-xl bg-zinc-800 text-white font-medium flex items-center justify-center gap-2"
            >
              <Phone className="w-5 h-5 text-emerald-500" />
              Anrufen
            </button>
            <button
              onClick={chatCustomer}
              className="h-12 rounded-xl bg-zinc-800 text-white font-medium flex items-center justify-center gap-2"
            >
              <MessageCircle className="w-5 h-5 text-emerald-500" />
              Nachricht
            </button>
          </div>
        </div>

        {/* Order details */}
        <div className="bg-zinc-900 rounded-2xl p-4">
          <p className="text-zinc-500 text-xs uppercase tracking-wider mb-3">
            {currentOrder.items.length} Artikel
          </p>
          <div className="space-y-2">
            {currentOrder.items.map((item) => (
              <div key={item.id} className="flex justify-between text-sm py-2 border-b border-zinc-800 last:border-0">
                <span className="text-white">{item.quantity}x {item.name}</span>
                <span className="text-zinc-400">{(item.price * item.quantity).toFixed(2)}€</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Complete button - fixed at bottom */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-zinc-950 border-t border-zinc-800">
        <button
          onClick={completeDelivery}
          className="w-full h-16 rounded-2xl bg-emerald-500 text-white font-bold text-lg flex items-center justify-center gap-3 active:bg-emerald-600"
        >
          <CheckCircle className="w-7 h-7" />
          Erfolgreich zugestellt
        </button>
      </div>
    </div>
  )
}
