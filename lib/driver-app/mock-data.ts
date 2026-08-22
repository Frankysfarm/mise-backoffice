import { Order, Driver } from './types'

export const mockDriver: Driver = {
  id: 'driver-1',
  name: 'Alex Müller',
  isOnline: false,
  vehicleType: 'car',
}

// Simulated incoming orders that will arrive one by one
export const simulatedIncomingOrders: Order[] = [
  {
    id: 'order-1',
    restaurantName: 'Bella Italia',
    restaurantAddress: 'Hauptstraße 123, Berlin',
    customerName: 'Sarah M.',
    customerAddress: 'Müllerstraße 45, Berlin',
    customerPhone: '+49 170 1234567',
    customerLat: 52.5321,
    customerLng: 13.3846,
    items: [
      { id: 'item-1-1', name: 'Pizza Margherita', quantity: 1, price: 12.90, checked: false },
      { id: 'item-1-2', name: 'Tiramisu', quantity: 2, price: 5.90, checked: false },
      { id: 'item-1-3', name: 'Cola 0.5L', quantity: 1, price: 2.90, checked: false },
    ],
    distance: '2.4 km',
    estimatedTime: '15 min',
    payout: 8.50,
    tip: 4.00,
    totalAmount: 27.60,
    paymentMethod: 'card',
    status: 'pending',
    createdAt: new Date(),
  },
  {
    id: 'order-2',
    restaurantName: 'Sushi Express',
    restaurantAddress: 'Friedrichstraße 89, Berlin',
    customerName: 'Michael K.',
    customerAddress: 'Alexanderplatz 12, Berlin',
    customerPhone: '+49 171 9876543',
    customerLat: 52.5219,
    customerLng: 13.4132,
    items: [
      { id: 'item-2-1', name: 'Sushi Set Deluxe (24 Stk)', quantity: 1, price: 34.90, checked: false },
      { id: 'item-2-2', name: 'Miso Suppe', quantity: 2, price: 4.50, checked: false },
      { id: 'item-2-3', name: 'Edamame', quantity: 1, price: 5.90, checked: false },
    ],
    distance: '1.8 km',
    estimatedTime: '12 min',
    payout: 7.25,
    tip: 5.00,
    totalAmount: 49.80,
    paymentMethod: 'cash',
    status: 'pending',
    createdAt: new Date(),
  },
  {
    id: 'order-3',
    restaurantName: 'Burger House',
    restaurantAddress: 'Kurfürstendamm 55, Berlin',
    customerName: 'Emma L.',
    customerAddress: 'Potsdamer Platz 8, Berlin',
    customerPhone: '+49 172 5555666',
    customerLat: 52.5096,
    customerLng: 13.3761,
    items: [
      { id: 'item-3-1', name: 'Double Cheeseburger', quantity: 2, price: 11.90, checked: false },
      { id: 'item-3-2', name: 'Große Pommes', quantity: 1, price: 4.50, checked: false },
      { id: 'item-3-3', name: 'Schoko Milkshake', quantity: 1, price: 5.90, checked: false },
      { id: 'item-3-4', name: 'Onion Rings', quantity: 1, price: 4.90, checked: false },
    ],
    distance: '3.1 km',
    estimatedTime: '18 min',
    payout: 11.00,
    tip: 3.50,
    totalAmount: 39.10,
    paymentMethod: 'cash',
    status: 'pending',
    createdAt: new Date(),
  },
]


