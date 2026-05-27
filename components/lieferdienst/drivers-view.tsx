'use client'

import { useState } from 'react'
import { Driver } from '@/lib/lieferdienst/drivers'
import { 
  Car, Bike, MapPin, Phone, Clock, Package, 
  Navigation, ArrowLeft, User, CheckCircle, AlertCircle, Truck as TruckIcon
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

interface DriversViewProps {
  drivers: Driver[]
}

const getVehicleIcon = (type: Driver['vehicleType']) => {
  switch (type) {
    case 'bike': return Bike
    case 'scooter': return Bike
    case 'car': return Car
    default: return Car
  }
}

const statusLabels: Record<Driver['status'], string> = {
  available: 'Verfügbar',
  delivering: 'Unterwegs',
  returning: 'Rückweg',
  picking_up: 'Holt ab',
  offline: 'Offline',
}

const statusColors: Record<Driver['status'], string> = {
  available: 'bg-emerald-500',
  delivering: 'bg-blue-500',
  returning: 'bg-green-500',
  picking_up: 'bg-amber-500',
  offline: 'bg-stone-400',
}

// Helper to calculate minutes from Date
const getMinutesUntilReturn = (date: Date | undefined): number | null => {
  if (!date) return null
  const now = new Date()
  const diffMs = date.getTime() - now.getTime()
  return Math.max(1, Math.ceil(diffMs / 60000))
}

export function DriversView({ drivers }: DriversViewProps) {
  const [selectedDriver, setSelectedDriver] = useState<Driver | null>(null)

  const activeDrivers = drivers.filter(d => d.status !== 'offline')
  const availableDrivers = drivers.filter(d => d.status === 'available')
  const deliveringDrivers = drivers.filter(d => d.status === 'delivering')
  const returningDrivers = drivers.filter(d => d.status === 'returning')

  if (selectedDriver) {
    const VehicleIcon = getVehicleIcon(selectedDriver.vehicleType)
    const minutesUntilReturn = getMinutesUntilReturn(selectedDriver.estimatedReturn)
    
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <button
          onClick={() => setSelectedDriver(null)}
          className="flex items-center gap-2 text-stone-600 hover:text-char mb-6 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
          <span className="font-medium">Zurück zur Übersicht</span>
        </button>

        <div className="bg-white rounded-2xl border border-stone-200 overflow-hidden">
          {/* Driver Header */}
          <div className={`p-6 ${
            selectedDriver.status === 'returning' ? 'bg-gradient-to-r from-green-500 to-emerald-500' :
            selectedDriver.status === 'delivering' ? 'bg-gradient-to-r from-blue-500 to-indigo-500' :
            selectedDriver.status === 'available' ? 'bg-gradient-to-r from-emerald-500 to-teal-500' :
            'bg-gradient-to-r from-stone-400 to-stone-500'
          }`}>
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-full bg-white/20 flex items-center justify-center">
                <User className="w-8 h-8 text-white" />
              </div>
              <div className="flex-1">
                <h2 className="text-2xl font-bold text-white">{selectedDriver.name}</h2>
                <div className="flex items-center gap-3 mt-1">
                  <div className="flex items-center gap-1.5 text-white/80">
                    <VehicleIcon className="w-4 h-4" />
                    <span className="capitalize">{selectedDriver.vehicleType}</span>
                  </div>
                  <Badge className="bg-white/20 text-white border-0">
                    {statusLabels[selectedDriver.status]}
                  </Badge>
                </div>
              </div>
              <a
                href={`tel:${selectedDriver.phone}`}
                className="p-4 rounded-xl bg-white/20 hover:bg-white/30 transition-colors"
              >
                <Phone className="w-6 h-6 text-white" />
              </a>
            </div>
          </div>

          {/* Driver Details */}
          <div className="p-6 space-y-6">
            {/* Current Order */}
            {selectedDriver.currentOrderNumber && (
              <div className="bg-stone-50 rounded-xl p-4 border border-stone-200">
                <div className="flex items-center gap-2 mb-3">
                  <Package className="w-5 h-5 text-blue-500" />
                  <span className="font-semibold text-char">Aktuelle Lieferung</span>
                </div>
                <p className="text-lg font-bold text-char">{selectedDriver.currentOrderNumber}</p>
                {minutesUntilReturn && (
                  <div className="flex items-center gap-2 mt-2 text-stone-600">
                    <Clock className="w-4 h-4" />
                    <span>Zurück in ca. {minutesUntilReturn} Min</span>
                  </div>
                )}
              </div>
            )}

            {/* Pending Orders */}
            {selectedDriver.queuedOrders > 0 && (
              <div className="bg-amber-50 rounded-xl p-4 border border-amber-200">
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-5 h-5 text-amber-500" />
                  <span className="font-medium text-amber-800">
                    {selectedDriver.queuedOrders} weitere Bestellung{selectedDriver.queuedOrders > 1 ? 'en' : ''} wartend
                  </span>
                </div>
              </div>
            )}

            {/* Location Tracking (Placeholder) */}
            <div className="bg-stone-100 rounded-xl p-6 border border-stone-200">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <MapPin className="w-5 h-5 text-stone-500" />
                  <span className="font-semibold text-char">Live-Standort</span>
                </div>
                <Badge variant="outline" className="text-emerald-600 border-emerald-300">
                  GPS aktiv
                </Badge>
              </div>
              <div className="h-48 bg-stone-200 rounded-lg flex items-center justify-center">
                <div className="text-center">
                  <Navigation className="w-8 h-8 text-stone-400 mx-auto mb-2" />
                  <p className="text-stone-500 text-sm">Karten-Integration</p>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3">
              <Button
                asChild
                className="flex-1 h-12 bg-emerald-500 hover:bg-emerald-600"
              >
                <a href={`tel:${selectedDriver.phone}`}>
                  <Phone className="w-5 h-5 mr-2" />
                  Anrufen
                </a>
              </Button>
              <Button
                variant="outline"
                className="flex-1 h-12"
              >
                <Navigation className="w-5 h-5 mr-2" />
                Route anzeigen
              </Button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6">
      {/* Stats Header */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        <div className="bg-white rounded-xl p-5 border border-stone-200">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-emerald-100 flex items-center justify-center">
              <Car className="w-6 h-6 text-emerald-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-char">{activeDrivers.length}</p>
              <p className="text-sm text-stone-500">Aktive Fahrer</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl p-5 border border-stone-200">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-green-100 flex items-center justify-center">
              <CheckCircle className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-char">{availableDrivers.length}</p>
              <p className="text-sm text-stone-500">Verfügbar</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl p-5 border border-stone-200">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-blue-100 flex items-center justify-center">
              <TruckIcon className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-char">{deliveringDrivers.length}</p>
              <p className="text-sm text-stone-500">Unterwegs</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl p-5 border border-stone-200">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-green-100 flex items-center justify-center">
              <ArrowLeft className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-char">{returningDrivers.length}</p>
              <p className="text-sm text-stone-500">Rückweg</p>
            </div>
          </div>
        </div>
      </div>

      {/* Drivers Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {drivers.map(driver => {
          const VehicleIcon = getVehicleIcon(driver.vehicleType)
          const minutesUntilReturn = getMinutesUntilReturn(driver.estimatedReturn)
          
          return (
            <button
              key={driver.id}
              onClick={() => setSelectedDriver(driver)}
              className={`bg-white rounded-xl p-5 border border-stone-200 text-left hover:shadow-lg transition-all ${
                driver.status === 'offline' ? 'opacity-60' : ''
              }`}
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                    driver.status === 'returning' ? 'bg-green-100' :
                    driver.status === 'delivering' ? 'bg-blue-100' :
                    driver.status === 'available' ? 'bg-emerald-100' :
                    'bg-stone-100'
                  }`}>
                    <User className={`w-6 h-6 ${
                      driver.status === 'returning' ? 'text-green-600' :
                      driver.status === 'delivering' ? 'text-blue-600' :
                      driver.status === 'available' ? 'text-emerald-600' :
                      'text-stone-400'
                    }`} />
                  </div>
                  <div>
                    <h3 className="font-semibold text-char">{driver.name}</h3>
                    <div className="flex items-center gap-1.5 text-stone-500 text-sm">
                      <VehicleIcon className="w-3.5 h-3.5" />
                      <span className="capitalize">{driver.vehicleType}</span>
                    </div>
                  </div>
                </div>
                <div className={`w-3 h-3 rounded-full ${statusColors[driver.status]}`} />
              </div>

              <div className="flex items-center justify-between">
                <Badge variant="outline" className={`${
                  driver.status === 'returning' ? 'text-green-600 border-green-300 bg-green-50' :
                  driver.status === 'delivering' ? 'text-blue-600 border-blue-300 bg-blue-50' :
                  driver.status === 'available' ? 'text-emerald-600 border-emerald-300 bg-emerald-50' :
                  'text-stone-500 border-stone-300 bg-stone-50'
                }`}>
                  {statusLabels[driver.status]}
                </Badge>
                {minutesUntilReturn && driver.status !== 'available' && driver.status !== 'offline' && (
                  <span className="text-sm text-stone-500">
                    ~{minutesUntilReturn} Min
                  </span>
                )}
              </div>

              {driver.currentOrderNumber && (
                <div className="mt-3 pt-3 border-t border-stone-100">
                  <p className="text-sm text-stone-600">
                    <span className="font-medium">Bestellung:</span> {driver.currentOrderNumber}
                  </p>
                </div>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
