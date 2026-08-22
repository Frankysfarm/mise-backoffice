export interface StaffMember {
  id: string
  name: string
  pin: string
  role: 'cook' | 'manager' | 'admin'
  station?: string
  active: boolean
}

export interface ShiftNote {
  id: string
  staffId: string
  staffName: string
  message: string
  createdAt: Date
  important: boolean
}

export const mockStaff: StaffMember[] = [
  { id: '1', name: 'Max Müller', pin: '1234', role: 'admin', active: true },
  { id: '2', name: 'Anna Schmidt', pin: '5678', role: 'manager', active: true },
  { id: '3', name: 'Tom Weber', pin: '9012', role: 'cook', station: 'grill', active: true },
  { id: '4', name: 'Lisa Fischer', pin: '3456', role: 'cook', station: 'salads', active: true },
  { id: '5', name: 'Jan Becker', pin: '7890', role: 'cook', station: 'drinks', active: true },
]

export const mockShiftNotes: ShiftNote[] = [
  {
    id: '1',
    staffId: '2',
    staffName: 'Anna Schmidt',
    message: 'Rindfleisch Lieferung kommt um 14:00 Uhr',
    createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
    important: true,
  },
  {
    id: '2',
    staffId: '1',
    staffName: 'Max Müller',
    message: 'Neue Kasse im Gastraum installiert',
    createdAt: new Date(Date.now() - 5 * 60 * 60 * 1000),
    important: false,
  },
]

export type Station = 'all' | 'grill' | 'salads' | 'drinks' | 'desserts'

export const stations: { value: Station; label: string; categories: string[] }[] = [
  { value: 'all', label: 'Alle Stationen', categories: ['main', 'side', 'drink', 'dessert'] },
  { value: 'grill', label: 'Grill', categories: ['main'] },
  { value: 'salads', label: 'Salate', categories: ['side'] },
  { value: 'drinks', label: 'Getränke', categories: ['drink'] },
  { value: 'desserts', label: 'Desserts', categories: ['dessert'] },
]
