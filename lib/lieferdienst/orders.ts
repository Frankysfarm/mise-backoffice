export type OrderStatus = 
  | 'pending'           // Neue Bestellung - muss angenommen werden
  | 'accepted'          // Angenommen - in Zubereitung
  | 'waiting_customer'  // Warten auf Kundenantwort (Artikel nicht verfügbar)
  | 'call_customer'     // Kunde anrufen (keine Antwort)
  | 'done'              // Fertig
  | 'rejected'          // Abgelehnt

export interface OrderItem {
  id: string
  name: string
  quantity: number
  notes?: string
  modifiers?: string[]
  category: 'main' | 'side' | 'drink' | 'dessert'
  unavailable?: boolean // Artikel nicht verfügbar
  allergies?: string[] // Allergene codes
}

export interface Order {
  id: string
  orderNumber: string
  table?: string
  type: 'dine_in' | 'takeaway' | 'delivery'
  items: OrderItem[]
  status: OrderStatus
  createdAt: Date | string
  acceptedAt?: Date | string // Wann wurde die Bestellung angenommen
  doneAt?: Date | string     // Wann wurde die Bestellung fertiggestellt
  customerName?: string
  customerPhone?: string
  priority?: 'normal' | 'rush' | 'vip' | 'express'
  estimatedTime?: number // Geschätzte Zubereitungszeit in Minuten
  rejectionReason?: string
  unavailableItems?: string[]
  waitingForCustomerSince?: Date
  processedBy?: string // Mitarbeiter ID
  totalAmount?: number // Gesamtbetrag in EUR (aus DB gesamtbetrag)
}

export const rejectionReasons = [
  'Küche geschlossen',
  'Zu viele Bestellungen',
  'Artikel nicht verfügbar',
  'Liefergebiet nicht erreichbar',
  'Technisches Problem',
  'Sonstiges',
]

export const cancellationReasons = [
  'Kunde nicht erreichbar',
  'Kunde hat abgesagt',
  'Wartezeit zu lang',
  'Zahlungsproblem',
  'Falsche Adresse',
  'Doppelte Bestellung',
  'Sonstiges',
]

export const prepTimes = [
  { value: 10, label: '10 Min' },
  { value: 15, label: '15 Min' },
  { value: 20, label: '20 Min' },
  { value: 30, label: '30 Min' },
  { value: 45, label: '45 Min' },
  { value: 60, label: '60 Min' },
]

// Zufällige Bestellungen generieren
const menuItems: { name: string; category: OrderItem['category'] }[] = [
  { name: 'Wiener Schnitzel', category: 'main' },
  { name: 'Tafelspitz', category: 'main' },
  { name: 'Rindsgulasch', category: 'main' },
  { name: 'Schweinebraten', category: 'main' },
  { name: 'Käsespätzle', category: 'main' },
  { name: 'Zwiebelrostbraten', category: 'main' },
  { name: 'Currywurst', category: 'main' },
  { name: 'Grillhendl', category: 'main' },
  { name: 'Backhendl', category: 'main' },
  { name: 'Leberkäs', category: 'main' },
  { name: 'Pommes Frites', category: 'side' },
  { name: 'Bratkartoffeln', category: 'side' },
  { name: 'Kartoffelknödel', category: 'side' },
  { name: 'Semmelknödel', category: 'side' },
  { name: 'Rotkraut', category: 'side' },
  { name: 'Beilagensalat', category: 'side' },
  { name: 'Krautsalat', category: 'side' },
  { name: 'Cola 0.5l', category: 'drink' },
  { name: 'Apfelschorle', category: 'drink' },
  { name: 'Weißbier 0.5l', category: 'drink' },
  { name: 'Radler 0.5l', category: 'drink' },
  { name: 'Mineralwasser', category: 'drink' },
  { name: 'Apfelstrudel', category: 'dessert' },
  { name: 'Kaiserschmarrn', category: 'dessert' },
  { name: 'Sachertorte', category: 'dessert' },
  { name: 'Germknödel', category: 'dessert' },
]

const modifiers = [
  'extra Käse', 'ohne Zwiebeln', 'scharf', 'Mayo', 'Ketchup', 
  'Essig-Öl', 'medium', 'well done', 'glutenfrei'
]

