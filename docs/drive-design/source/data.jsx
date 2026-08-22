// data.jsx — mock data for Drive driver app
// Exports to window: DRIVER, INITIAL_ORDERS, makeRouteOrder

const DRIVER = {
  name: 'Mehmet Yıldız',
  vehicle: 'E-Cargobike · B-DR 482',
  rating: 4.9,
  hub: 'Hub Prenzlauer Berg',
};

// item.loc = pick location in the dark store; temp = needs cold handling
const INITIAL_ORDERS = [
  {
    id: 'o1', code: 'A-4821', shortAddr: 'Kastanienallee 24',
    customer: 'Lena Brandt', phone: '+49 151 22 48 10',
    address: 'Kastanienallee 24, 10435 Berlin', floor: '3. OG · klingeln bei „Brandt“',
    eta: 6, distanceKm: 1.2, note: 'Bitte nicht beim Nachbarn abgeben.',
    items: [
      { id: 'i1', name: 'Bio Vollmilch 3,8%', sub: '1 L · Tetrapak', qty: 2, loc: 'Kühlung · K2', temp: true },
      { id: 'i2', name: 'Bananen', sub: 'Chiquita · lose', qty: 1, loc: 'Obst · O1', unit: '≈ 1 kg' },
      { id: 'i3', name: 'Barilla Spaghetti N.5', sub: '500 g', qty: 1, loc: 'Gang 3 · B' },
      { id: 'i4', name: 'San Pellegrino', sub: '6 × 1 L · Glas', qty: 1, loc: 'Getränke · G4' },
    ],
  },
  {
    id: 'o2', code: 'A-4822', shortAddr: 'Oderberger Str. 8',
    customer: 'Jonas Keller', phone: '+49 160 77 03 55',
    address: 'Oderberger Str. 8, 10435 Berlin', floor: 'EG · Hinterhof links',
    eta: 9, distanceKm: 1.8, note: '',
    items: [
      { id: 'i5', name: 'Eier Freiland', sub: '10 Stück · Größe M', qty: 1, loc: 'Kühlung · K1', temp: true },
      { id: 'i6', name: 'Roggenbrot geschnitten', sub: '750 g', qty: 1, loc: 'Backwaren · BW' },
      { id: 'i7', name: 'Gouda mittelalt', sub: 'am Stück · 400 g', qty: 1, loc: 'Kühlung · K3', temp: true },
      { id: 'i8', name: 'Tomaten Rispe', sub: 'lose', qty: 1, loc: 'Gemüse · GE2', unit: '≈ 500 g' },
      { id: 'i9', name: 'Olivenöl nativ extra', sub: '500 ml', qty: 1, loc: 'Gang 2 · A' },
    ],
  },
  {
    id: 'o3', code: 'A-4823', shortAddr: 'Schönhauser Allee 112',
    customer: 'Aylin Demir', phone: '+49 152 09 14 87',
    address: 'Schönhauser Allee 112, 10439 Berlin', floor: '1. OG · Aufzug vorhanden',
    eta: 12, distanceKm: 2.4, note: 'Code Haustür: 1407',
    items: [
      { id: 'i10', name: 'Coca-Cola Zero', sub: '6 × 0,33 L · Dose', qty: 2, loc: 'Getränke · G2' },
      { id: 'i11', name: 'Tiefkühl-Pizza Margherita', sub: '2 Stück', qty: 1, loc: 'TK · TK1', temp: true },
      { id: 'i12', name: 'Haribo Goldbären', sub: '200 g', qty: 3, loc: 'Süßes · S1' },
    ],
  },
];

// optimised stop order returned by "system" after Tour starten
function makeRouteOrder(orders) {
  // pretend the optimiser sorts by distance ascending
  return [...orders].sort((a, b) => a.distanceKm - b.distanceKm).map(o => o.id);
}

Object.assign(window, { DRIVER, INITIAL_ORDERS, makeRouteOrder });
