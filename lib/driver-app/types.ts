export interface OrderItem {
  id: string
  name: string
  quantity: number
  price: number
  checked: boolean
}

export type ExternalPlatform = 'uber' | 'lieferando' | 'wolt' | 'flink' | 'other'

export interface Order {
  id: string
  restaurantName: string
  restaurantAddress: string
  customerName: string
  customerAddress: string
  customerPhone: string
  customerLat: number
  customerLng: number
  items: OrderItem[]
  distance: string
  estimatedTime: string
  payout: number
  tip: number
  totalAmount: number
  paymentMethod: 'card' | 'cash'
  status: 'pending' | 'accepted' | 'picked' | 'delivering' | 'delivered'
  createdAt: Date
  // External platform support
  isExternal?: boolean
  externalPlatform?: ExternalPlatform
  receiptImage?: string
}

export interface Driver {
  id: string
  name: string
  avatar?: string
  isOnline: boolean
  vehicleType: 'car' | 'bike' | 'scooter'
}

export type AppPhase = 'waiting' | 'incoming' | 'collecting' | 'picking' | 'delivering' | 'completed'
