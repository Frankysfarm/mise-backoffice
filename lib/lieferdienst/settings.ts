export interface Printer {
  id: string
  name: string
  type: 'receipt' | 'kitchen' | 'label'
  ipAddress: string
  port: number
  connected: boolean
  paperWidth: 58 | 80
  autoPrint: boolean
  printCopies: number
}

export interface SoundSettings {
  enabled: boolean
  newOrderVolume: number
  callCustomerVolume: number
  orderReadyVolume: number
  warningVolume: number
}

export interface DisplaySettings {
  autoHideDoneAfter: number // minutes, 0 = never
  showCompletedOrders: boolean
  gridColumns: 3 | 4 | 5 | 6
  sortBy: 'time' | 'priority' | 'type'
  darkMode: boolean
}

export interface NotificationSettings {
  browserNotifications: boolean
  urgentOrderThreshold: number // minutes
  callCustomerAfter: number // minutes
}

export interface StoreSettings {
  storeName: string
  storeAddress: string
  phoneNumber: string
  currency: string
  taxRate: number
  receiptFooter: string
}

export interface Settings {
  printers: Printer[]
  sound: SoundSettings
  display: DisplaySettings
  notifications: NotificationSettings
  store: StoreSettings
}

export const defaultSettings: Settings = {
  printers: [],
  sound: {
    enabled: true,
    newOrderVolume: 80,
    callCustomerVolume: 100,
    orderReadyVolume: 60,
    warningVolume: 70,
  },
  display: {
    autoHideDoneAfter: 5,
    showCompletedOrders: false,
    gridColumns: 4,
    sortBy: 'time',
    darkMode: false,
  },
  notifications: {
    browserNotifications: true,
    urgentOrderThreshold: 10,
    callCustomerAfter: 2,
  },
  store: {
    storeName: 'Mein Restaurant',
    storeAddress: 'Musterstraße 1, 12345 Berlin',
    phoneNumber: '+49 30 12345678',
    currency: 'EUR',
    taxRate: 19,
    receiptFooter: 'Vielen Dank für Ihren Besuch!',
  },
}

export const printerTypes = [
  { value: 'receipt', label: 'Kassenbon-Drucker' },
  { value: 'kitchen', label: 'Küchen-Drucker' },
  { value: 'label', label: 'Etiketten-Drucker' },
] as const

export const paperWidths = [
  { value: 58, label: '58mm' },
  { value: 80, label: '80mm' },
] as const