const notes = [
  'ohne Zitrone', 'Allergie: Nüsse', 'vegan wenn möglich', 
  'extra knusprig', 'Kind 5 Jahre', 'getrennt servieren'
]

const customerNames = [
  'Müller', 'Schmidt', 'Weber', 'Fischer', 'Meyer', 'Wagner', 
  'Becker', 'Schulz', 'Hoffmann', 'Koch', 'Richter', 'Klein'
]

const phoneNumbers = [
  '+43 660 1234567',
  '+43 664 9876543',
  '+43 676 5551234',
  '+43 680 4443333',
  '+43 699 2221111',
]

let orderCounter = 153

export function generateRandomOrder(): Order {
  const types: Order['type'][] = ['dine_in', 'takeaway', 'delivery']
  const type = types[Math.floor(Math.random() * types.length)]
  
  const itemCount = Math.floor(Math.random() * 4) + 1
  const items: OrderItem[] = []
  
  for (let i = 0; i < itemCount; i++) {
    const menuItem = menuItems[Math.floor(Math.random() * menuItems.length)]
    const hasModifier = Math.random() > 0.7
    const hasNotes = Math.random() > 0.85
    
    items.push({
      id: `${orderCounter}-${i}`,
      name: menuItem.name,
      quantity: Math.floor(Math.random() * 3) + 1,
      category: menuItem.category,
      modifiers: hasModifier ? [modifiers[Math.floor(Math.random() * modifiers.length)]] : undefined,
      notes: hasNotes ? notes[Math.floor(Math.random() * notes.length)] : undefined,
    })
  }

  const customerName = customerNames[Math.floor(Math.random() * customerNames.length)]
  const customerPhone = phoneNumbers[Math.floor(Math.random() * phoneNumbers.length)]

  const order: Order = {
    id: `order-${orderCounter}`,
    orderNumber: `#${String(orderCounter).padStart(4, '0')}`,
    type,
    items,
    status: 'pending',
    createdAt: new Date(),
    priority: Math.random() > 0.85 ? 'rush' : 'normal',
    customerName,
    customerPhone,
  }

  if (type === 'dine_in') {
    order.table = `T${String(Math.floor(Math.random() * 20) + 1).padStart(2, '0')}`
  }

  orderCounter++
  return order
}

// Initiale Mock-Bestellungen
export const mockOrders: Order[] = [
  {
    id: '1',
    orderNumber: '#0147',
    table: 'T04',
    type: 'dine_in',
    status: 'accepted',
    estimatedTime: 20,
    createdAt: new Date(Date.now() - 5 * 60 * 1000),
    customerName: 'Huber',
    customerPhone: '+43 660 1234567',
    items: [
      { id: '1a', name: 'Wiener Schnitzel', quantity: 2, notes: 'ohne Zitrone', category: 'main' },
      { id: '1b', name: 'Pommes Frites', quantity: 2, category: 'side' },
      { id: '1c', name: 'Beilagensalat', quantity: 1, modifiers: ['Essig-Öl'], category: 'side' },
    ]
  },
  {
    id: '2',
    orderNumber: '#0148',
    type: 'delivery',
    status: 'waiting_customer',
    createdAt: new Date(Date.now() - 8 * 60 * 1000),
    waitingForCustomerSince: new Date(Date.now() - 3 * 60 * 1000),
    customerName: 'Schmidt',
    customerPhone: '+43 664 9876543',
    unavailableItems: ['Tafelspitz'],
    items: [
      { id: '2a', name: 'Tafelspitz', quantity: 1, category: 'main', unavailable: true },
      { id: '2b', name: 'Rindsgulasch', quantity: 2, category: 'main' },
      { id: '2c', name: 'Semmelknödel', quantity: 3, category: 'side' },
    ]
  },
  {
    id: '3',
    orderNumber: '#0149',
    type: 'takeaway',
    status: 'accepted',
    estimatedTime: 15,
    createdAt: new Date(Date.now() - 12 * 60 * 1000),
    customerName: 'Müller',
    customerPhone: '+43 676 5551234',
    items: [
      { id: '3a', name: 'Käsespätzle', quantity: 1, modifiers: ['extra Käse'], category: 'main' },
      { id: '3b', name: 'Apfelstrudel', quantity: 2, category: 'dessert' },
    ]
  },
]
