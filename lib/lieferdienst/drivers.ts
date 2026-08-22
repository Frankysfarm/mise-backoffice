export type DriverStatus = 
  | 'available'      // Verfügbar
  | 'picking_up'     // Holt Bestellung ab
  | 'delivering'     // Auf dem Weg zum Kunden
  | 'returning'      // Auf dem Rückweg
  | 'offline'        // Nicht aktiv

export interface DriverLocation {
  lat: number
  lng: number
  updatedAt: Date
}

export interface Driver {
  id: string
  name: string
  phone: string
  avatar?: string
  status: DriverStatus
  currentOrderId?: string
  currentOrderNumber?: string
  queuedOrders: number // Anzahl wartender Bestellungen
  location?: DriverLocation
  estimatedReturn?: Date // Geschätzte Rückkehr
  vehicleType: 'bike' | 'scooter' | 'car'
}

export interface DeliveryInfo {
  driverId: string
  driverName: string
  driverPhone: string
  status: 'assigned' | 'picking_up' | 'on_the_way' | 'delivered'
  assignedAt: Date
  pickedUpAt?: Date
  deliveredAt?: Date
  estimatedDelivery?: Date
}

// Mock Fahrer
export const mockDrivers: Driver[] = [
  {
    id: 'd1',
    name: 'Mehmet K.',
    phone: '+49 176 12345678',
    status: 'delivering',
    currentOrderId: 'ord-1',
    currentOrderNumber: '#1042',
    queuedOrders: 1,
    vehicleType: 'scooter',
    location: { lat: 52.5200, lng: 13.4050, updatedAt: new Date() },
    estimatedReturn: new Date(Date.now() + 8 * 60000),
  },
  {
    id: 'd2',
    name: 'Ali S.',
    phone: '+49 176 98765432',
    status: 'returning',
    currentOrderId: undefined,
    currentOrderNumber: undefined,
    queuedOrders: 0,
    vehicleType: 'bike',
    location: { lat: 52.5180, lng: 13.4100, updatedAt: new Date() },
    estimatedReturn: new Date(Date.now() + 3 * 60000),
  },
  {
    id: 'd3',
    name: 'Yusuf M.',
    phone: '+49 176 55566677',
    status: 'picking_up',
    currentOrderId: 'ord-2',
    currentOrderNumber: '#1043',
    queuedOrders: 2,
    vehicleType: 'car',
    location: { lat: 52.5210, lng: 13.4020, updatedAt: new Date() },
  },
  {
    id: 'd4',
    name: 'Emre T.',
    phone: '+49 176 11122233',
    status: 'available',
    queuedOrders: 0,
    vehicleType: 'scooter',
    location: { lat: 52.5195, lng: 13.4055, updatedAt: new Date() },
  },
  {
    id: 'd5',
    name: 'Kemal B.',
    phone: '+49 176 44455566',
    status: 'offline',
    queuedOrders: 0,
    vehicleType: 'bike',
  },
]

export function getDriverStatusText(status: DriverStatus): string {
  switch (status) {
    case 'available': return 'Verfügbar'
    case 'picking_up': return 'Holt ab'
    case 'delivering': return 'Unterwegs'
    case 'returning': return 'Auf Rückweg'
    case 'offline': return 'Offline'
  }
}

export function getDriverStatusColor(status: DriverStatus): { bg: string; text: string; dot: string } {
  switch (status) {
    case 'available': 
      return { bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-500' }
    case 'picking_up': 
      return { bg: 'bg-amber-50', text: 'text-amber-700', dot: 'bg-amber-500' }
    case 'delivering': 
      return { bg: 'bg-blue-50', text: 'text-blue-700', dot: 'bg-blue-500' }
    case 'returning': 
      return { bg: 'bg-violet-50', text: 'text-violet-700', dot: 'bg-violet-500' }
    case 'offline': 
      return { bg: 'bg-stone-100', text: 'text-stone-500', dot: 'bg-stone-400' }
  }
}

export function getVehicleIcon(type: Driver['vehicleType']): string {
  switch (type) {
    case 'bike': return '🚲'
    case 'scooter': return '🛵'
    case 'car': return '🚗'
  }
}
