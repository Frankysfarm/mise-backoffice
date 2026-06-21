// data.jsx — mock data for Drive food-delivery driver app
// Exports to window: DRIVER, INITIAL_ORDERS, makeRouteOrder
// Orders arrive ONE AT A TIME. Items are prepared dishes that the driver
// controls into the delivery bag (no warehouse picking / no barcodes).

const DRIVER = {
  name: 'Mehmet Yıldız',
  vehicle: 'E-Cargobike · B-DR 482',
  rating: 4.9,
  hub: 'Küche Prenzlauer Berg',
};

// kind drives the food thumbnail icon: 'food' | 'drink' | 'dessert'
const INITIAL_ORDERS = [
  {
    id: 'o1', code: 'A-4821', shortAddr: 'Kastanienallee 24',
    customer: 'Lena Brandt', phone: '+49 151 22 48 10',
    address: 'Kastanienallee 24, 10435 Berlin', floor: '3. OG · klingeln bei „Brandt“',
    eta: 6, distanceKm: 1.2, note: 'Bitte nicht beim Nachbarn abgeben.',
    items: [
      { id: 'i1', name: 'Pad Thai mit Hähnchen', kind: 'food', qty: 2, mods: ['extra scharf', 'ohne Erdnüsse'] },
      { id: 'i2', name: 'Sommerrollen', kind: 'food', qty: 1, sub: '4 Stück', mods: ['Erdnusssauce'] },
      { id: 'i3', name: 'Mango Lassi', kind: 'drink', qty: 1, sub: '0,4 L' },
    ],
  },
  {
    id: 'o2', code: 'A-4822', shortAddr: 'Oderberger Str. 8',
    customer: 'Jonas Keller', phone: '+49 160 77 03 55',
    address: 'Oderberger Str. 8, 10435 Berlin', floor: 'EG · Hinterhof links',
    eta: 9, distanceKm: 1.8, note: '',
    items: [
      { id: 'i4', name: 'Bibimbap mit Rind', kind: 'food', qty: 1, mods: ['Spiegelei', 'mittelscharf'] },
      { id: 'i5', name: 'Gyoza', kind: 'food', qty: 1, sub: '6 Stück' },
      { id: 'i6', name: 'Edamame', kind: 'food', qty: 1, mods: ['Meersalz'] },
      { id: 'i7', name: 'Ingwer-Limonade', kind: 'drink', qty: 1, sub: '0,33 L' },
    ],
  },
  {
    id: 'o3', code: 'A-4823', shortAddr: 'Schönhauser Allee 112',
    customer: 'Aylin Demir', phone: '+49 152 09 14 87',
    address: 'Schönhauser Allee 112, 10439 Berlin', floor: '1. OG · Aufzug vorhanden',
    eta: 12, distanceKm: 2.4, note: 'Code Haustür: 1407',
    items: [
      { id: 'i8', name: 'Falafel Bowl', kind: 'food', qty: 2, mods: ['ohne Knoblauch'] },
      { id: 'i9', name: 'Hummus mit Fladenbrot', kind: 'food', qty: 1 },
      { id: 'i10', name: 'Baklava', kind: 'dessert', qty: 1, sub: '3 Stück' },
    ],
  },
  {
    id: 'o4', code: 'A-4824', shortAddr: 'Eberswalder Str. 19',
    customer: 'Sefa Öztürk', phone: '+49 157 41 09 22',
    address: 'Eberswalder Str. 19, 10437 Berlin', floor: '2. OG · klingeln bei „Öztürk“',
    eta: 7, distanceKm: 1.5, note: '',
    items: [
      { id: 'i11', name: 'Chicken Teriyaki Bowl', kind: 'food', qty: 1, mods: ['extra Reis'] },
      { id: 'i12', name: 'Miso-Suppe', kind: 'food', qty: 1 },
      { id: 'i13', name: 'Grüner Tee', kind: 'drink', qty: 1, sub: '0,3 L' },
    ],
  },
];

// IDs that arrive before the route is computed vs. during the tour
const PRE_TOUR_IDS = ['o1', 'o2', 'o3'];
const LATE_IDS = ['o4'];

// optimised stop order returned by "system" after Route berechnen
function makeRouteOrder(orders) {
  // pretend the optimiser sorts by distance ascending
  return [...orders].sort((a, b) => a.distanceKm - b.distanceKm).map(o => o.id);
}

Object.assign(window, { DRIVER, INITIAL_ORDERS, makeRouteOrder, PRE_TOUR_IDS, LATE_IDS });
