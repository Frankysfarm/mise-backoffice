'use client'

import { useState } from 'react'
import { Driver, getDriverStatusText, getDriverStatusColor, getVehicleIcon } from '@/lib/lieferdienst/drivers'
import { 
  Truck, Phone, MapPin, Clock, ArrowLeft, Navigation, 
  User, Package, ChevronRight, X
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

interface DriverPanelProps {
  drivers: Driver[]
  onClose?: () => void
}

export function DriverPanel({ drivers, onClose }: DriverPanelProps) {
  const [selectedDriver, setSelectedDriver] = useState<Driver | null>(null)
  const [showMap, setShowMap] = useState(false)

  const activeDrivers = drivers.filter(d => d.status !== 'offline')
  const deliveringDrivers = drivers.filter(d => d.status === 'delivering')
  const returningDrivers = drivers.filter(d => d.status === 'returning')
  const availableDrivers = drivers.filter(d => d.status === 'available')

  const getEstimatedMinutes = (date?: Date) => {
    if (!date) return null
    const mins = Math.ceil((date.getTime() - Date.now()) / 60000)
    return mins > 0 ? mins : 0
  }

  return (
    <>
      <div className="bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden">
        {/* Header */}
        <div className="px-5 py-4 border-b border-stone-100 bg-gradient-to-r from-blue-500 to-blue-400">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
                <Truck className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-white">Fahrer</h2>
                <p className="text-sm text-white/80">{activeDrivers.length} aktiv</p>
              </div>
            </div>
            {onClose && (
              <button onClick={onClose} className="p-2 rounded-lg bg-white/20 text-white hover:bg-white/30">
                <X className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-3 divide-x divide-stone-100 border-b border-stone-100">
          <div className="px-4 py-3 text-center">
            <p className="text-2xl font-bold text-blue-600">{deliveringDrivers.length}</p>
            <p className="text-xs text-stone-500">Unterwegs</p>
          </div>
          <div className="px-4 py-3 text-center">
            <p className="text-2xl font-bold text-violet-600">{returningDrivers.length}</p>
            <p className="text-xs text-stone-500">Rückweg</p>
          </div>
          <div className="px-4 py-3 text-center">
            <p className="text-2xl font-bold text-emerald-600">{availableDrivers.length}</p>
            <p className="text-xs text-stone-500">Verfügbar</p>
          </div>
        </div>

        {/* Driver List */}
        <div className="divide-y divide-stone-100 max-h-[400px] overflow-y-auto">
          {drivers.filter(d => d.status !== 'offline').map(driver => {
            const statusColor = getDriverStatusColor(driver.status)
            const estMins = getEstimatedMinutes(driver.estimatedReturn)

            return (
              <button
                key={driver.id}
                onClick={() => setSelectedDriver(driver)}
                className="w-full px-4 py-3 flex items-center gap-3 hover:bg-stone-50 transition-colors text-left"
              >
                {/* Avatar */}
                <div className="relative">
                  <div className="w-11 h-11 rounded-full bg-stone-200 flex items-center justify-center text-lg">
                    {getVehicleIcon(driver.vehicleType)}
                  </div>
                  <span className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-white ${statusColor.dot}`} />
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-char truncate">{driver.name}</span>
                    {driver.queuedOrders > 0 && (
                      <span className="text-xs font-medium bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded">
                        +{driver.queuedOrders}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className={`text-xs font-medium ${statusColor.text}`}>
                      {getDriverStatusText(driver.status)}
                    </span>
                    {driver.currentOrderNumber && (
                      <span className="text-xs text-stone-500">
                        {driver.currentOrderNumber}
                      </span>
                    )}
                  </div>
                </div>

                {/* ETA */}
                {estMins !== null && driver.status !== 'available' && (
                  <div className="text-right">
                    <p className="text-sm font-bold text-char">{estMins} min</p>
                    <p className="text-xs text-stone-500">Rückkehr</p>
                  </div>
                )}

                <ChevronRight className="w-5 h-5 text-stone-400" />
              </button>
            )
          })}
        </div>

        {/* Offline Drivers */}
        {drivers.filter(d => d.status === 'offline').length > 0 && (
          <div className="px-4 py-3 bg-stone-50 border-t border-stone-100">
            <p className="text-xs font-medium text-stone-500 mb-2">
              Offline ({drivers.filter(d => d.status === 'offline').length})
            </p>
            <div className="flex flex-wrap gap-2">
              {drivers.filter(d => d.status === 'offline').map(driver => (
                <span key={driver.id} className="text-xs text-stone-400">
                  {driver.name}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Driver Detail Dialog */}
      <Dialog open={!!selectedDriver} onOpenChange={() => setSelectedDriver(null)}>
        <DialogContent className="bg-white border border-stone-200 rounded-2xl max-w-md p-0 overflow-hidden">
          {selectedDriver && (
            <>
              <div className={`px-6 py-5 ${
                selectedDriver.status === 'delivering' ? 'bg-gradient-to-r from-blue-500 to-blue-400' :
                selectedDriver.status === 'returning' ? 'bg-gradient-to-r from-violet-500 to-violet-400' :
                selectedDriver.status === 'picking_up' ? 'bg-gradient-to-r from-amber-500 to-amber-400' :
                'bg-gradient-to-r from-emerald-500 to-emerald-400'
              }`}>
                <DialogHeader>
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-full bg-white/20 flex items-center justify-center text-2xl">
                      {getVehicleIcon(selectedDriver.vehicleType)}
                    </div>
                    <div>
                      <DialogTitle className="text-xl font-bold text-white">
                        {selectedDriver.name}
                      </DialogTitle>
                      <p className="text-white/80 mt-1">
                        {getDriverStatusText(selectedDriver.status)}
                        {selectedDriver.currentOrderNumber && ` - ${selectedDriver.currentOrderNumber}`}
                      </p>
                    </div>
                  </div>
                </DialogHeader>
              </div>

              <div className="p-6 space-y-4">
                {/* Current Order */}
                {selectedDriver.currentOrderNumber && (
                  <div className="p-4 rounded-xl bg-stone-50 border border-stone-200">
                    <div className="flex items-center gap-2 text-sm font-medium text-stone-600 mb-2">
                      <Package className="w-4 h-4" />
                      Aktuelle Bestellung
                    </div>
                    <p className="text-lg font-bold text-char">{selectedDriver.currentOrderNumber}</p>
                    {selectedDriver.queuedOrders > 0 && (
                      <p className="text-sm text-amber-600 mt-1">
                        + {selectedDriver.queuedOrders} weitere Bestellung{selectedDriver.queuedOrders > 1 ? 'en' : ''}
                      </p>
                    )}
                  </div>
                )}

                {/* ETA */}
                {selectedDriver.estimatedReturn && selectedDriver.status !== 'available' && (
                  <div className="p-4 rounded-xl bg-violet-50 border border-violet-200">
                    <div className="flex items-center gap-2 text-sm font-medium text-violet-600 mb-2">
                      <Clock className="w-4 h-4" />
                      Geschätzte Rückkehr
                    </div>
                    <p className="text-lg font-bold text-violet-700">
                      In ca. {getEstimatedMinutes(selectedDriver.estimatedReturn)} Minuten
                    </p>
                  </div>
                )}

                {/* Location Map Placeholder */}
                {selectedDriver.location && (
                  <button
                    onClick={() => setShowMap(true)}
                    className="w-full p-4 rounded-xl bg-blue-50 border border-blue-200 hover:bg-blue-100 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-blue-700">
                        <MapPin className="w-5 h-5" />
                        <span className="font-medium">Live-Standort anzeigen</span>
                      </div>
                      <Navigation className="w-5 h-5 text-blue-500" />
                    </div>
                  </button>
                )}

                {/* Actions */}
                <div className="flex gap-3 pt-2">
                  <a
                    href={`tel:${selectedDriver.phone.replace(/\s/g, '')}`}
                    className="flex-1"
                  >
                    <Button className="w-full h-12 bg-emerald-500 hover:bg-emerald-600 text-white font-medium rounded-xl">
                      <Phone className="w-4 h-4 mr-2" />
                      Anrufen
                    </Button>
                  </a>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Map Dialog */}
      <Dialog open={showMap} onOpenChange={setShowMap}>
        <DialogContent className="bg-white border border-stone-200 rounded-2xl max-w-2xl p-0 overflow-hidden">
          <div className="px-6 py-4 border-b border-stone-200">
            <DialogTitle className="text-lg font-bold text-char flex items-center gap-2">
              <MapPin className="w-5 h-5 text-blue-500" />
              Live-Standort: {selectedDriver?.name}
            </DialogTitle>
          </div>
          <div className="h-[400px] bg-stone-100 flex items-center justify-center">
            <div className="text-center">
              <div className="w-16 h-16 rounded-full bg-blue-100 flex items-center justify-center mx-auto mb-4">
                <Navigation className="w-8 h-8 text-blue-500" />
              </div>
              <p className="text-stone-600 font-medium">Karte wird geladen...</p>
              <p className="text-sm text-stone-500 mt-1">
                Lat: {selectedDriver?.location?.lat.toFixed(4)}, 
                Lng: {selectedDriver?.location?.lng.toFixed(4)}
              </p>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
