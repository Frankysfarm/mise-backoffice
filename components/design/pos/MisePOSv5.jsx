'use client';

// === DATA-OVERRIDE: erlaubt Server-Side-Injection echter DB-Daten ===
// Set globalThis.MISE_POS_DATA in <script> BEFORE this module loads
// Fields: areas, roomLayout, categories, products, bestsellerIds, soldOut
const _override = (typeof globalThis !== 'undefined' && globalThis.MISE_POS_DATA) || null;

import React, { useState, useEffect } from 'react';
import {
  Settings, Printer, CreditCard, Shield, Clock, Plus, Minus,
  Trash2, Split, Receipt, X, Check, ChevronLeft, ChevronRight,
  Search, Coffee, Wine, IceCream, Pizza, Banknote,
  ArrowLeft, Users, Wifi, WifiOff, Salad, Beef,
  MapPin, FileText, Hash, ChefHat, Sparkles, Building2,
  Languages, ShoppingBag, Store, Home, Bell, Zap,
  Mail, Smartphone, Loader, AlertCircle, RotateCw, QrCode, 
  CheckCircle2, XCircle, Calendar, TrendingUp, Star, ArrowUpDown, Wallet,
  Gift, Percent, Ticket, ScanLine, Tag, Trash, Edit3, Copy
} from 'lucide-react';

// ============ DESIGN TOKENS ============
const T = {
  bg: '#0F0E0D',
  surface: '#171614',
  surfaceHi: '#1F1D1A',
  surfaceTop: '#0A0908',
  border: '#2A2724',
  borderHi: '#3A3631',
  text: '#F2EDE3',
  textMute: '#8E8579',
  textDim: '#5C554C',
  action: '#E68A2C',
  actionHi: '#F09838',
  actionLo: '#C4731F',
  ok: '#7A8C4A',
  okBright: '#9CB05F',
  warn: '#D69638',
  err: '#B84A3A',
  errBright: '#D45B47',
  info: '#5B7A8C',
  cat: {
    starter: '#7A8C4A', main: '#C97448', pizza: '#D2691E', dessert: '#9B6B92',
    softdrink: '#7A8E99', beer: '#B89048', wine: '#8B3F4E', spirit: '#5C3A1F', coffee: '#4A3429',
  },
  cream: '#F2EDE3',
  creamMute: '#E8E0D0',
  actionTint: 'rgba(230, 138, 44, 0.12)',
  okTint: 'rgba(122, 140, 74, 0.15)',
  errTint: 'rgba(184, 74, 58, 0.15)',
};

const FONT = {
  ui: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", "Helvetica Neue", system-ui, sans-serif',
  body: '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Helvetica Neue", system-ui, sans-serif',
  mono: 'ui-monospace, "SF Mono", "JetBrains Mono", "Roboto Mono", Menlo, Consolas, monospace',
};

// ============ MOCK DATA ============

const AREAS = _override?.areas ?? [
  { id: 'innen', name: 'Innenraum' },
  { id: 'terrasse', name: 'Terrasse' },
  { id: 'bar', name: 'Bar' },
];

const ROOM_LAYOUT = _override?.roomLayout ?? {
  innen: [
    { id: 'T01', label: '1', x: 80, y: 90, w: 88, h: 88, shape: 'round', seats: 2 },
    { id: 'T02', label: '2', x: 220, y: 90, w: 120, h: 88, shape: 'square', seats: 4 },
    { id: 'T03', label: '3', x: 390, y: 90, w: 88, h: 88, shape: 'round', seats: 2 },
    { id: 'T04', label: '4', x: 530, y: 70, w: 180, h: 130, shape: 'banquet', seats: 6 },
    { id: 'T05', label: '5', x: 760, y: 90, w: 88, h: 88, shape: 'round', seats: 2 },
    { id: 'T06', label: '6', x: 80, y: 250, w: 120, h: 88, shape: 'square', seats: 4 },
    { id: 'T07', label: '7', x: 250, y: 250, w: 120, h: 88, shape: 'square', seats: 4 },
    { id: 'T08', label: '8', x: 420, y: 250, w: 120, h: 88, shape: 'square', seats: 4 },
    { id: 'T09', label: '9', x: 590, y: 250, w: 120, h: 88, shape: 'square', seats: 4 },
    { id: 'T10', label: '10', x: 760, y: 250, w: 88, h: 88, shape: 'round', seats: 2 },
    { id: 'T11', label: '11', x: 80, y: 400, w: 88, h: 88, shape: 'round', seats: 2 },
    { id: 'T12', label: '12', x: 220, y: 400, w: 120, h: 88, shape: 'square', seats: 4 },
    { id: 'T13', label: '13', x: 390, y: 400, w: 200, h: 88, shape: 'long', seats: 8 },
    { id: 'T14', label: '14', x: 640, y: 400, w: 200, h: 88, shape: 'long', seats: 8 },
  ],
  terrasse: [
    { id: 'TE1', label: 'T1', x: 100, y: 100, w: 100, h: 100, shape: 'round', seats: 4 },
    { id: 'TE2', label: 'T2', x: 260, y: 100, w: 100, h: 100, shape: 'round', seats: 4 },
    { id: 'TE3', label: 'T3', x: 420, y: 100, w: 100, h: 100, shape: 'round', seats: 4 },
    { id: 'TE4', label: 'T4', x: 580, y: 100, w: 100, h: 100, shape: 'round', seats: 4 },
    { id: 'TE5', label: 'T5', x: 100, y: 280, w: 160, h: 100, shape: 'banquet', seats: 6 },
    { id: 'TE6', label: 'T6', x: 320, y: 280, w: 160, h: 100, shape: 'banquet', seats: 6 },
    { id: 'TE7', label: 'T7', x: 540, y: 280, w: 160, h: 100, shape: 'banquet', seats: 6 },
    { id: 'TE8', label: 'T8', x: 350, y: 440, w: 220, h: 100, shape: 'long', seats: 8 },
  ],
  bar: [
    { id: 'B01', label: 'B1', x: 200, y: 200, w: 70, h: 70, shape: 'stool', seats: 1 },
    { id: 'B02', label: 'B2', x: 320, y: 200, w: 70, h: 70, shape: 'stool', seats: 1 },
    { id: 'B03', label: 'B3', x: 440, y: 200, w: 70, h: 70, shape: 'stool', seats: 1 },
    { id: 'B04', label: 'B4', x: 560, y: 200, w: 70, h: 70, shape: 'stool', seats: 1 },
    { id: 'B05', label: 'B5', x: 680, y: 200, w: 70, h: 70, shape: 'stool', seats: 1 },
  ],
};

const CATEGORIES = _override?.categories ?? [
  { id: 'bestseller', name: 'Top 8', icon: Star, color: '#E68A2C', taxRate: null, special: true },
  { id: 'vorspeisen', name: 'Vorspeisen', icon: Salad, color: T.cat.starter, taxRate: 7 },
  { id: 'hauptgaenge', name: 'Hauptgänge', icon: Beef, color: T.cat.main, taxRate: 7 },
  { id: 'pizza', name: 'Pizza', icon: Pizza, color: T.cat.pizza, taxRate: 7 },
  { id: 'desserts', name: 'Desserts', icon: IceCream, color: T.cat.dessert, taxRate: 7 },
  { id: 'softdrinks', name: 'Softdrinks', icon: Coffee, color: T.cat.softdrink, taxRate: 19 },
  { id: 'bier', name: 'Bier', icon: Wine, color: T.cat.beer, taxRate: 19 },
  { id: 'wein', name: 'Wein', icon: Wine, color: T.cat.wine, taxRate: 19 },
  { id: 'spirituosen', name: 'Spirituosen', icon: Wine, color: T.cat.spirit, taxRate: 19 },
  { id: 'kaffee', name: 'Kaffee', icon: Coffee, color: T.cat.coffee, taxRate: 19 },
];

const PRODUCTS = _override?.products ?? {
  vorspeisen: [
    { id: 'p1', name: 'Bruschetta', price: 890 },
    { id: 'p2', name: 'Caesar Salad', price: 1290, modGroups: [
      { name: 'Topping', required: false, options: [
        { name: 'mit Hähnchen', price: 350 }, { name: 'mit Lachs', price: 500 }, { name: 'mit Garnelen', price: 600 },
      ]},
    ]},
    { id: 'p3', name: 'Suppe des Tages', price: 690 },
    { id: 'p4', name: 'Burrata', price: 1490 },
    { id: 'p5', name: 'Carpaccio', price: 1690 },
    { id: 'p6', name: 'Antipasti', price: 1890 },
    { id: 'p7', name: 'Vitello Tonnato', price: 1690 },
    { id: 'p8', name: 'Caprese', price: 1190 },
  ],
  hauptgaenge: [
    { id: 'p10', name: 'Burger Mise', price: 1790, modGroups: [
      { name: 'Garstufe', required: true, options: [
        { name: 'rare', price: 0 }, { name: 'medium rare', price: 0 },
        { name: 'medium', price: 0 }, { name: 'medium well', price: 0 }, { name: 'durch', price: 0 },
      ]},
      { name: 'Extras', required: false, options: [
        { name: 'extra Käse', price: 150 }, { name: 'Bacon', price: 250 }, { name: 'ohne Zwiebeln', price: 0 },
      ]},
    ]},
    { id: 'p11', name: 'Côte de Boeuf 350g', price: 3800 },
    { id: 'p12', name: 'Pasta Vongole', price: 2200 },
    { id: 'p13', name: 'Risotto Pilze', price: 1950 },
    { id: 'p14', name: 'Wolfsbarsch', price: 2900 },
    { id: 'p15', name: 'Tagesgericht', price: 2400, featured: true },
    { id: 'p16', name: 'Confit Ente', price: 2600 },
    { id: 'p17', name: 'Beet & Burrata', price: 1600 },
  ],
  pizza: [
    { id: 'p20', name: 'Margherita', price: 990 },
    { id: 'p21', name: 'Salami', price: 1190 },
    { id: 'p22', name: 'Funghi', price: 1190 },
    { id: 'p23', name: 'Diavola', price: 1290 },
    { id: 'p24', name: 'Tonno', price: 1290 },
    { id: 'p25', name: 'Quattro Stagioni', price: 1390 },
    { id: 'p26', name: 'Mise Special', price: 1490, featured: true },
  ],
  desserts: [
    { id: 'p30', name: 'Tiramisu', price: 790 },
    { id: 'p31', name: 'Crème Brûlée', price: 790 },
    { id: 'p32', name: 'Eis 3 Kugeln', price: 690, modGroups: [
      { name: 'Sorten', required: true, options: [
        { name: 'Vanille', price: 0 }, { name: 'Schoko', price: 0 }, { name: 'Erdbeer', price: 0 },
        { name: 'Pistazie', price: 0 }, { name: 'Stracciatella', price: 0 },
      ]},
    ]},
    { id: 'p33', name: 'Käseteller', price: 1290 },
  ],
  softdrinks: [
    { id: 'p40', name: 'Wasser still 0,5', price: 350 },
    { id: 'p41', name: 'Wasser sprudel 0,5', price: 350 },
    { id: 'p44', name: 'Cola 0,3', price: 350 },
    { id: 'p45', name: 'Cola Zero 0,3', price: 350 },
    { id: 'p46', name: 'Fanta 0,3', price: 350 },
    { id: 'p47', name: 'Sprite 0,3', price: 350 },
    { id: 'p48', name: 'Apfelschorle 0,3', price: 350 },
    { id: 'p49', name: 'Tonic Water', price: 450 },
  ],
  bier: [
    { id: 'p60', name: 'Pils 0,3', price: 380 },
    { id: 'p61', name: 'Pils 0,5', price: 490 },
    { id: 'p62', name: 'Weizen 0,5', price: 510 },
    { id: 'p63', name: 'IPA 0,33', price: 590 },
    { id: 'p64', name: 'Radler 0,5', price: 490 },
    { id: 'p65', name: 'Alkoholfrei 0,5', price: 450 },
  ],
  wein: [
    { id: 'p70', name: 'Hauswein rot 0,2', price: 620 },
    { id: 'p71', name: 'Hauswein weiss 0,2', price: 620 },
    { id: 'p72', name: 'Riesling 0,2', price: 780 },
    { id: 'p74', name: 'Chianti 0,2', price: 820 },
    { id: 'p75', name: 'Prosecco 0,1', price: 590 },
  ],
  spirituosen: [
    { id: 'p80', name: 'Aperol Spritz', price: 890 },
    { id: 'p81', name: 'Gin Tonic', price: 1090, modGroups: [
      { name: 'Gin', required: true, options: [
        { name: 'Hendrick\'s', price: 0 }, { name: 'Bombay', price: 0 }, { name: 'Monkey 47', price: 200 },
      ]},
    ]},
    { id: 'p82', name: 'Negroni', price: 1090 },
    { id: 'p83', name: 'Whisky Sour', price: 1190 },
    { id: 'p84', name: 'Espresso Martini', price: 1190 },
  ],
  kaffee: [
    { id: 'p90', name: 'Espresso', price: 280 },
    { id: 'p91', name: 'Doppelter Espresso', price: 380 },
    { id: 'p92', name: 'Cappuccino', price: 380, modGroups: [
      { name: 'Milch', required: false, options: [
        { name: 'Hafermilch', price: 40 }, { name: 'Mandelmilch', price: 40 }, { name: 'Sojamilch', price: 40 },
      ]},
    ]},
    { id: 'p93', name: 'Latte Macchiato', price: 420 },
  ],
};

// Bestseller - automatisch befüllt mit den meistverkauften
const BESTSELLER_IDS = _override?.bestsellerIds ?? ['p10', 'p20', 'p60', 'p90', 'p80', 'p15', 'p44', 'p70'];
const getBestsellers = () => {
  const all = Object.values(PRODUCTS).flat();
  return BESTSELLER_IDS.map(id => all.find(p => p.id === id)).filter(Boolean);
};

const SOLD_OUT = _override?.soldOut ?? ['p14'];
const STORNO_REASONS = ['Falsche Eingabe', 'Gast unzufrieden', 'Küche überlastet', 'Falsche Tischzuordnung', 'Allergie nicht erwähnt', 'Sonstiges'];

// ============ COUPONS ============
const INITIAL_COUPONS = [
  {
    id: 'cp1', code: 'MISE-WELCOME-10', name: 'Willkommen-Rabatt',
    description: '10% auf gesamte Rechnung — für Neukunden',
    type: 'percentage', value: 10, minOrder: 0,
    validUntil: '2026-12-31', active: true,
    usageLimit: null, usageCount: 47, color: '#E68A2C',
  },
  {
    id: 'cp2', code: 'MISE-LUNCH-5', name: 'Lunch-Gutschein',
    description: '5 € Rabatt ab 25 € Bestellwert',
    type: 'fixed', value: 500, minOrder: 2500,
    validUntil: '2026-06-30', active: true,
    usageLimit: 500, usageCount: 124, color: '#C97448',
  },
  {
    id: 'cp3', code: 'MISE-ESPRESSO-FREE', name: 'Gratis Espresso',
    description: 'Espresso (2,80 €) gratis ab 15 € Bestellwert',
    type: 'free_product', productId: 'p90', minOrder: 1500,
    validUntil: '2026-12-31', active: true,
    usageLimit: null, usageCount: 312, color: '#4A3429',
  },
  {
    id: 'cp4', code: 'MISE-BIRTHDAY-15', name: 'Geburtstag',
    description: '15 % am Geburtstag des Stammgastes',
    type: 'percentage', value: 15, minOrder: 0,
    validUntil: '2026-12-31', active: true,
    usageLimit: null, usageCount: 19, color: '#9B6B92',
  },
  {
    id: 'cp5', code: 'MISE-PIZZA-3', name: 'Pizza-Aktion Dienstag',
    description: '3 € auf jede Pizza — nur dienstags',
    type: 'fixed', value: 300, minOrder: 0,
    validUntil: '2026-12-31', active: false,
    usageLimit: null, usageCount: 0, color: '#D2691E',
  },
];

const INITIAL_ORDERS = {
  T02: { guests: 4, items: [
    { id: 'i1', productId: 'p10', name: 'Burger Mise', price: 1790, qty: 3, mods: ['medium', 'extra Käse'], extra: 150, course: 'main', sent: true, seat: 1 },
    { id: 'i2', productId: 'p60', name: 'Pils 0,3', price: 380, qty: 2, mods: [], course: 'drinks', sent: true, seat: 0 },
  ], opened: '21:32', waiter: 'Tahar', state: 'active' },
  T04: { guests: 6, items: [
    { id: 'i4', productId: 'p11', name: 'Côte de Boeuf 350g', price: 3800, qty: 2, mods: ['medium rare'], course: 'main', sent: true, seat: 1 },
    { id: 'i5', productId: 'p70', name: 'Hauswein rot 0,2', price: 620, qty: 4, mods: [], course: 'drinks', sent: true, seat: 0 },
  ], opened: '20:47', waiter: 'Tahar', state: 'food-ready' },
  T08: { guests: 3, items: [
    { id: 'i9', productId: 'p20', name: 'Margherita', price: 990, qty: 1, mods: [], course: 'main', sent: true, seat: 1 },
    { id: 'i10', productId: 'p23', name: 'Diavola', price: 1290, qty: 2, mods: [], course: 'main', sent: true, seat: 2 },
  ], opened: '22:34', waiter: 'Anna', state: 'bill-requested' },
  TE2: { guests: 4, items: [
    { id: 'i11', productId: 'p80', name: 'Aperol Spritz', price: 890, qty: 4, mods: [], course: 'drinks', sent: true, seat: 0 },
  ], opened: '22:51', waiter: 'Anna', state: 'active' },
};

// ============ HELPERS ============

const formatEUR = (cents) => `${(cents / 100).toFixed(2).replace('.', ',')} €`;
const formatTime = () => {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};
const calcItemTotal = (item) => (item.price + (item.extra || 0)) * item.qty;
const calcOrderTotal = (items) => items.reduce((s, i) => s + calcItemTotal(i), 0);

const getProductCategory = (productId) => {
  for (const [cat, prods] of Object.entries(PRODUCTS)) {
    if (prods.some(p => p.id === productId)) return cat;
  }
  return null;
};

const findProduct = (productId) => {
  for (const prods of Object.values(PRODUCTS)) {
    const p = prods.find(p => p.id === productId);
    if (p) return p;
  }
  return null;
};

const calcCouponDiscount = (coupon, subtotal) => {
  if (!coupon) return 0;
  if (coupon.minOrder && subtotal < coupon.minOrder) return 0;
  if (coupon.type === 'percentage') return Math.round(subtotal * coupon.value / 100);
  if (coupon.type === 'fixed') return Math.min(coupon.value, subtotal);
  if (coupon.type === 'free_product') {
    const prod = findProduct(coupon.productId);
    return prod ? prod.price : 0;
  }
  return 0;
};

// ============ MAIN ============

export default function MisePOSv5() {
  const [mode, setMode] = useState('table');
  const [view, setView] = useState('tables');
  const [tableOrders, setTableOrders] = useState(INITIAL_ORDERS);
  const [activeArea, setActiveArea] = useState('innen');
  const [activeTableId, setActiveTableId] = useState(null);
  const [activeCategory, setActiveCategory] = useState('bestseller');
  const [showGuestModal, setShowGuestModal] = useState(false);
  const [pendingTableId, setPendingTableId] = useState(null);
  const [optionsProduct, setOptionsProduct] = useState(null);
  const [showStorno, setShowStorno] = useState(null);
  const [settingsTab, setSettingsTab] = useState('drucker');
  const [activeSeat, setActiveSeat] = useState(0);
  const [currentTime, setCurrentTime] = useState(formatTime());
  const [toast, setToast] = useState(null);
  const [search, setSearch] = useState('');
  const [tableSearch, setTableSearch] = useState('');

  // Counter state
  const [counterCart, setCounterCart] = useState([]);
  const [sendToKitchen, setSendToKitchen] = useState(true);
  const [defaultTakeaway, setDefaultTakeaway] = useState(false);
  const [nextPager, setNextPager] = useState(47);
  const [activePagers, setActivePagers] = useState([
    { num: 44, items: 2, status: 'preparing', time: '23:14' },
    { num: 45, items: 1, status: 'ready', time: '23:17' },
  ]);

  // PAYMENT FLOW STATE (the big new thing)
  const [paymentFlow, setPaymentFlow] = useState(null);
  // Shape: { stage, method, total, tip, items, context, errorReason, transactionId }

  // === COUPON STATE ===
  const [coupons, setCoupons] = useState(INITIAL_COUPONS);
  const [counterCoupon, setCounterCoupon] = useState(null);
  const [showScanner, setShowScanner] = useState(false);
  const [scannerContext, setScannerContext] = useState(null);
  const [editingCoupon, setEditingCoupon] = useState(null);
  const [showNewCoupon, setShowNewCoupon] = useState(false);

  useEffect(() => {
    const t = setInterval(() => setCurrentTime(formatTime()), 30000);
    return () => clearInterval(t);
  }, []);

  const showToast = (msg, type = 'ok') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 2200);
  };

  const switchMode = (newMode) => {
    if (newMode === mode) return;
    setMode(newMode);
    if (newMode === 'table') setView('tables');
    setSearch('');
  };

  // ============ COUPON HANDLERS ============
  const openScanner = (context) => {
    setScannerContext(context);
    setShowScanner(true);
  };

  const onCouponScanned = (couponCode) => {
    const coupon = coupons.find(c => c.code === couponCode);
    if (!coupon) { showToast('Coupon nicht gefunden', 'warn'); setShowScanner(false); return; }
    if (!coupon.active) { showToast('Coupon nicht aktiv', 'warn'); setShowScanner(false); return; }
    if (coupon.usageLimit && coupon.usageCount >= coupon.usageLimit) {
      showToast('Coupon-Limit erreicht', 'warn'); setShowScanner(false); return;
    }
    const ctx = scannerContext;
    const subtotal = ctx === 'table'
      ? calcOrderTotal(tableOrders[activeTableId]?.items || [])
      : calcOrderTotal(counterCart);
    if (coupon.minOrder && subtotal < coupon.minOrder) {
      showToast(`Mindestbestellwert ${formatEUR(coupon.minOrder)} nicht erreicht`, 'warn');
      setShowScanner(false); return;
    }
    if (ctx === 'table' && activeTableId) {
      setTableOrders(prev => ({ ...prev, [activeTableId]: { ...prev[activeTableId], coupon } }));
    } else {
      setCounterCoupon(coupon);
    }
    setShowScanner(false);
    showToast(`✓ Coupon "${coupon.name}" angewendet`, 'ok');
  };

  const removeCoupon = (context) => {
    if (context === 'table' && activeTableId) {
      setTableOrders(prev => ({ ...prev, [activeTableId]: { ...prev[activeTableId], coupon: null } }));
    } else {
      setCounterCoupon(null);
    }
    showToast('Coupon entfernt', 'warn');
  };

  // ============ COUNTER ============

  const handleProductClickCounter = (product) => {
    if (SOLD_OUT.includes(product.id)) { showToast('Ausverkauft', 'warn'); return; }
    if (product.modGroups && product.modGroups.length > 0) {
      setOptionsProduct({ ...product, _counter: true });
    } else {
      addToCounterCart(product, [], 0);
    }
  };

  const addToCounterCart = (product, mods = [], extra = 0) => {
    const cat = getProductCategory(product.id);
    const isFood = ['vorspeisen', 'hauptgaenge', 'pizza', 'desserts'].includes(cat);
    
    // Quick-add: wenn schon vorhanden und keine mods, qty erhöhen
    const existing = counterCart.find(i => 
      i.productId === product.id && 
      JSON.stringify(i.mods) === JSON.stringify(mods)
    );
    
    if (existing && mods.length === 0) {
      setCounterCart(prev => prev.map(i => 
        i.id === existing.id ? { ...i, qty: i.qty + 1 } : i
      ));
    } else {
      setCounterCart(prev => [...prev, {
        id: `c_${Date.now()}_${Math.random()}`,
        productId: product.id, name: product.name, price: product.price,
        qty: 1, mods, extra, isFood, takeaway: defaultTakeaway, category: cat,
      }]);
    }
    setOptionsProduct(null);
  };

  const changeCounterQty = (itemId, delta) => {
    setCounterCart(prev => prev.map(i => {
      if (i.id === itemId) {
        const newQty = i.qty + delta;
        return newQty <= 0 ? null : { ...i, qty: newQty };
      }
      return i;
    }).filter(Boolean));
  };

  const toggleItemTakeaway = (itemId) => {
    setCounterCart(prev => prev.map(i => i.id === itemId ? { ...i, takeaway: !i.takeaway } : i));
  };

  const removeCounterItem = (itemId) => {
    setCounterCart(prev => prev.filter(i => i.id !== itemId));
  };

  const markPagerReady = (num) => {
    setActivePagers(prev => prev.map(p => p.num === num ? { ...p, status: 'ready' } : p));
    showToast(`Pager #${num} bereit`, 'ok');
  };

  const removePager = (num) => {
    setActivePagers(prev => prev.filter(p => p.num !== num));
    showToast(`Pager #${num} ausgegeben`, 'ok');
  };

  // ============ TABLE ============

  const handleTableClick = (table) => {
    if (!tableOrders[table.id]) {
      setPendingTableId(table.id); setShowGuestModal(true);
    } else {
      setActiveTableId(table.id); setView('order'); setActiveSeat(0);
    }
  };

  const openTable = (guests) => {
    setTableOrders(prev => ({
      ...prev,
      [pendingTableId]: { guests, items: [], opened: formatTime(), waiter: 'Tahar', state: 'active', coupon: null },
    }));
    setActiveTableId(pendingTableId); setPendingTableId(null);
    setShowGuestModal(false); setView('order'); setActiveSeat(0);
  };

  const handleProductClickTable = (product) => {
    if (SOLD_OUT.includes(product.id)) { showToast('Ausverkauft', 'warn'); return; }
    if (product.modGroups && product.modGroups.length > 0) {
      setOptionsProduct(product);
    } else {
      addProductToTable(product);
    }
  };

  const addProductToTable = (product, mods = [], extra = 0) => {
    const cat = getProductCategory(product.id);
    const isDrink = ['softdrinks', 'bier', 'wein', 'spirituosen', 'kaffee'].includes(cat);
    setTableOrders(prev => ({
      ...prev,
      [activeTableId]: {
        ...prev[activeTableId],
        items: [...prev[activeTableId].items, {
          id: `i_${Date.now()}_${Math.random()}`,
          productId: product.id, name: product.name, price: product.price,
          qty: 1, mods, extra,
          course: isDrink ? 'drinks' : (cat === 'desserts' || cat === 'kaffee' ? 'dessert' : 'main'),
          sent: false, seat: activeSeat,
        }],
      },
    }));
    setOptionsProduct(null);
  };

  const changeQtyTable = (itemId, delta) => {
    setTableOrders(prev => {
      const ord = prev[activeTableId];
      const items = ord.items.map(i => {
        if (i.id === itemId) {
          const newQty = i.qty + delta;
          return newQty <= 0 ? null : { ...i, qty: newQty };
        }
        return i;
      }).filter(Boolean);
      return { ...prev, [activeTableId]: { ...ord, items } };
    });
  };

  const stornoItemTable = (itemId, reason) => {
    setTableOrders(prev => {
      const ord = prev[activeTableId];
      const items = ord.items.filter(i => i.id !== itemId);
      return { ...prev, [activeTableId]: { ...ord, items } };
    });
    setShowStorno(null);
    showToast(`Storno · ${reason}`, 'warn');
  };

  const sendTableToKitchen = () => {
    setTableOrders(prev => {
      const ord = prev[activeTableId];
      return { ...prev, [activeTableId]: { ...ord, items: ord.items.map(i => ({ ...i, sent: true })) } };
    });
    showToast('An Küche · ' + activeTableId, 'ok');
  };

  // ============ PAYMENT FLOW — the new big thing ============

  const startPayment = (context) => {
    const subtotal = context === 'table' ? calcOrderTotal(activeOrder.items) : calcOrderTotal(counterCart);
    const coupon = context === 'table' ? activeOrder?.coupon : counterCoupon;
    const discount = calcCouponDiscount(coupon, subtotal);
    setPaymentFlow({
      stage: 'select-method',
      context,
      subtotal,
      coupon,
      discount,
      total: subtotal - discount,
      tip: 0,
      items: context === 'table' ? activeOrder.items : counterCart,
      tableLabel: context === 'table' ? activeTable?.label : 'Counter',
      guests: context === 'table' ? activeOrder?.guests : 1,
    });
  };

  const onPaymentComplete = () => {
    const ctx = paymentFlow.context;
    // Coupon-Nutzung zählen
    if (paymentFlow.coupon) {
      setCoupons(prev => prev.map(c =>
        c.id === paymentFlow.coupon.id ? { ...c, usageCount: c.usageCount + 1 } : c
      ));
    }
    if (ctx === 'table') {
      setTableOrders(prev => {
        const next = { ...prev };
        delete next[activeTableId];
        return next;
      });
      setActiveTableId(null);
      setView('tables');
    } else {
      const hasFood = counterCart.some(i => i.isFood);
      if (sendToKitchen && hasFood) {
        setActivePagers(prev => [...prev, {
          num: nextPager,
          items: counterCart.filter(i => i.isFood).reduce((s, i) => s + i.qty, 0),
          status: 'preparing', time: formatTime(),
        }]);
        setNextPager(prev => prev + 1);
      }
      setCounterCart([]);
      setCounterCoupon(null);
      setDefaultTakeaway(false);
    }
    setPaymentFlow(null);
  };

  // ============ COMPUTED ============

  const activeOrder = activeTableId ? tableOrders[activeTableId] : null;
  const activeTable = activeTableId ? Object.values(ROOM_LAYOUT).flat().find(t => t.id === activeTableId) : null;
  const tableSubtotal = activeOrder ? calcOrderTotal(activeOrder.items) : 0;
  const tableDiscount = calcCouponDiscount(activeOrder?.coupon, tableSubtotal);
  const tableOrderTotal = tableSubtotal - tableDiscount;
  const counterSubtotal = calcOrderTotal(counterCart);
  const counterDiscount = calcCouponDiscount(counterCoupon, counterSubtotal);
  const counterTotal = counterSubtotal - counterDiscount;

  const counterTax = (() => {
    let net7 = 0, tax7 = 0, net19 = 0, tax19 = 0;
    counterCart.forEach(item => {
      const rate = item.isFood ? 7 : 19;
      const gross = calcItemTotal(item);
      const net = Math.round(gross / (1 + rate / 100));
      const tax = gross - net;
      if (rate === 7) { net7 += net; tax7 += tax; }
      else { net19 += net; tax19 += tax; }
    });
    return { net7, tax7, net19, tax19 };
  })();

  const productsToShow = activeCategory === 'bestseller'
    ? getBestsellers().filter(p => !search || p.name.toLowerCase().includes(search.toLowerCase()))
    : (PRODUCTS[activeCategory] || []).filter(p => !search || p.name.toLowerCase().includes(search.toLowerCase()));

  // ===== SETTINGS =====
  if (view === 'settings') {
    return (
      <Chrome toast={toast}>
        <TopBar mode={mode} onModeSwitch={switchMode} time={currentTime}
          showBack onBack={() => setView('tables')} backLabel="Zurück" />
        <div className="flex-1 flex overflow-hidden">
          <SettingsSidebar tab={settingsTab} onChange={setSettingsTab} />
          <div className="flex-1 overflow-y-auto p-12">
            {settingsTab === 'drucker' && <SettingsDrucker />}
            {settingsTab === 'sumup' && <SettingsSumUp />}
            {settingsTab === 'tse' && <SettingsTSE />}
            {settingsTab === 'tische' && <SettingsTische />}
            {settingsTab === 'modus' && <SettingsModus />}
            {settingsTab === 'belege' && <SettingsBelege />}
            {settingsTab === 'sprache' && <SettingsSprache />}
            {settingsTab === 'coupons' && (
              <SettingsCoupons coupons={coupons} setCoupons={setCoupons}
                editingCoupon={editingCoupon} setEditingCoupon={setEditingCoupon}
                showNewCoupon={showNewCoupon} setShowNewCoupon={setShowNewCoupon}
                onToast={showToast} />
            )}
          </div>
        </div>
      </Chrome>
    );
  }

  // ===== COUNTER MODE =====
  if (mode === 'counter') {
    return (
      <Chrome toast={toast}>
        <TopBar mode={mode} onModeSwitch={switchMode} time={currentTime}
          onSettings={() => setView('settings')} />

        <div className="flex items-center justify-between px-6 py-3.5 border-b" style={{ backgroundColor: T.surface, borderColor: T.border }}>
          <div className="flex items-center gap-3">
            <Eyebrow>Schnellverkauf</Eyebrow>
            <CounterToggle label="An Küche bonen" active={sendToKitchen} onChange={() => setSendToKitchen(!sendToKitchen)} icon={ChefHat} />
            <CounterToggle label={defaultTakeaway ? 'Standard: Mitnehmen' : 'Standard: Hier essen'}
              active={defaultTakeaway} onChange={() => setDefaultTakeaway(!defaultTakeaway)}
              icon={defaultTakeaway ? ShoppingBag : Home} />
          </div>

          <div className="flex items-center gap-3">
            <Eyebrow>In Bearbeitung</Eyebrow>
            {activePagers.length === 0 ? (
              <span style={{ color: T.textDim, fontFamily: FONT.body, fontSize: 13, fontStyle: 'italic' }}>keine</span>
            ) : (
              <div className="flex items-center gap-1.5">
                {activePagers.map(pager => (
                  <PagerChip key={pager.num} pager={pager} onReady={() => markPagerReady(pager.num)} onGiveOut={() => removePager(pager.num)} />
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="flex-1 flex overflow-hidden">
          <CategoryRail activeCategory={activeCategory} onChange={(c) => { setActiveCategory(c); setSearch(''); }} />

          <div className="flex-1 flex flex-col overflow-hidden">
            <SearchBar value={search} onChange={setSearch} />

            <div className="flex-1 overflow-y-auto p-6" style={{ backgroundColor: T.bg }}>
              {activeCategory === 'bestseller' && (
                <div style={{ marginBottom: 16, color: T.textMute, fontFamily: FONT.mono, fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase', fontWeight: 500 }}>
                  ★ Häufigste Produkte · automatisch nach 7-Tage-Trend
                </div>
              )}
              <div className="grid grid-cols-4 gap-3">
                {productsToShow.map(product => (
                  <ProductCard key={product.id} product={product}
                    onClick={() => handleProductClickCounter(product)}
                    isSoldOut={SOLD_OUT.includes(product.id)} />
                ))}
              </div>
            </div>
          </div>

          {/* Counter cart */}
          <div className="w-96 border-l flex flex-col" style={{ backgroundColor: T.surface, borderColor: T.border }}>
            <div className="px-5 py-4 border-b flex items-center justify-between" style={{ borderColor: T.border }}>
              <div>
                <div style={{ color: T.text, fontFamily: FONT.ui, fontSize: 22, fontWeight: 700, letterSpacing: '-0.02em' }}>
                  Verkauf
                </div>
                <div style={{ color: T.textMute, fontFamily: FONT.body, fontSize: 12, marginTop: 2 }}>
                  {counterCart.length} {counterCart.length === 1 ? 'Position' : 'Positionen'}
                  {counterCart.length > 0 && sendToKitchen && counterCart.some(i => i.isFood) && <> · Pager #{nextPager}</>}
                </div>
              </div>
              {counterCart.length > 0 && (
                <button onClick={() => setCounterCart([])} style={{
                  color: T.err, fontFamily: FONT.mono, fontSize: 10,
                  letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: 500,
                  padding: '4px 8px', background: 'none', border: 'none', cursor: 'pointer',
                }}>leeren</button>
              )}
            </div>

            <div className="flex-1 overflow-y-auto px-3 py-3">
              {counterCart.length === 0 ? (
                <div className="text-center py-16 px-4">
                  <div className="inline-flex w-12 h-12 rounded-full items-center justify-center mb-4" style={{ backgroundColor: T.actionTint }}>
                    <Zap size={20} style={{ color: T.action }} />
                  </div>
                  <div style={{
                    color: T.text, fontFamily: FONT.ui,
                    fontSize: 18, fontWeight: 600, letterSpacing: '-0.01em', marginBottom: 4,
                  }}>
                    Bereit für Verkauf
                  </div>
                  <div style={{ color: T.textMute, fontFamily: FONT.body, fontSize: 13, lineHeight: 1.5 }}>
                    Produkt antippen, um zu beginnen
                  </div>
                </div>
              ) : (
                <div className="space-y-1">
                  {counterCart.map(item => (
                    <CounterCartRow key={item.id} item={item}
                      onPlus={() => changeCounterQty(item.id, 1)}
                      onMinus={() => changeCounterQty(item.id, -1)}
                      onRemove={() => removeCounterItem(item.id)}
                      onToggleTakeaway={() => toggleItemTakeaway(item.id)} />
                  ))}
                </div>
              )}
            </div>

            {counterCart.length > 0 && (
              <div className="px-5 py-4 border-t" style={{ borderColor: T.border, backgroundColor: T.surfaceHi }}>
                <CouponSlot
                  coupon={counterCoupon}
                  onScan={() => openScanner('counter')}
                  onRemove={() => removeCoupon('counter')}
                  discount={counterDiscount}
                />
                <div className="space-y-1 mb-3">
                  <SummaryRow label="Netto 7% (Speisen)" value={formatEUR(counterTax.net7)} />
                  <SummaryRow label="MwSt 7%" value={formatEUR(counterTax.tax7)} />
                  <SummaryRow label="Netto 19% (Getränke)" value={formatEUR(counterTax.net19)} />
                  <SummaryRow label="MwSt 19%" value={formatEUR(counterTax.tax19)} />
                  {counterDiscount > 0 && (
                    <>
                      <SummaryRow label="Zwischensumme" value={formatEUR(counterSubtotal)} />
                      <div style={{ display: 'flex', justifyContent: 'space-between', color: T.action, fontFamily: FONT.mono, fontSize: 11, fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>
                        <span>Rabatt ({counterCoupon.name})</span>
                        <span>− {formatEUR(counterDiscount)}</span>
                      </div>
                    </>
                  )}
                </div>
                <div className="flex items-baseline justify-between pb-4 mb-4 border-b" style={{ borderColor: T.border }}>
                  <span style={{ color: T.text, fontFamily: FONT.ui, fontSize: 16, fontWeight: 600 }}>Summe</span>
                  <span style={{
                    color: T.text, fontFamily: FONT.mono, fontSize: 32, fontWeight: 500,
                    fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.02em',
                  }}>{formatEUR(counterTotal)}</span>
                </div>

                <button onClick={() => startPayment('counter')} style={{
                  width: '100%', padding: '16px',
                  backgroundColor: T.action, color: T.surfaceTop,
                  borderRadius: 10, border: 'none',
                  fontFamily: FONT.ui, fontSize: 16, fontWeight: 700, letterSpacing: '-0.01em',
                  cursor: 'pointer',
                  boxShadow: `0 0 0 1px ${T.action}, 0 8px 24px rgba(230, 138, 44, 0.25)`,
                }}>
                  Kassieren · {formatEUR(counterTotal)}
                </button>
                {sendToKitchen && counterCart.some(i => i.isFood) && (
                  <div className="flex items-center justify-center gap-2 mt-3" style={{
                    color: T.action, fontFamily: FONT.mono, fontSize: 10,
                    letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: 500,
                  }}>
                    <ChefHat size={11} /> Bon an Küche · Pager #{nextPager}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {optionsProduct && (
          <OptionsModal product={optionsProduct}
            onConfirm={(mods, extra) => optionsProduct._counter ? addToCounterCart(optionsProduct, mods, extra) : addProductToTable(optionsProduct, mods, extra)}
            onClose={() => setOptionsProduct(null)} />
        )}
        {showScanner && (
          <CouponScannerModal coupons={coupons} context={scannerContext}
            subtotal={scannerContext === 'counter' ? counterSubtotal : tableSubtotal}
            onScan={onCouponScanned} onClose={() => setShowScanner(false)} />
        )}
        {paymentFlow && (
          <PaymentFlow flow={paymentFlow} setFlow={setPaymentFlow} onComplete={onPaymentComplete}
            withPager={sendToKitchen && counterCart.some(i => i.isFood)} pagerNum={nextPager} />
        )}
      </Chrome>
    );
  }

  // ===== TABLES VIEW =====
  if (view === 'tables') {
    const filteredTables = ROOM_LAYOUT[activeArea].filter(t =>
      !tableSearch || t.label.toLowerCase().includes(tableSearch.toLowerCase()) || t.id.toLowerCase().includes(tableSearch.toLowerCase())
    );
    const totalToday = Object.values(tableOrders).reduce((s, o) => s + calcOrderTotal(o.items), 0) + 142080;
    const totalGuests = Object.values(tableOrders).reduce((s, o) => s + o.guests, 0) + 47;
    const occupied = Object.values(tableOrders).filter(o => o.items.length > 0).length;

    return (
      <Chrome toast={toast}>
        <TopBar mode={mode} onModeSwitch={switchMode} time={currentTime}
          onSettings={() => setView('settings')} />

        <div className="flex items-center justify-between px-8 py-4 border-b" style={{ backgroundColor: T.surface, borderColor: T.border }}>
          <div className="flex items-center gap-1">
            {AREAS.map(a => (
              <button key={a.id} onClick={() => setActiveArea(a.id)} style={{
                padding: '10px 18px', borderRadius: 8,
                backgroundColor: activeArea === a.id ? T.cream : 'transparent',
                color: activeArea === a.id ? T.surfaceTop : T.textMute,
                fontFamily: FONT.ui, fontSize: 14, fontWeight: 600, letterSpacing: '-0.01em',
                border: 'none', cursor: 'pointer', transition: 'all 0.15s',
              }}>
                {a.name}
                <span style={{
                  marginLeft: 8, fontSize: 12, opacity: 0.5,
                  fontFamily: FONT.mono, fontWeight: 500,
                }}>
                  {ROOM_LAYOUT[a.id].length}
                </span>
              </button>
            ))}
          </div>

          <div className="flex items-center gap-3">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: T.textMute }} />
              <input value={tableSearch} onChange={e => setTableSearch(e.target.value)}
                placeholder="Tisch suchen" style={{
                  paddingLeft: 36, paddingRight: 12, paddingTop: 8, paddingBottom: 8,
                  borderRadius: 8, outline: 'none',
                  backgroundColor: T.bg, border: `1px solid ${T.border}`,
                  color: T.text, fontFamily: FONT.body, fontSize: 13, width: 180,
                }} />
            </div>

            <div className="flex items-center gap-5 px-4 py-2 rounded-lg" style={{
              backgroundColor: T.bg, border: `1px solid ${T.border}`,
            }}>
              <Stat label="Heute" value={formatEUR(totalToday)} />
              <Divider />
              <Stat label="Gäste" value={totalGuests} />
              <Divider />
              <Stat label="Tische" value={`${occupied}/${ROOM_LAYOUT[activeArea].length}`} />
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-auto p-8" style={{ backgroundColor: T.bg }}>
          <div className="relative mx-auto" style={{
            width: 1000, height: 600, backgroundColor: T.surface,
            border: `1px solid ${T.border}`, borderRadius: 16,
            backgroundImage: `radial-gradient(circle, ${T.borderHi} 1px, transparent 1px)`,
            backgroundSize: '24px 24px',
          }}>
            {activeArea === 'bar' && (
              <div className="absolute" style={{
                left: 150, right: 150, top: 120, height: 30,
                backgroundColor: T.cat.spirit, borderRadius: 8, opacity: 0.3,
              }} />
            )}

            {filteredTables.map(table => {
              const order = tableOrders[table.id];
              return <TableCard key={table.id} table={table} order={order} onClick={() => handleTableClick(table)} />;
            })}

            <div className="absolute bottom-4 right-4 flex items-center gap-4 px-4 py-2.5 rounded-lg" style={{
              backgroundColor: T.surfaceHi, border: `1px solid ${T.border}`,
            }}>
              <LegendDot color={T.surface} border={T.borderHi} label="frei" />
              <LegendDot color={T.ok} label="aktiv" />
              <LegendDot color={T.action} label="essen fertig" pulse />
              <LegendDot color={T.err} label="rechnung" />
            </div>
          </div>
        </div>

        {showGuestModal && (
          <GuestModal tableId={pendingTableId} onConfirm={openTable}
            onClose={() => { setShowGuestModal(false); setPendingTableId(null); }} />
        )}
      </Chrome>
    );
  }

  // ===== ORDER VIEW =====
  return (
    <Chrome toast={toast}>
      <TopBar mode={mode} onModeSwitch={switchMode} time={currentTime}
        showBack onBack={() => { setView('tables'); setActiveTableId(null); }}
        backLabel="Tische" activeTable={activeTable} activeOrder={activeOrder} />

      <div className="flex-1 flex overflow-hidden">
        <CategoryRail activeCategory={activeCategory} onChange={(c) => { setActiveCategory(c); setSearch(''); }} />

        <div className="flex-1 flex flex-col overflow-hidden">
          <SearchBar value={search} onChange={setSearch} />

          <div className="flex-1 overflow-y-auto p-6" style={{ backgroundColor: T.bg }}>
            {activeCategory === 'bestseller' && (
              <div style={{ marginBottom: 16, color: T.textMute, fontFamily: FONT.mono, fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase', fontWeight: 500 }}>
                ★ Häufigste Produkte
              </div>
            )}
            <div className="grid grid-cols-4 gap-3">
              {productsToShow.map(product => (
                <ProductCard key={product.id} product={product}
                  onClick={() => handleProductClickTable(product)}
                  isSoldOut={SOLD_OUT.includes(product.id)} />
              ))}
            </div>
          </div>
        </div>

        <div className="w-96 border-l flex flex-col" style={{ backgroundColor: T.surface, borderColor: T.border }}>
          <div className="px-4 py-3 border-b flex items-center gap-1.5 overflow-x-auto" style={{ borderColor: T.border }}>
            <SeatTab label="Tisch" active={activeSeat === 0} onClick={() => setActiveSeat(0)} />
            {Array.from({ length: activeOrder?.guests || 0 }, (_, i) => i + 1).map(s => (
              <SeatTab key={s} label={`Platz ${s}`} active={activeSeat === s} onClick={() => setActiveSeat(s)} />
            ))}
          </div>

          <div className="flex-1 overflow-y-auto px-4 py-3">
            {activeOrder?.items.length === 0 ? (
              <div className="text-center py-16">
                <div style={{
                  color: T.text, fontFamily: FONT.ui,
                  fontSize: 18, fontWeight: 600, letterSpacing: '-0.01em', marginBottom: 4,
                }}>
                  Noch nichts bestellt
                </div>
                <div style={{ color: T.textMute, fontFamily: FONT.body, fontSize: 13 }}>
                  Wähle links eine Kategorie
                </div>
              </div>
            ) : (
              ['starter', 'main', 'dessert', 'drinks', 'after'].map(course => {
                const items = (activeOrder?.items || []).filter(i =>
                  i.course === course && (activeSeat === 0 || i.seat === activeSeat));
                if (items.length === 0) return null;
                const labels = { starter: 'Vorspeise', main: 'Hauptgang', dessert: 'Dessert', drinks: 'Getränke', after: 'Digestif' };
                return (
                  <div key={course} className="mb-4">
                    <div style={{
                      color: T.textDim, fontFamily: FONT.mono,
                      fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase',
                      fontWeight: 500, padding: '6px 0',
                      borderBottom: `1px solid ${T.border}`, marginBottom: 6,
                    }}>{labels[course]}</div>
                    {items.map(item => (
                      <OrderRow key={item.id} item={item}
                        onPlus={() => changeQtyTable(item.id, 1)}
                        onMinus={() => changeQtyTable(item.id, -1)}
                        onStorno={() => setShowStorno(item.id)} />
                    ))}
                  </div>
                );
              })
            )}
          </div>

          {activeOrder && activeOrder.items.length > 0 && (
            <div className="px-5 py-4 border-t" style={{ borderColor: T.border, backgroundColor: T.surfaceHi }}>
              <CouponSlot
                coupon={activeOrder.coupon}
                onScan={() => openScanner('table')}
                onRemove={() => removeCoupon('table')}
                discount={tableDiscount}
              />
              {tableDiscount > 0 && (
                <div style={{ marginBottom: 8 }}>
                  <SummaryRow label="Zwischensumme" value={formatEUR(tableSubtotal)} />
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: T.action, fontFamily: FONT.mono, fontSize: 11, fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>
                    <span>Rabatt ({activeOrder.coupon.name})</span>
                    <span>− {formatEUR(tableDiscount)}</span>
                  </div>
                </div>
              )}
              <div className="flex items-baseline justify-between pb-4 mb-4 border-b" style={{ borderColor: T.border }}>
                <span style={{ color: T.text, fontFamily: FONT.ui, fontSize: 16, fontWeight: 600 }}>Summe</span>
                <span style={{
                  color: T.text, fontFamily: FONT.mono, fontSize: 28, fontWeight: 500,
                  fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.02em',
                }}>{formatEUR(tableOrderTotal)}</span>
              </div>

              <button onClick={sendTableToKitchen} style={{
                width: '100%', padding: '14px',
                backgroundColor: 'transparent', color: T.text,
                border: `1.5px solid ${T.cream}`, borderRadius: 10,
                fontFamily: FONT.ui, fontSize: 14, fontWeight: 600, letterSpacing: '-0.01em',
                cursor: 'pointer', marginBottom: 8,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              }}>
                <ChefHat size={16} /> Bonieren
              </button>

              <button onClick={() => startPayment('table')} style={{
                width: '100%', padding: '16px',
                backgroundColor: T.action, color: T.surfaceTop,
                border: 'none', borderRadius: 10,
                fontFamily: FONT.ui, fontSize: 16, fontWeight: 700, letterSpacing: '-0.01em',
                cursor: 'pointer',
                boxShadow: `0 0 0 1px ${T.action}, 0 8px 24px rgba(230, 138, 44, 0.25)`,
              }}>
                Rechnung · {formatEUR(tableOrderTotal)}
              </button>
            </div>
          )}
        </div>
      </div>

      {optionsProduct && (
        <OptionsModal product={optionsProduct}
          onConfirm={(mods, extra) => addProductToTable(optionsProduct, mods, extra)}
          onClose={() => setOptionsProduct(null)} />
      )}
      {showStorno && (
        <StornoModal itemName={activeOrder?.items.find(i => i.id === showStorno)?.name}
          onConfirm={(reason) => stornoItemTable(showStorno, reason)}
          onClose={() => setShowStorno(null)} />
      )}
      {showScanner && (
        <CouponScannerModal coupons={coupons} context={scannerContext} subtotal={tableSubtotal}
          onScan={onCouponScanned} onClose={() => setShowScanner(false)} />
      )}
      {paymentFlow && (
        <PaymentFlow flow={paymentFlow} setFlow={setPaymentFlow} onComplete={onPaymentComplete} />
      )}
    </Chrome>
  );
}

// ============ THE NEW BIG ONE: PAYMENT FLOW ============

function PaymentFlow({ flow, setFlow, onComplete, withPager, pagerNum }) {
  const total = flow.total + (flow.tip || 0);

  return (
    <div style={{
      position: 'fixed', inset: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.85)', backdropFilter: 'blur(12px)',
      zIndex: 50,
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
    }}>
      <div style={{
        width: '100%', maxWidth: 640,
        backgroundColor: T.surface, border: `1px solid ${T.border}`,
        borderRadius: 16,
        boxShadow: '0 24px 64px rgba(0, 0, 0, 0.6)',
        maxHeight: '92vh', overflowY: 'auto',
      }}>
        {flow.stage === 'select-method' && (
          <MethodSelect flow={flow} setFlow={setFlow} />
        )}
        {flow.stage === 'cash-amount' && (
          <CashAmountScreen flow={flow} setFlow={setFlow} onComplete={onComplete} withPager={withPager} pagerNum={pagerNum} />
        )}
        {flow.stage === 'sumup-pairing' && (
          <SumUpFlow flow={flow} setFlow={setFlow} onComplete={onComplete} withPager={withPager} pagerNum={pagerNum} />
        )}
        {flow.stage === 'success' && (
          <SuccessScreen flow={flow} setFlow={setFlow} onComplete={onComplete} withPager={withPager} pagerNum={pagerNum} />
        )}
        {flow.stage === 'error' && (
          <ErrorScreen flow={flow} setFlow={setFlow} />
        )}
      </div>
    </div>
  );
}

// ===== METHOD SELECTION =====
function MethodSelect({ flow, setFlow }) {
  const [tipPct, setTipPct] = useState(0);
  const tip = Math.round(flow.total * tipPct / 100);
  const finalTotal = flow.total + tip;

  const selectMethod = (method) => {
    if (method === 'Bar') {
      setFlow({ ...flow, stage: 'cash-amount', method, tip });
    } else if (method === 'SumUp') {
      setFlow({ ...flow, stage: 'sumup-pairing', method, tip });
    }
  };

  return (
    <div style={{ padding: 32 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <Eyebrow>{flow.context === 'counter' ? 'Counter-Verkauf' : `Bezahlen · Tisch ${flow.tableLabel}`}</Eyebrow>
        <button onClick={() => setFlow(null)} style={{
          width: 32, height: 32, borderRadius: '50%',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          backgroundColor: T.surfaceHi, color: T.textMute,
          border: `1px solid ${T.border}`, cursor: 'pointer',
        }}><X size={16} /></button>
      </div>

      {flow.coupon && (
        <div style={{
          padding: '10px 14px', borderRadius: 8, marginBottom: 12,
          backgroundColor: T.actionTint, border: `1px solid ${T.action}`,
          display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <Ticket size={14} style={{ color: T.action }} />
          <span style={{ color: T.action, fontFamily: FONT.ui, fontSize: 12, fontWeight: 600 }}>
            {flow.coupon.name} · gespart {formatEUR(flow.discount)}
          </span>
        </div>
      )}

      <div style={{
        color: T.text, fontFamily: FONT.mono,
        fontSize: 64, fontWeight: 500, letterSpacing: '-0.03em',
        fontVariantNumeric: 'tabular-nums', marginTop: 8, marginBottom: 6, lineHeight: 1,
      }}>{formatEUR(finalTotal)}</div>
      <div style={{ color: T.textMute, fontFamily: FONT.body, fontSize: 13, marginBottom: 24 }}>
        {flow.context === 'counter' ? 'Schnellverkauf' : `${flow.guests} Gäste · ${formatEUR(Math.round(finalTotal / flow.guests))} pro Person`}
        {tip > 0 && ` · TG ${formatEUR(tip)}`}
      </div>

      <div style={{ marginBottom: 24 }}>
        <div style={{ marginBottom: 10 }}><Eyebrow>Trinkgeld</Eyebrow></div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 6 }}>
          {[0, 5, 10, 15, 20].map(p => (
            <button key={p} onClick={() => setTipPct(p)} style={{
              padding: '11px 0', borderRadius: 8,
              backgroundColor: tipPct === p ? T.cream : T.surfaceHi,
              color: tipPct === p ? T.surfaceTop : T.text,
              border: `1px solid ${tipPct === p ? T.cream : T.border}`,
              fontFamily: FONT.mono, fontSize: 14, fontWeight: 600,
              cursor: 'pointer',
            }}>{p === 0 ? '0%' : `+${p}%`}</button>
          ))}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8, marginBottom: 8 }}>
        <PayBig icon={CreditCard} label="SumUp" sub="Solo Lite · 0,79%" primary onClick={() => selectMethod('SumUp')} />
        <PayBig icon={Banknote} label="Bar" sub="mit Wechselgeld-Rechner" onClick={() => selectMethod('Bar')} />
      </div>
      {flow.context === 'table' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
          <PaySmall icon={Split} label="Splitten" onClick={() => alert('Split-Flow folgt')} />
          <PaySmall icon={Receipt} label="Bewirtungsbeleg" onClick={() => setFlow({ ...flow, stage: 'success', method: 'Bewirtung', tip, withBewirtung: true })} />
          <PaySmall icon={FileText} label="Auf Rechnung" onClick={() => setFlow({ ...flow, stage: 'success', method: 'Rechnung', tip })} />
        </div>
      )}
    </div>
  );
}

// ===== CASH AMOUNT SCREEN =====
function CashAmountScreen({ flow, setFlow, onComplete, withPager, pagerNum }) {
  const finalTotal = flow.total + (flow.tip || 0);
  const [given, setGiven] = useState('');
  const givenCents = parseFloat(given.replace(',', '.')) * 100 || 0;
  const change = givenCents - finalTotal;

  const quickAmounts = [];
  // Smart-Beträge: nächster runder Betrag
  const ceil5 = Math.ceil(finalTotal / 500) * 500;
  const ceil10 = Math.ceil(finalTotal / 1000) * 1000;
  const ceil20 = Math.ceil(finalTotal / 2000) * 2000;
  const ceil50 = Math.ceil(finalTotal / 5000) * 5000;
  [finalTotal, ceil5, ceil10, ceil20, ceil50].forEach(a => {
    if (!quickAmounts.includes(a) && a >= finalTotal) quickAmounts.push(a);
  });

  const numpad = ['1','2','3','4','5','6','7','8','9',',','0','⌫'];

  const handleNumpad = (key) => {
    if (key === '⌫') {
      setGiven(prev => prev.slice(0, -1));
    } else if (key === ',') {
      if (!given.includes(',')) setGiven(prev => prev + ',');
    } else {
      setGiven(prev => {
        const parts = (prev + key).split(',');
        if (parts[1] && parts[1].length > 2) return prev;
        return prev + key;
      });
    }
  };

  const confirm = () => {
    setFlow({ 
      ...flow, 
      stage: 'success', 
      cashGiven: givenCents, 
      cashChange: change,
      transactionId: `MISE-${Date.now().toString(36).toUpperCase()}`
    });
  };

  return (
    <div style={{ padding: 32 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <button onClick={() => setFlow({ ...flow, stage: 'select-method' })} style={{
          display: 'flex', alignItems: 'center', gap: 6,
          padding: '6px 10px', borderRadius: 6,
          backgroundColor: 'transparent', color: T.textMute,
          border: 'none', cursor: 'pointer',
          fontFamily: FONT.ui, fontSize: 13, fontWeight: 500,
        }}>
          <ArrowLeft size={14} /> zurück
        </button>
        <Eyebrow>Bar · Wechselgeld</Eyebrow>
        <button onClick={() => setFlow(null)} style={{
          width: 32, height: 32, borderRadius: '50%',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          backgroundColor: T.surfaceHi, color: T.textMute,
          border: `1px solid ${T.border}`, cursor: 'pointer',
        }}><X size={16} /></button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 24 }}>
        <div style={{ padding: 16, borderRadius: 10, backgroundColor: T.surfaceHi, border: `1px solid ${T.border}` }}>
          <div style={{ color: T.textMute, fontFamily: FONT.mono, fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 4 }}>
            Rechnung
          </div>
          <div style={{ color: T.text, fontFamily: FONT.mono, fontSize: 24, fontWeight: 500, fontVariantNumeric: 'tabular-nums' }}>
            {formatEUR(finalTotal)}
          </div>
        </div>
        <div style={{ 
          padding: 16, borderRadius: 10, 
          backgroundColor: change >= 0 ? T.okTint : T.surfaceHi, 
          border: `1.5px solid ${change >= 0 && givenCents > 0 ? T.ok : T.border}`,
        }}>
          <div style={{ color: T.textMute, fontFamily: FONT.mono, fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 4 }}>
            Rückgeld
          </div>
          <div style={{ 
            color: change >= 0 ? T.okBright : T.errBright, 
            fontFamily: FONT.mono, fontSize: 24, fontWeight: 500, fontVariantNumeric: 'tabular-nums',
          }}>
            {givenCents >= finalTotal ? formatEUR(change) : givenCents > 0 ? `fehlt ${formatEUR(-change)}` : '—'}
          </div>
        </div>
      </div>

      <div style={{ marginBottom: 16 }}>
        <div style={{ marginBottom: 8 }}><Eyebrow>Schnellbeträge</Eyebrow></div>
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${quickAmounts.length}, 1fr)`, gap: 6 }}>
          {quickAmounts.map((amt, i) => (
            <button key={i} onClick={() => setGiven(((amt/100).toFixed(2)).replace('.', ','))} style={{
              padding: '14px 0', borderRadius: 8,
              backgroundColor: givenCents === amt ? T.action : T.surfaceHi,
              color: givenCents === amt ? T.surfaceTop : T.text,
              border: `1px solid ${givenCents === amt ? T.action : T.border}`,
              fontFamily: FONT.mono, fontSize: 14, fontWeight: 600,
              fontVariantNumeric: 'tabular-nums',
              cursor: 'pointer',
            }}>
              {i === 0 ? 'passend' : formatEUR(amt)}
            </button>
          ))}
        </div>
      </div>

      <div style={{ marginBottom: 16 }}>
        <div style={{ marginBottom: 8 }}><Eyebrow>oder: Betrag eingeben</Eyebrow></div>
        <div style={{
          padding: 16, borderRadius: 10,
          backgroundColor: T.surfaceHi, border: `1px solid ${T.border}`,
          fontFamily: FONT.mono, fontSize: 28, fontWeight: 500,
          color: T.text, textAlign: 'right',
          fontVariantNumeric: 'tabular-nums',
          marginBottom: 8, minHeight: 64,
          display: 'flex', alignItems: 'center', justifyContent: 'flex-end',
        }}>
          {given ? `${given} €` : <span style={{ color: T.textDim }}>0,00 €</span>}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
          {numpad.map(key => (
            <button key={key} onClick={() => handleNumpad(key)} style={{
              padding: '14px 0', borderRadius: 8,
              backgroundColor: T.surfaceHi, color: T.text,
              border: `1px solid ${T.border}`,
              fontFamily: FONT.mono, fontSize: 18, fontWeight: 600,
              cursor: 'pointer',
            }}>{key}</button>
          ))}
        </div>
      </div>

      <button onClick={confirm} disabled={givenCents < finalTotal} style={{
        width: '100%', padding: '16px',
        backgroundColor: T.action, color: T.surfaceTop,
        border: 'none', borderRadius: 10,
        fontFamily: FONT.ui, fontSize: 15, fontWeight: 700, letterSpacing: '-0.01em',
        cursor: givenCents >= finalTotal ? 'pointer' : 'not-allowed',
        opacity: givenCents >= finalTotal ? 1 : 0.4,
        boxShadow: givenCents >= finalTotal ? `0 8px 24px rgba(230, 138, 44, 0.3)` : 'none',
      }}>
        Bestätigen{givenCents > finalTotal && ` · ${formatEUR(change)} Rückgeld`}
      </button>
    </div>
  );
}

// ===== SUMUP FLOW WITH PROGRESS STATES =====
function SumUpFlow({ flow, setFlow, onComplete, withPager, pagerNum }) {
  const [stage, setStage] = useState('pairing'); // pairing | sending | card | pin | processing
  const finalTotal = flow.total + (flow.tip || 0);

  useEffect(() => {
    // Simulate flow
    const timeouts = [];
    if (stage === 'pairing') {
      timeouts.push(setTimeout(() => setStage('sending'), 1200));
    } else if (stage === 'sending') {
      timeouts.push(setTimeout(() => setStage('card'), 1500));
    } else if (stage === 'card') {
      timeouts.push(setTimeout(() => setStage('pin'), 3000));
    } else if (stage === 'pin') {
      timeouts.push(setTimeout(() => setStage('processing'), 2500));
    } else if (stage === 'processing') {
      timeouts.push(setTimeout(() => {
        // 92% Erfolg, 8% Fehler — realistisch für eine Demo
        if (Math.random() < 0.08) {
          setFlow({ 
            ...flow, 
            stage: 'error', 
            errorReason: 'Karte abgelehnt — Bitte andere Karte versuchen oder Kontostand prüfen.',
          });
        } else {
          setFlow({ 
            ...flow, 
            stage: 'success',
            transactionId: `MISE-${Date.now().toString(36).toUpperCase()}`,
          });
        }
      }, 2200));
    }
    return () => timeouts.forEach(clearTimeout);
  }, [stage]);

  const stages = [
    { id: 'pairing', icon: Wifi, label: 'Terminal verbinden', sub: 'SumUp Solo Lite · Bluetooth' },
    { id: 'sending', icon: ArrowUpDown, label: 'Betrag an Terminal senden', sub: formatEUR(finalTotal) },
    { id: 'card', icon: CreditCard, label: 'Bitte Karte einlegen oder halten', sub: 'Kontaktlos, Chip oder Magnet' },
    { id: 'pin', icon: Hash, label: 'PIN eingeben', sub: 'Falls erforderlich, am Terminal' },
    { id: 'processing', icon: Loader, label: 'Zahlung wird verarbeitet', sub: 'Bitte Karte stecken lassen' },
  ];

  const currentStage = stages.find(s => s.id === stage);
  const currentIdx = stages.findIndex(s => s.id === stage);

  return (
    <div style={{ padding: 32 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 32 }}>
        <Eyebrow>SumUp Solo Lite · Live</Eyebrow>
        <button onClick={() => setFlow({ ...flow, stage: 'select-method' })} style={{
          color: T.err, fontFamily: FONT.mono, fontSize: 11, fontWeight: 500,
          letterSpacing: '0.08em', textTransform: 'uppercase',
          background: 'none', border: 'none', cursor: 'pointer', padding: '4px 8px',
        }}>abbrechen</button>
      </div>

      <div style={{ textAlign: 'center', marginBottom: 32 }}>
        <div style={{
          width: 120, height: 120, margin: '0 auto 24px',
          borderRadius: '50%',
          backgroundColor: T.actionTint,
          border: `2px solid ${T.action}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          position: 'relative',
          animation: 'misePulse 2s ease-in-out infinite',
        }}>
          <style>{`
            @keyframes misePulse {
              0%, 100% { box-shadow: 0 0 0 0 rgba(230, 138, 44, 0.4); }
              50% { box-shadow: 0 0 0 16px rgba(230, 138, 44, 0); }
            }
            @keyframes miseSpin {
              from { transform: rotate(0deg); }
              to { transform: rotate(360deg); }
            }
          `}</style>
          <currentStage.icon size={48} style={{ 
            color: T.action,
            animation: stage === 'processing' ? 'miseSpin 1.2s linear infinite' : 'none',
          }} />
        </div>
        <div style={{
          color: T.text, fontFamily: FONT.ui,
          fontSize: 22, fontWeight: 700, letterSpacing: '-0.02em',
          marginBottom: 6,
        }}>
          {currentStage.label}
        </div>
        <div style={{ color: T.textMute, fontFamily: FONT.body, fontSize: 14 }}>
          {currentStage.sub}
        </div>
      </div>

      <div style={{
        padding: 16, borderRadius: 10,
        backgroundColor: T.surfaceHi, border: `1px solid ${T.border}`,
        textAlign: 'center', marginBottom: 24,
      }}>
        <div style={{ color: T.textMute, fontFamily: FONT.mono, fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 4 }}>
          Betrag am Terminal
        </div>
        <div style={{
          color: T.text, fontFamily: FONT.mono, fontSize: 36, fontWeight: 500,
          fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.02em',
        }}>
          {formatEUR(finalTotal)}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 4, justifyContent: 'center' }}>
        {stages.map((s, i) => (
          <div key={s.id} style={{
            width: 32, height: 4, borderRadius: 2,
            backgroundColor: i <= currentIdx ? T.action : T.border,
            transition: 'all 0.3s',
          }} />
        ))}
      </div>
    </div>
  );
}

// ===== SUCCESS WITH QR =====
function SuccessScreen({ flow, setFlow, onComplete, withPager, pagerNum }) {
  const [printRequested, setPrintRequested] = useState(false);
  const [emailMode, setEmailMode] = useState(false);
  const [email, setEmail] = useState('');
  const finalTotal = flow.total + (flow.tip || 0);
  const txId = flow.transactionId || `MISE-${Date.now().toString(36).toUpperCase()}`;
  const receiptUrl = `https://bon.mise.app/r/${txId}`;

  return (
    <div style={{ padding: 32 }}>
      {/* Big success icon */}
      <div style={{ textAlign: 'center', marginBottom: 24 }}>
        <div style={{
          width: 96, height: 96, margin: '0 auto 16px',
          borderRadius: '50%',
          backgroundColor: T.okTint,
          border: `2px solid ${T.ok}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          animation: 'miseSuccessPop 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
        }}>
          <style>{`
            @keyframes miseSuccessPop {
              0% { transform: scale(0); }
              60% { transform: scale(1.15); }
              100% { transform: scale(1); }
            }
          `}</style>
          <CheckCircle2 size={56} style={{ color: T.okBright }} strokeWidth={2.5} />
        </div>
        <div style={{
          color: T.okBright, fontFamily: FONT.mono, fontSize: 11,
          letterSpacing: '0.14em', textTransform: 'uppercase', fontWeight: 600,
          marginBottom: 4,
        }}>
          Zahlung erfolgreich
        </div>
        <div style={{
          color: T.text, fontFamily: FONT.ui,
          fontSize: 28, fontWeight: 700, letterSpacing: '-0.02em',
          marginBottom: 4,
        }}>
          {formatEUR(finalTotal)}
        </div>
        <div style={{ color: T.textMute, fontFamily: FONT.mono, fontSize: 11, letterSpacing: '0.06em' }}>
          {flow.method} · {txId}
        </div>
        {flow.coupon && (
          <div style={{
            marginTop: 12, padding: '6px 12px', borderRadius: 6,
            backgroundColor: T.actionTint, color: T.action,
            display: 'inline-flex', alignItems: 'center', gap: 6,
            fontFamily: FONT.mono, fontSize: 11, fontWeight: 600,
          }}>
            <Ticket size={12} /> {flow.coupon.name} · gespart {formatEUR(flow.discount)}
          </div>
        )}
        {flow.method === 'Bar' && flow.cashChange > 0 && (
          <div style={{
            marginTop: 12, padding: '8px 16px', borderRadius: 8,
            backgroundColor: T.actionTint, color: T.action,
            display: 'inline-block',
            fontFamily: FONT.mono, fontSize: 14, fontWeight: 600,
          }}>
            Rückgeld {formatEUR(flow.cashChange)}
          </div>
        )}
      </div>

      {/* QR Code Box */}
      <div style={{
        padding: 20, borderRadius: 12,
        backgroundColor: T.surfaceTop, border: `1px solid ${T.border}`,
        marginBottom: 16,
        display: 'flex', alignItems: 'center', gap: 20,
      }}>
        <div style={{
          width: 132, height: 132, borderRadius: 10,
          backgroundColor: T.cream, padding: 10,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
        }}>
          <QRPlaceholder url={receiptUrl} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <Eyebrow>Digitaler Bon</Eyebrow>
          <div style={{
            color: T.text, fontFamily: FONT.ui,
            fontSize: 16, fontWeight: 700, letterSpacing: '-0.01em',
            marginTop: 6, marginBottom: 4,
          }}>
            Bon per Smartphone scannen
          </div>
          <div style={{ color: T.textMute, fontFamily: FONT.body, fontSize: 12, lineHeight: 1.5, marginBottom: 8 }}>
            Der Gast scannt mit der Kamera. Bon mit allen Pflichtangaben (TSE-Signatur, MwSt, Steuernummer) im Browser.
          </div>
          <div style={{
            display: 'inline-block', padding: '4px 8px', borderRadius: 4,
            backgroundColor: T.surfaceHi,
            color: T.textMute, fontFamily: FONT.mono, fontSize: 11,
          }}>
            {receiptUrl}
          </div>
        </div>
      </div>

      {/* Optional: Email */}
      {!emailMode ? (
        <button onClick={() => setEmailMode(true)} style={{
          width: '100%', padding: '11px',
          backgroundColor: T.surfaceHi, color: T.text,
          border: `1px solid ${T.border}`, borderRadius: 10,
          fontFamily: FONT.ui, fontSize: 13, fontWeight: 500,
          cursor: 'pointer', marginBottom: 8,
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
        }}>
          <Mail size={14} /> Bon per E-Mail versenden
        </button>
      ) : (
        <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
          <input value={email} onChange={e => setEmail(e.target.value)}
            placeholder="gast@example.de" autoFocus type="email"
            style={{
              flex: 1, padding: '11px 14px', borderRadius: 10,
              backgroundColor: T.surfaceHi, border: `1px solid ${T.border}`,
              color: T.text, fontFamily: FONT.body, fontSize: 13, outline: 'none',
            }} />
          <button onClick={() => { setEmail(''); setEmailMode(false); }} style={{
            padding: '11px 18px', borderRadius: 10,
            backgroundColor: T.action, color: T.surfaceTop,
            border: 'none', cursor: 'pointer',
            fontFamily: FONT.ui, fontSize: 13, fontWeight: 600,
          }}>Senden</button>
        </div>
      )}

      {/* Optional: Print — NICHT default */}
      <button onClick={() => setPrintRequested(true)} disabled={printRequested} style={{
        width: '100%', padding: '11px',
        backgroundColor: printRequested ? T.okTint : T.surfaceHi,
        color: printRequested ? T.okBright : T.text,
        border: `1px solid ${printRequested ? T.ok : T.border}`,
        borderRadius: 10,
        fontFamily: FONT.ui, fontSize: 13, fontWeight: 500,
        cursor: printRequested ? 'default' : 'pointer', marginBottom: 16,
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
      }}>
        {printRequested ? <><Check size={14} /> Bon wird gedruckt</> : <><Printer size={14} /> Papier-Bon drucken (auf Wunsch)</>}
      </button>

      {withPager && (
        <div style={{
          padding: 14, marginBottom: 16, borderRadius: 10,
          backgroundColor: T.actionTint,
          border: `1.5px solid ${T.action}`,
          display: 'flex', alignItems: 'center', gap: 12,
        }}>
          <div style={{
            width: 44, height: 44, borderRadius: '50%',
            backgroundColor: T.action,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
          }}>
            <Hash size={22} style={{ color: T.surfaceTop }} />
          </div>
          <div>
            <div style={{
              color: T.action, fontFamily: FONT.ui,
              fontSize: 15, fontWeight: 700, letterSpacing: '-0.01em',
            }}>
              Pager #{pagerNum} an Gast ausgeben
            </div>
            <div style={{ color: T.textMute, fontFamily: FONT.body, fontSize: 12, marginTop: 2 }}>
              Wir rufen wenn Speisen fertig sind.
            </div>
          </div>
        </div>
      )}

      <button onClick={onComplete} style={{
        width: '100%', padding: '16px',
        backgroundColor: T.action, color: T.surfaceTop,
        border: 'none', borderRadius: 10,
        fontFamily: FONT.ui, fontSize: 15, fontWeight: 700, letterSpacing: '-0.01em',
        cursor: 'pointer',
        boxShadow: `0 8px 24px rgba(230, 138, 44, 0.3)`,
      }}>
        Fertig · Nächster Gast
      </button>
    </div>
  );
}

// ===== ERROR =====
function ErrorScreen({ flow, setFlow }) {
  const finalTotal = flow.total + (flow.tip || 0);
  const retry = () => setFlow({ ...flow, stage: 'sumup-pairing' });
  const fallback = () => setFlow({ ...flow, stage: 'select-method' });

  return (
    <div style={{ padding: 32 }}>
      <div style={{ textAlign: 'center', marginBottom: 24 }}>
        <div style={{
          width: 96, height: 96, margin: '0 auto 16px',
          borderRadius: '50%',
          backgroundColor: T.errTint,
          border: `2px solid ${T.err}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          animation: 'miseShakeIn 0.5s',
        }}>
          <style>{`
            @keyframes miseShakeIn {
              0% { transform: scale(0); }
              60% { transform: scale(1.15) rotate(-3deg); }
              80% { transform: scale(1) rotate(3deg); }
              100% { transform: scale(1) rotate(0); }
            }
          `}</style>
          <XCircle size={56} style={{ color: T.errBright }} strokeWidth={2.5} />
        </div>
        <div style={{
          color: T.errBright, fontFamily: FONT.mono, fontSize: 11,
          letterSpacing: '0.14em', textTransform: 'uppercase', fontWeight: 600,
          marginBottom: 6,
        }}>
          Zahlung fehlgeschlagen
        </div>
        <div style={{
          color: T.text, fontFamily: FONT.ui,
          fontSize: 24, fontWeight: 700, letterSpacing: '-0.02em',
          marginBottom: 10,
        }}>
          {flow.method} · {formatEUR(finalTotal)}
        </div>
      </div>

      <div style={{
        padding: 16, borderRadius: 10, marginBottom: 24,
        backgroundColor: T.errTint, border: `1px solid ${T.err}`,
        display: 'flex', gap: 12,
      }}>
        <AlertCircle size={20} style={{ color: T.errBright, flexShrink: 0, marginTop: 2 }} />
        <div>
          <div style={{ color: T.text, fontFamily: FONT.ui, fontSize: 14, fontWeight: 600, marginBottom: 4 }}>
            Grund
          </div>
          <div style={{ color: T.text, fontFamily: FONT.body, fontSize: 13, lineHeight: 1.5 }}>
            {flow.errorReason || 'Karte abgelehnt. Bitte erneut versuchen oder andere Zahlungsart wählen.'}
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
        <button onClick={fallback} style={{
          padding: '14px', borderRadius: 10,
          backgroundColor: T.surfaceHi, color: T.text,
          border: `1px solid ${T.border}`,
          fontFamily: FONT.ui, fontSize: 14, fontWeight: 600,
          cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
        }}>
          <ArrowLeft size={15} /> Andere Zahlart
        </button>
        <button onClick={retry} style={{
          padding: '14px', borderRadius: 10,
          backgroundColor: T.action, color: T.surfaceTop,
          border: 'none',
          fontFamily: FONT.ui, fontSize: 14, fontWeight: 700,
          cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          boxShadow: `0 4px 12px rgba(230, 138, 44, 0.25)`,
        }}>
          <RotateCw size={15} /> Erneut versuchen
        </button>
      </div>

      <button onClick={() => setFlow(null)} style={{
        width: '100%', padding: '10px',
        backgroundColor: 'transparent', color: T.textMute,
        border: 'none', cursor: 'pointer',
        fontFamily: FONT.mono, fontSize: 11,
        letterSpacing: '0.08em', textTransform: 'uppercase',
      }}>
        Abbrechen · Rechnung bleibt offen
      </button>
    </div>
  );
}

// QR Placeholder — generates a visual QR-style pattern
function QRPlaceholder({ url }) {
  // Pseudo-random but deterministic based on URL
  const seed = url.length;
  const grid = [];
  for (let i = 0; i < 21; i++) {
    const row = [];
    for (let j = 0; j < 21; j++) {
      // Corners (finder patterns)
      const isCorner = 
        (i < 7 && j < 7) || (i < 7 && j > 13) || (i > 13 && j < 7);
      if (isCorner) {
        const inFrame = i === 0 || i === 6 || j === 0 || j === 6 ||
                        (i < 7 && i > 0 && j < 7 && j > 0 && 
                         !(i === 1 || i === 5 || j === 1 || j === 5));
        if (i < 7 && j < 7) row.push(i === 0 || i === 6 || j === 0 || j === 6 || (i >= 2 && i <= 4 && j >= 2 && j <= 4) ? 1 : 0);
        else if (i < 7 && j > 13) {
          const ii = i, jj = j - 14;
          row.push(ii === 0 || ii === 6 || jj === 0 || jj === 6 || (ii >= 2 && ii <= 4 && jj >= 2 && jj <= 4) ? 1 : 0);
        }
        else if (i > 13 && j < 7) {
          const ii = i - 14, jj = j;
          row.push(ii === 0 || ii === 6 || jj === 0 || jj === 6 || (ii >= 2 && ii <= 4 && jj >= 2 && jj <= 4) ? 1 : 0);
        }
      } else {
        // Random-looking data
        row.push((i * 7 + j * 13 + seed * 3) % 7 < 3 ? 1 : 0);
      }
    }
    grid.push(row);
  }

  return (
    <div style={{
      width: '100%', height: '100%',
      display: 'grid',
      gridTemplateColumns: 'repeat(21, 1fr)',
      gridTemplateRows: 'repeat(21, 1fr)',
      gap: 0,
    }}>
      {grid.flat().map((cell, i) => (
        <div key={i} style={{
          backgroundColor: cell ? T.surfaceTop : 'transparent',
        }} />
      ))}
    </div>
  );
}

// ============ ALL THE REST (unchanged from v3) ============

function Chrome({ children, toast }) {
  return (
    <div style={{
      width: '100%', height: '100vh',
      display: 'flex', flexDirection: 'column',
      fontFamily: FONT.body,
      backgroundColor: T.bg, color: T.text,
      overflow: 'hidden',
      WebkitFontSmoothing: 'antialiased',
      MozOsxFontSmoothing: 'grayscale',
    }}>
      {children}
      {toast && (
        <div style={{
          position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)',
          padding: '12px 20px', borderRadius: 10,
          backgroundColor: toast.type === 'warn' ? T.warn : T.cream,
          color: T.surfaceTop,
          fontFamily: FONT.mono, fontSize: 13, fontWeight: 500, letterSpacing: '0.02em',
          zIndex: 100,
          boxShadow: '0 16px 40px rgba(0, 0, 0, 0.5)',
        }}>{toast.msg}</div>
      )}
    </div>
  );
}

function TopBar({ mode, onModeSwitch, time, onSettings, showBack, onBack, backLabel, activeTable, activeOrder }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '0 24px', minHeight: 64,
      backgroundColor: T.surfaceTop, borderBottom: `1px solid ${T.border}`,
    }}>
      <div className="flex items-center gap-4">
        {showBack && (
          <button onClick={onBack} style={{
            display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px',
            color: T.text, backgroundColor: 'transparent', border: 'none',
            fontFamily: FONT.ui, fontSize: 14, fontWeight: 500, cursor: 'pointer',
          }}><ArrowLeft size={16} />{backLabel}</button>
        )}

        <div style={{
          display: 'flex', alignItems: 'flex-end',
          fontFamily: FONT.ui, fontSize: 30, fontWeight: 800, letterSpacing: '-0.06em',
          lineHeight: 0.85, color: T.cream,
        }}>
          m<span style={{
            display: 'inline-block', width: 10, height: 10, borderRadius: '50%',
            backgroundColor: T.action, marginLeft: 3, transform: 'translateY(-2px)',
          }} />
        </div>

        {!showBack && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 2,
            padding: 3, marginLeft: 12, borderRadius: 10,
            backgroundColor: T.surface, border: `1px solid ${T.border}`,
          }}>
            <ModeButton icon={Users} label="Tisch-Service" active={mode === 'table'} onClick={() => onModeSwitch('table')} />
            <ModeButton icon={Zap} label="Counter" active={mode === 'counter'} onClick={() => onModeSwitch('counter')} />
          </div>
        )}

        {activeTable && activeOrder && (
          <>
            <div style={{ width: 1, height: 28, backgroundColor: T.border }} />
            <div className="flex items-center gap-3">
              <div style={{
                backgroundColor: T.cream, color: T.surfaceTop,
                padding: '7px 13px', borderRadius: 8,
                fontFamily: FONT.ui, fontSize: 18, fontWeight: 800, letterSpacing: '-0.02em',
              }}>T{activeTable.label}</div>
              <div>
                <div style={{ color: T.text, fontFamily: FONT.body, fontSize: 13, fontWeight: 500 }}>
                  {activeOrder.guests} Gäste · seit {activeOrder.opened}
                </div>
                <div style={{ color: T.textMute, fontFamily: FONT.mono, fontSize: 10, letterSpacing: '0.04em' }}>
                  {activeOrder.waiter}
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      <div className="flex items-center gap-3">
        <StatusPill icon={Shield} label="TSE OK" tone="ok" />
        <StatusPill icon={CreditCard} label="SumUp" dot tone="ok" />
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8, padding: '6px 12px',
          color: T.text, fontFamily: FONT.mono, fontSize: 14, fontVariantNumeric: 'tabular-nums',
        }}>
          <Clock size={13} style={{ color: T.textMute }} />{time}
        </div>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          paddingLeft: 12, borderLeft: `1px solid ${T.border}`,
        }}>
          <div style={{
            width: 32, height: 32, borderRadius: '50%',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            backgroundColor: T.cream, color: T.surfaceTop,
            fontFamily: FONT.ui, fontSize: 13, fontWeight: 700,
          }}>T</div>
          <div>
            <div style={{ color: T.text, fontFamily: FONT.body, fontSize: 13, fontWeight: 600, lineHeight: 1.1 }}>Tahar</div>
            <div style={{ color: T.textMute, fontFamily: FONT.mono, fontSize: 9, letterSpacing: '0.1em', textTransform: 'uppercase', marginTop: 1 }}>Service</div>
          </div>
        </div>
        {onSettings && (
          <button onClick={onSettings} style={{
            padding: 10, borderRadius: 8,
            backgroundColor: T.surface, color: T.text,
            border: `1px solid ${T.border}`, cursor: 'pointer',
          }}><Settings size={16} /></button>
        )}
      </div>
    </div>
  );
}

function ModeButton({ icon: Icon, label, active, onClick }) {
  return (
    <button onClick={onClick} style={{
      display: 'flex', alignItems: 'center', gap: 6,
      padding: '7px 14px', borderRadius: 8,
      backgroundColor: active ? T.cream : 'transparent',
      color: active ? T.surfaceTop : T.textMute,
      border: 'none',
      fontFamily: FONT.ui, fontSize: 13, fontWeight: 600, letterSpacing: '-0.01em',
      cursor: 'pointer', transition: 'all 0.15s',
    }}><Icon size={13} />{label}</button>
  );
}

function StatusPill({ icon: Icon, label, dot, tone = 'ok' }) {
  const color = tone === 'ok' ? T.ok : tone === 'warn' ? T.warn : T.err;
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 6,
      padding: '4px 10px', borderRadius: 20,
      backgroundColor: T.surface, border: `1px solid ${T.border}`,
    }}>
      <Icon size={11} style={{ color }} />
      <span style={{
        color: T.text, fontFamily: FONT.mono, fontSize: 11,
        letterSpacing: '0.04em', fontWeight: 500,
      }}>{label}</span>
      {dot && <span style={{ display: 'inline-block', width: 6, height: 6, borderRadius: '50%', backgroundColor: color }} />}
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <span style={{
        color: T.textMute, fontFamily: FONT.mono,
        fontSize: 9, letterSpacing: '0.14em', textTransform: 'uppercase', fontWeight: 500,
      }}>{label}</span>
      <span style={{
        color: T.text, fontFamily: FONT.mono,
        fontSize: 14, fontWeight: 600, fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.01em',
      }}>{value}</span>
    </div>
  );
}

function Divider() { return <div style={{ width: 1, height: 24, backgroundColor: T.border }} />; }
function Eyebrow({ children }) {
  return (
    <span style={{
      color: T.textMute, fontFamily: FONT.mono,
      fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase', fontWeight: 500,
    }}>{children}</span>
  );
}

function CategoryRail({ activeCategory, onChange }) {
  return (
    <div style={{
      width: 136, borderRight: `1px solid ${T.border}`,
      backgroundColor: T.surface, overflowY: 'auto',
    }}>
      {CATEGORIES.map(cat => {
        const Icon = cat.icon;
        const isActive = activeCategory === cat.id;
        return (
          <button key={cat.id} onClick={() => onChange(cat.id)} style={{
            width: '100%',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
            padding: '18px 8px',
            backgroundColor: isActive ? T.bg : 'transparent',
            borderLeft: isActive ? `3px solid ${cat.color}` : '3px solid transparent',
            border: 'none',
            color: isActive ? T.text : T.textMute,
            cursor: 'pointer', transition: 'all 0.15s',
          }}>
            <div style={{
              width: 36, height: 36, borderRadius: 8,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              backgroundColor: isActive ? cat.color : T.surfaceHi,
              color: isActive ? T.cream : cat.color,
            }}><Icon size={17} strokeWidth={2} /></div>
            <span style={{
              fontFamily: FONT.ui, fontSize: 11, fontWeight: 600,
              textAlign: 'center', lineHeight: 1.2, letterSpacing: '-0.005em',
            }}>{cat.name}</span>
          </button>
        );
      })}
    </div>
  );
}

function SearchBar({ value, onChange }) {
  return (
    <div style={{ padding: '12px 24px', borderBottom: `1px solid ${T.border}`, backgroundColor: T.surface }}>
      <div style={{ position: 'relative' }}>
        <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: T.textMute }} />
        <input value={value} onChange={e => onChange(e.target.value)} placeholder="Produkt suchen…"
          style={{
            width: '100%',
            paddingLeft: 36, paddingRight: 12, paddingTop: 10, paddingBottom: 10,
            backgroundColor: T.bg, border: `1px solid ${T.border}`,
            borderRadius: 8, outline: 'none',
            color: T.text, fontFamily: FONT.body, fontSize: 14,
          }} />
      </div>
    </div>
  );
}

function ProductCard({ product, onClick, isSoldOut }) {
  const hasMods = product.modGroups && product.modGroups.length > 0;
  const [hover, setHover] = useState(false);
  return (
    <button onClick={() => !isSoldOut && onClick()} disabled={isSoldOut}
      onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      style={{
        position: 'relative', textAlign: 'left',
        padding: 16, minHeight: 132,
        backgroundColor: product.featured ? T.actionTint : T.surface,
        border: `1px solid ${product.featured ? T.action : (hover && !isSoldOut ? T.borderHi : T.border)}`,
        borderRadius: 12,
        opacity: isSoldOut ? 0.35 : 1,
        cursor: isSoldOut ? 'not-allowed' : 'pointer',
        transition: 'all 0.12s',
        transform: hover && !isSoldOut ? 'translateY(-1px)' : 'translateY(0)',
        boxShadow: hover && !isSoldOut ? '0 8px 24px rgba(0, 0, 0, 0.3)' : 'none',
      }}>
      {isSoldOut && (
        <div style={{
          position: 'absolute', inset: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: `repeating-linear-gradient(45deg, transparent, transparent 8px, rgba(184, 74, 58, 0.08) 8px, rgba(184, 74, 58, 0.08) 16px)`,
          pointerEvents: 'none', borderRadius: 12,
        }}>
          <span style={{
            backgroundColor: T.err, color: T.cream,
            padding: '4px 12px', borderRadius: 6,
            fontFamily: FONT.mono, fontSize: 11,
            letterSpacing: '0.12em', textTransform: 'uppercase', fontWeight: 600,
          }}>86'd</span>
        </div>
      )}
      {product.featured && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 8, color: T.action }}>
          <Sparkles size={11} />
          <span style={{
            fontFamily: FONT.mono, fontSize: 10,
            letterSpacing: '0.12em', textTransform: 'uppercase', fontWeight: 600,
          }}>Tagesgericht</span>
        </div>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', minHeight: 96 }}>
        <div>
          <div style={{
            color: T.text, fontFamily: FONT.ui,
            fontSize: 15, fontWeight: 600, letterSpacing: '-0.01em',
            lineHeight: 1.3, marginBottom: 8,
          }}>{product.name}</div>
          {hasMods && (
            <div style={{
              display: 'inline-block', padding: '2px 7px', borderRadius: 4,
              backgroundColor: T.surfaceHi, color: T.textMute,
              fontFamily: FONT.body, fontSize: 10, fontWeight: 500,
            }}>
              {product.modGroups.length} {product.modGroups.length === 1 ? 'Option' : 'Optionen'}
            </div>
          )}
        </div>
        <div style={{
          color: product.featured ? T.action : T.text,
          fontFamily: FONT.mono, fontSize: 15, fontWeight: 600,
          fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.01em',
        }}>{formatEUR(product.price)}</div>
      </div>
    </button>
  );
}

function TableCard({ table, order, onClick }) {
  const isOccupied = order && order.items.length > 0;
  const total = order ? calcOrderTotal(order.items) : 0;
  const state = order?.state || 'free';
  let bgColor = T.surface, textColor = T.textMute, borderColor = T.borderHi, pulse = false;
  if (state === 'active') { bgColor = T.ok; textColor = T.cream; borderColor = T.ok; }
  else if (state === 'food-ready') { bgColor = T.action; textColor = T.surfaceTop; borderColor = T.actionHi; pulse = true; }
  else if (state === 'bill-requested') { bgColor = T.err; textColor = T.cream; borderColor = T.err; }
  const isRound = table.shape === 'round' || table.shape === 'stool';
  const isBanquet = table.shape === 'banquet';

  return (
    <button onClick={onClick} style={{
      position: 'absolute',
      left: table.x, top: table.y, width: table.w, height: table.h,
      backgroundColor: bgColor, color: textColor,
      border: `2px solid ${borderColor}`,
      borderRadius: isRound ? '50%' : isBanquet ? 16 : 10,
      padding: 12, textAlign: 'left',
      boxShadow: isOccupied ? '0 4px 16px rgba(0, 0, 0, 0.3)' : 'none',
      animation: pulse ? 'misePulseTable 1.8s ease-in-out infinite' : 'none',
      cursor: 'pointer', transition: 'transform 0.15s',
    }}>
      <style>{`
        @keyframes misePulseTable {
          0%, 100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(230, 138, 44, 0.5), 0 4px 16px rgba(0, 0, 0, 0.3); }
          50% { transform: scale(1.02); box-shadow: 0 0 0 8px rgba(230, 138, 44, 0), 0 4px 16px rgba(0, 0, 0, 0.3); }
        }
      `}</style>
      <div style={{ height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <span style={{
            fontFamily: FONT.ui, fontSize: isRound ? 22 : 24, fontWeight: 800,
            letterSpacing: '-0.04em', lineHeight: 1,
          }}>{table.label}</span>
          {isOccupied && (
            <span style={{ fontFamily: FONT.mono, fontSize: 10, opacity: 0.85, fontWeight: 500 }}>
              {order.opened}
            </span>
          )}
        </div>
        {isOccupied ? (
          <div>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 4,
              fontFamily: FONT.mono, fontSize: 10, opacity: 0.85, marginBottom: 4, fontWeight: 500,
            }}>
              <Users size={10} /> {order.guests}
            </div>
            {!isRound && (
              <div style={{
                fontFamily: FONT.mono, fontSize: 13, fontWeight: 600,
                fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.01em',
              }}>{formatEUR(total)}</div>
            )}
          </div>
        ) : (
          <div style={{ fontFamily: FONT.mono, fontSize: 10, opacity: 0.45, fontWeight: 500 }}>
            {table.seats} {table.seats === 1 ? 'Platz' : 'Plätze'}
          </div>
        )}
      </div>
    </button>
  );
}

function LegendDot({ color, border, label, pulse }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <span style={{
        display: 'inline-block', width: 10, height: 10, borderRadius: '50%',
        backgroundColor: color, border: border ? `1px solid ${border}` : 'none',
        animation: pulse ? 'misePulseLegend 1.8s ease-in-out infinite' : 'none',
      }} />
      <style>{`
        @keyframes misePulseLegend {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.15); }
        }
      `}</style>
      <span style={{
        color: T.textMute, fontFamily: FONT.mono,
        fontSize: 10, fontWeight: 500, letterSpacing: '0.04em',
      }}>{label}</span>
    </div>
  );
}

function SeatTab({ label, active, onClick }) {
  return (
    <button onClick={onClick} style={{
      padding: '7px 13px', borderRadius: 8, whiteSpace: 'nowrap',
      backgroundColor: active ? T.cream : 'transparent',
      color: active ? T.surfaceTop : T.textMute,
      border: `1px solid ${active ? T.cream : T.border}`,
      fontFamily: FONT.ui, fontSize: 12, fontWeight: 600, letterSpacing: '-0.01em',
      cursor: 'pointer', transition: 'all 0.12s',
    }}>{label}</button>
  );
}

function OrderRow({ item, onPlus, onMinus, onStorno }) {
  const total = calcItemTotal(item);
  const [hover, setHover] = useState(false);
  return (
    <div onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)} style={{
      display: 'flex', alignItems: 'flex-start', gap: 10,
      padding: '10px 0', borderBottom: `1px solid ${T.border}`,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 2 }}>
        <button onClick={onMinus} style={{
          width: 26, height: 26, borderRadius: 6,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          backgroundColor: T.surfaceHi, color: T.textMute,
          border: 'none', cursor: 'pointer',
        }}><Minus size={12} /></button>
        <span style={{
          width: 24, textAlign: 'center',
          color: T.text, fontFamily: FONT.mono,
          fontSize: 13, fontWeight: 600, fontVariantNumeric: 'tabular-nums',
        }}>{item.qty}</span>
        <button onClick={onPlus} style={{
          width: 26, height: 26, borderRadius: 6,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          backgroundColor: T.surfaceHi, color: T.textMute,
          border: 'none', cursor: 'pointer',
        }}><Plus size={12} /></button>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{
            color: T.text, fontFamily: FONT.body,
            fontSize: 13, fontWeight: 500, lineHeight: 1.3,
          }}>{item.name}</span>
          {item.sent && (
            <span style={{
              color: T.ok, fontFamily: FONT.mono, fontSize: 9,
              letterSpacing: '0.1em', textTransform: 'uppercase', fontWeight: 600,
              backgroundColor: T.okTint,
              padding: '1px 5px', borderRadius: 3,
            }}>✓ Bon</span>
          )}
        </div>
        {item.mods && item.mods.length > 0 && (
          <div style={{
            color: T.action, fontFamily: FONT.body,
            fontSize: 11, marginTop: 2, lineHeight: 1.3,
          }}>{item.mods.join(', ')}</div>
        )}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2 }}>
        <span style={{
          color: T.text, fontFamily: FONT.mono,
          fontSize: 13, fontWeight: 500, fontVariantNumeric: 'tabular-nums',
        }}>{formatEUR(total)}</span>
        <button onClick={onStorno} style={{
          color: T.err, fontFamily: FONT.mono,
          fontSize: 9, letterSpacing: '0.1em', textTransform: 'uppercase', fontWeight: 500,
          background: 'none', border: 'none', padding: 0,
          opacity: hover ? 1 : 0, cursor: 'pointer',
          transition: 'opacity 0.12s',
        }}>Storno</button>
      </div>
    </div>
  );
}

function CounterCartRow({ item, onPlus, onMinus, onRemove, onToggleTakeaway }) {
  const total = calcItemTotal(item);
  return (
    <div style={{
      padding: 10, borderRadius: 8, marginBottom: 4,
      backgroundColor: T.surfaceHi, border: `1px solid ${T.border}`,
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <button onClick={onMinus} style={{
            width: 28, height: 28, borderRadius: 6,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            backgroundColor: T.surface, color: T.textMute,
            border: `1px solid ${T.border}`, cursor: 'pointer',
          }}><Minus size={13} /></button>
          <span style={{
            width: 24, textAlign: 'center',
            color: T.text, fontFamily: FONT.mono,
            fontSize: 14, fontWeight: 600, fontVariantNumeric: 'tabular-nums',
          }}>{item.qty}</span>
          <button onClick={onPlus} style={{
            width: 28, height: 28, borderRadius: 6,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            backgroundColor: T.surface, color: T.textMute,
            border: `1px solid ${T.border}`, cursor: 'pointer',
          }}><Plus size={13} /></button>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            color: T.text, fontFamily: FONT.body,
            fontSize: 13, fontWeight: 500, lineHeight: 1.3,
          }}>{item.name}</div>
          {item.mods && item.mods.length > 0 && (
            <div style={{
              color: T.action, fontFamily: FONT.body,
              fontSize: 11, marginTop: 2, lineHeight: 1.3,
            }}>{item.mods.join(', ')}</div>
          )}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2 }}>
          <span style={{
            color: T.text, fontFamily: FONT.mono,
            fontSize: 13, fontWeight: 500, fontVariantNumeric: 'tabular-nums',
          }}>{formatEUR(total)}</span>
          <button onClick={onRemove} style={{
            color: T.err, fontFamily: FONT.mono,
            fontSize: 9, letterSpacing: '0.1em', textTransform: 'uppercase', fontWeight: 500,
            background: 'none', border: 'none', cursor: 'pointer', padding: 0,
          }}>entfernen</button>
        </div>
      </div>

      {item.isFood && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 4,
          marginTop: 8, paddingTop: 8, borderTop: `1px solid ${T.border}`,
        }}>
          <button onClick={onToggleTakeaway} style={{
            flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            padding: '6px 0', borderRadius: 6,
            backgroundColor: !item.takeaway ? T.cream : 'transparent',
            color: !item.takeaway ? T.surfaceTop : T.textMute,
            border: 'none', cursor: 'pointer',
            fontFamily: FONT.mono, fontSize: 10, fontWeight: 600,
            letterSpacing: '0.08em', textTransform: 'uppercase',
          }}><Home size={11} /> Hier</button>
          <button onClick={onToggleTakeaway} style={{
            flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            padding: '6px 0', borderRadius: 6,
            backgroundColor: item.takeaway ? T.cream : 'transparent',
            color: item.takeaway ? T.surfaceTop : T.textMute,
            border: 'none', cursor: 'pointer',
            fontFamily: FONT.mono, fontSize: 10, fontWeight: 600,
            letterSpacing: '0.08em', textTransform: 'uppercase',
          }}><ShoppingBag size={11} /> To Go</button>
        </div>
      )}
    </div>
  );
}

function SummaryRow({ label, value }) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between',
      color: T.textMute, fontFamily: FONT.mono,
      fontSize: 11, fontVariantNumeric: 'tabular-nums',
    }}><span>{label}</span><span>{value}</span></div>
  );
}

function CounterToggle({ label, active, onChange, icon: Icon }) {
  return (
    <button onClick={onChange} style={{
      display: 'flex', alignItems: 'center', gap: 6,
      padding: '7px 13px', borderRadius: 8,
      backgroundColor: active ? T.cream : T.surface,
      color: active ? T.surfaceTop : T.textMute,
      border: `1px solid ${active ? T.cream : T.border}`,
      fontFamily: FONT.ui, fontSize: 12, fontWeight: 600, letterSpacing: '-0.01em',
      cursor: 'pointer', transition: 'all 0.12s',
    }}><Icon size={13} />{label}</button>
  );
}

function PagerChip({ pager, onReady, onGiveOut }) {
  const isReady = pager.status === 'ready';
  return (
    <button onClick={isReady ? onGiveOut : onReady} style={{
      display: 'flex', alignItems: 'center', gap: 5,
      padding: '5px 11px', borderRadius: 20,
      backgroundColor: isReady ? T.action : T.surface,
      color: isReady ? T.surfaceTop : T.text,
      border: `1px solid ${isReady ? T.action : T.border}`,
      fontFamily: FONT.mono, fontSize: 12, fontWeight: 600, cursor: 'pointer',
      animation: isReady ? 'misePulsePager 1.8s ease-in-out infinite' : 'none',
    }}>
      <style>{`
        @keyframes misePulsePager {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.05); }
        }
      `}</style>
      {isReady ? <Bell size={11} /> : <Hash size={11} />}
      <span>#{pager.num}</span>
      <span style={{ opacity: 0.6, fontSize: 10 }}>·{pager.items}</span>
    </button>
  );
}

function Modal({ children, onClose, wide }) {
  return (
    <div style={{
      position: 'fixed', inset: 0,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 16, backgroundColor: 'rgba(0, 0, 0, 0.7)',
      backdropFilter: 'blur(8px)', zIndex: 50,
    }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} style={{
        width: '100%', maxWidth: wide ? 560 : 440,
        padding: 32, borderRadius: 16,
        backgroundColor: T.surface, border: `1px solid ${T.border}`,
        boxShadow: '0 24px 64px rgba(0, 0, 0, 0.5)',
        maxHeight: '90vh', overflowY: 'auto',
      }}>{children}</div>
    </div>
  );
}

function GuestModal({ tableId, onConfirm, onClose }) {
  const [count, setCount] = useState(2);
  return (
    <Modal onClose={onClose}>
      <div style={{ textAlign: 'center' }}>
        <Eyebrow>Tisch {tableId} öffnen</Eyebrow>
        <div style={{
          color: T.text, fontFamily: FONT.ui,
          fontSize: 28, fontWeight: 700, letterSpacing: '-0.02em',
          marginTop: 12, marginBottom: 32,
        }}>Wie viele Gäste?</div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 24, marginBottom: 24 }}>
          <button onClick={() => setCount(Math.max(1, count - 1))} style={{
            width: 56, height: 56, borderRadius: '50%',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            backgroundColor: T.surfaceHi, color: T.text,
            border: `1px solid ${T.border}`, cursor: 'pointer',
          }}><Minus size={20} /></button>
          <div style={{
            color: T.action, fontFamily: FONT.mono,
            fontSize: 80, fontWeight: 600, minWidth: 100,
            fontVariantNumeric: 'tabular-nums', lineHeight: 1, letterSpacing: '-0.02em',
          }}>{count}</div>
          <button onClick={() => setCount(count + 1)} style={{
            width: 56, height: 56, borderRadius: '50%',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            backgroundColor: T.surfaceHi, color: T.text,
            border: `1px solid ${T.border}`, cursor: 'pointer',
          }}><Plus size={20} /></button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 8, marginBottom: 24 }}>
          {[1, 2, 3, 4, 6, 8].map(n => (
            <button key={n} onClick={() => setCount(n)} style={{
              padding: '10px 0', borderRadius: 8,
              backgroundColor: count === n ? T.cream : T.surfaceHi,
              color: count === n ? T.surfaceTop : T.text,
              border: `1px solid ${count === n ? T.cream : T.border}`,
              fontFamily: FONT.mono, fontSize: 14, fontWeight: 600, cursor: 'pointer',
            }}>{n}</button>
          ))}
        </div>

        <button onClick={() => onConfirm(count)} style={{
          width: '100%', padding: '16px',
          backgroundColor: T.action, color: T.surfaceTop,
          border: 'none', borderRadius: 10,
          fontFamily: FONT.ui, fontSize: 15, fontWeight: 700, letterSpacing: '-0.01em',
          cursor: 'pointer', boxShadow: `0 8px 24px rgba(230, 138, 44, 0.3)`,
        }}>Tisch öffnen</button>
      </div>
    </Modal>
  );
}

function OptionsModal({ product, onConfirm, onClose }) {
  const [selected, setSelected] = useState({});
  const [note, setNote] = useState('');
  const handleSelect = (groupName, optName, isMulti) => {
    setSelected(prev => {
      if (isMulti) {
        const arr = prev[groupName] || [];
        return { ...prev, [groupName]: arr.includes(optName) ? arr.filter(o => o !== optName) : [...arr, optName] };
      }
      return { ...prev, [groupName]: optName };
    });
  };
  const canConfirm = product.modGroups.every(g => !g.required || selected[g.name]);
  const handleConfirm = () => {
    const mods = [];
    let extra = 0;
    product.modGroups.forEach(g => {
      const sel = selected[g.name];
      if (Array.isArray(sel)) {
        sel.forEach(s => {
          mods.push(s);
          const opt = g.options.find(o => o.name === s);
          if (opt) extra += opt.price;
        });
      } else if (sel) {
        mods.push(sel);
        const opt = g.options.find(o => o.name === sel);
        if (opt) extra += opt.price;
      }
    });
    if (note) mods.push(`📝 ${note}`);
    onConfirm(mods, extra);
  };

  return (
    <Modal onClose={onClose} wide>
      <Eyebrow>Optionen</Eyebrow>
      <div style={{
        color: T.text, fontFamily: FONT.ui,
        fontSize: 26, fontWeight: 700, letterSpacing: '-0.02em',
        marginTop: 4, marginBottom: 2,
      }}>{product.name}</div>
      <div style={{
        color: T.action, fontFamily: FONT.mono,
        fontSize: 14, marginBottom: 24, fontWeight: 600,
      }}>{formatEUR(product.price)}</div>

      {product.modGroups.map((group, gi) => {
        const isMulti = !group.required;
        return (
          <div key={gi} style={{ marginBottom: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <span style={{
                color: T.text, fontFamily: FONT.ui,
                fontSize: 14, fontWeight: 600, letterSpacing: '-0.01em',
              }}>{group.name}</span>
              {group.required ? (
                <span style={{
                  color: T.err, fontFamily: FONT.mono, fontSize: 9,
                  letterSpacing: '0.12em', textTransform: 'uppercase',
                  backgroundColor: T.errTint,
                  padding: '2px 7px', borderRadius: 4, fontWeight: 600,
                }}>Pflicht</span>
              ) : (
                <span style={{
                  color: T.textMute, fontFamily: FONT.mono, fontSize: 9,
                  letterSpacing: '0.12em', textTransform: 'uppercase', fontWeight: 500,
                }}>optional</span>
              )}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
              {group.options.map(opt => {
                const sel = selected[group.name];
                const isSelected = isMulti ? (sel || []).includes(opt.name) : sel === opt.name;
                return (
                  <button key={opt.name} onClick={() => handleSelect(group.name, opt.name, isMulti)} style={{
                    padding: '12px 14px', borderRadius: 8,
                    textAlign: 'left',
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    backgroundColor: isSelected ? T.actionTint : T.surfaceHi,
                    border: `1.5px solid ${isSelected ? T.action : T.border}`,
                    color: T.text, fontFamily: FONT.body, fontSize: 13, fontWeight: 500,
                    cursor: 'pointer',
                  }}>
                    <span>{opt.name}</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      {opt.price > 0 && (
                        <span style={{ color: T.action, fontFamily: FONT.mono, fontSize: 11, fontWeight: 500 }}>
                          +{formatEUR(opt.price)}
                        </span>
                      )}
                      {isSelected && <Check size={14} style={{ color: T.action }} />}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}

      <div style={{ marginBottom: 24 }}>
        <div style={{ marginBottom: 8 }}><Eyebrow>Notiz für die Küche</Eyebrow></div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
          {['ohne Knoblauch', 'sehr scharf', 'Allergie', 'kleine Portion'].map(q => (
            <button key={q} onClick={() => setNote(note ? `${note}, ${q}` : q)} style={{
              padding: '5px 11px', borderRadius: 14,
              backgroundColor: T.surfaceHi, color: T.textMute,
              border: `1px solid ${T.border}`,
              fontFamily: FONT.body, fontSize: 11, fontWeight: 500,
              cursor: 'pointer',
            }}>+ {q}</button>
          ))}
        </div>
        <input value={note} onChange={e => setNote(e.target.value)}
          placeholder="z.B. ‚ohne Salz, extra Zitrone'"
          style={{
            width: '100%', padding: '10px 14px', borderRadius: 8,
            backgroundColor: T.surfaceHi, border: `1px solid ${T.border}`,
            color: T.text, fontFamily: FONT.body, fontSize: 13, outline: 'none',
          }} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
        <button onClick={onClose} style={{
          padding: '14px', borderRadius: 10,
          backgroundColor: 'transparent', color: T.text,
          border: `1px solid ${T.border}`,
          fontFamily: FONT.ui, fontSize: 14, fontWeight: 600, cursor: 'pointer',
        }}>Abbrechen</button>
        <button onClick={handleConfirm} disabled={!canConfirm} style={{
          padding: '14px', borderRadius: 10,
          backgroundColor: T.action, color: T.surfaceTop, border: 'none',
          fontFamily: FONT.ui, fontSize: 14, fontWeight: 700,
          opacity: canConfirm ? 1 : 0.4,
          cursor: canConfirm ? 'pointer' : 'not-allowed',
          boxShadow: canConfirm ? `0 4px 12px rgba(230, 138, 44, 0.3)` : 'none',
        }}>Hinzufügen</button>
      </div>
    </Modal>
  );
}

function StornoModal({ itemName, onConfirm, onClose }) {
  const [reason, setReason] = useState(null);
  const [free, setFree] = useState('');
  return (
    <Modal onClose={onClose}>
      <div style={{ color: T.err, fontFamily: FONT.mono, fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase', fontWeight: 600, marginBottom: 8 }}>
        Storno · GoBD-pflichtig
      </div>
      <div style={{
        color: T.text, fontFamily: FONT.ui,
        fontSize: 22, fontWeight: 700, marginBottom: 2, letterSpacing: '-0.02em',
      }}>{itemName}</div>
      <div style={{ color: T.textMute, fontFamily: FONT.body, fontSize: 13, marginBottom: 20 }}>
        Grund für Storno wählen.
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 16 }}>
        {STORNO_REASONS.map(r => (
          <button key={r} onClick={() => setReason(r)} style={{
            width: '100%', textAlign: 'left', padding: '11px 14px', borderRadius: 8,
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            backgroundColor: reason === r ? T.errTint : T.surfaceHi,
            border: `1.5px solid ${reason === r ? T.err : T.border}`,
            color: T.text, fontFamily: FONT.body, fontSize: 13, fontWeight: 500,
            cursor: 'pointer',
          }}>
            <span>{r}</span>
            {reason === r && <Check size={14} style={{ color: T.err }} />}
          </button>
        ))}
      </div>

      {reason === 'Sonstiges' && (
        <input value={free} onChange={e => setFree(e.target.value)}
          placeholder="Grund eingeben…"
          style={{
            width: '100%', padding: '10px 14px', borderRadius: 8, marginBottom: 16,
            backgroundColor: T.surfaceHi, border: `1px solid ${T.border}`,
            color: T.text, fontFamily: FONT.body, fontSize: 13, outline: 'none',
          }} />
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
        <button onClick={onClose} style={{
          padding: '14px', borderRadius: 10,
          backgroundColor: 'transparent', color: T.text,
          border: `1px solid ${T.border}`,
          fontFamily: FONT.ui, fontSize: 14, fontWeight: 600, cursor: 'pointer',
        }}>Abbrechen</button>
        <button onClick={() => onConfirm(reason === 'Sonstiges' ? free : reason)}
          disabled={!reason || (reason === 'Sonstiges' && !free)}
          style={{
            padding: '14px', borderRadius: 10,
            backgroundColor: T.err, color: T.cream, border: 'none',
            fontFamily: FONT.ui, fontSize: 14, fontWeight: 700,
            opacity: (!reason || (reason === 'Sonstiges' && !free)) ? 0.4 : 1,
            cursor: 'pointer',
          }}>Stornieren</button>
      </div>
    </Modal>
  );
}

function PayBig({ icon: Icon, label, sub, primary, onClick }) {
  return (
    <button onClick={onClick} style={{
      padding: 18, borderRadius: 12,
      display: 'flex', alignItems: 'center', gap: 14,
      backgroundColor: primary ? T.action : T.surfaceHi,
      color: primary ? T.surfaceTop : T.text,
      border: primary ? 'none' : `1px solid ${T.border}`,
      boxShadow: primary ? `0 8px 24px rgba(230, 138, 44, 0.3)` : 'none',
      cursor: 'pointer', transition: 'all 0.12s',
    }}>
      <Icon size={28} strokeWidth={1.5} />
      <div style={{ textAlign: 'left' }}>
        <div style={{
          fontFamily: FONT.ui, fontSize: 18, fontWeight: 700, letterSpacing: '-0.02em',
        }}>{label}</div>
        <div style={{
          fontFamily: FONT.body, fontSize: 11,
          opacity: primary ? 0.75 : 1, color: primary ? T.surfaceTop : T.textMute,
          marginTop: 1,
        }}>{sub}</div>
      </div>
    </button>
  );
}

function PaySmall({ icon: Icon, label, onClick }) {
  return (
    <button onClick={onClick} style={{
      padding: '14px 8px', borderRadius: 10,
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
      backgroundColor: T.surfaceHi, color: T.text,
      border: `1px solid ${T.border}`,
      fontFamily: FONT.ui, fontSize: 11, fontWeight: 600,
      cursor: 'pointer',
    }}>
      <Icon size={18} />{label}
    </button>
  );
}

// ============ SETTINGS ============

function SettingsSidebar({ tab, onChange }) {
  const items = [
    { id: 'drucker', label: 'Drucker & Belege', icon: Printer },
    { id: 'belege', label: 'Bon-Verhalten', icon: QrCode },
    { id: 'coupons', label: 'Coupons', icon: Ticket },
    { id: 'sumup', label: 'SumUp Terminal', icon: CreditCard },
    { id: 'tse', label: 'TSE', icon: Shield },
    { id: 'modus', label: 'Modi & Counter', icon: Store },
    { id: 'tische', label: 'Tische & Bereiche', icon: MapPin },
    { id: 'sprache', label: 'Sprache', icon: Languages },
  ];
  return (
    <div style={{ width: 256, borderRight: `1px solid ${T.border}`, backgroundColor: T.surface, overflowY: 'auto' }}>
      <div style={{ padding: 18, borderBottom: `1px solid ${T.border}` }}>
        <Eyebrow>Einstellungen</Eyebrow>
      </div>
      <nav style={{ padding: 8 }}>
        {items.map(it => (
          <button key={it.id} onClick={() => onChange(it.id)} style={{
            width: '100%', textAlign: 'left',
            padding: '11px 14px', marginBottom: 2, borderRadius: 8,
            display: 'flex', alignItems: 'center', gap: 12,
            backgroundColor: tab === it.id ? T.surfaceHi : 'transparent',
            color: tab === it.id ? T.text : T.textMute,
            border: 'none', borderLeft: tab === it.id ? `2px solid ${T.action}` : '2px solid transparent',
            fontFamily: FONT.body, fontSize: 14, fontWeight: 500, cursor: 'pointer',
          }}><it.icon size={15} />{it.label}</button>
        ))}
      </nav>
    </div>
  );
}

function SettingsHeader({ title, subtitle }) {
  return (
    <div style={{ marginBottom: 32 }}>
      <div style={{
        color: T.action, fontFamily: FONT.mono,
        fontSize: 11, letterSpacing: '0.14em', textTransform: 'uppercase',
        fontWeight: 600, marginBottom: 8,
      }}>{subtitle}</div>
      <div style={{
        color: T.text, fontFamily: FONT.ui,
        fontSize: 40, fontWeight: 800, letterSpacing: '-0.03em', lineHeight: 1,
      }}>{title}</div>
    </div>
  );
}

function SettingsCard({ children }) {
  return (
    <div style={{
      padding: 24, borderRadius: 12, marginBottom: 12,
      backgroundColor: T.surface, border: `1px solid ${T.border}`,
    }}>{children}</div>
  );
}

function SettingsDrucker() {
  return (
    <div style={{ maxWidth: 640 }}>
      <SettingsHeader title="Drucker" subtitle="Bondrucker für Küche, Bar, Kassenbons" />
      {[
        { name: 'Bondrucker Theke', model: 'Epson TM-m30III · 192.168.1.42', routes: 'Kassenbons, Counter-Bons' },
        { name: 'Küchendrucker Heiß', model: 'Star TSP100 · 192.168.1.43', routes: 'Hauptgänge, Vorspeisen, Pizza' },
        { name: 'Bardrucker', model: 'Epson TM-m30II · 192.168.1.44', routes: 'Getränke, Spirituosen' },
      ].map((p, i) => (
        <SettingsCard key={i}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <div>
              <div style={{ color: T.text, fontFamily: FONT.ui, fontSize: 16, fontWeight: 600, letterSpacing: '-0.01em' }}>{p.name}</div>
              <div style={{ color: T.textMute, fontFamily: FONT.mono, fontSize: 11, marginTop: 4 }}>{p.model}</div>
              <div style={{ color: T.textMute, fontFamily: FONT.body, fontSize: 12, marginTop: 4 }}>
                Routing: <span style={{ color: T.text, fontWeight: 500 }}>{p.routes}</span>
              </div>
            </div>
            <StatusPill icon={Printer} label="Bereit" dot tone="ok" />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
            {['Test drucken', 'Routing', 'Einstellungen'].map(l => (
              <button key={l} style={{
                padding: '8px 0', borderRadius: 8,
                backgroundColor: T.surfaceHi, color: T.text,
                border: `1px solid ${T.border}`,
                fontFamily: FONT.ui, fontSize: 12, fontWeight: 500, cursor: 'pointer',
              }}>{l}</button>
            ))}
          </div>
        </SettingsCard>
      ))}
    </div>
  );
}

function SettingsBelege() {
  return (
    <div style={{ maxWidth: 640 }}>
      <SettingsHeader title="Bon-Verhalten" subtitle="Digital first · Druck auf Wunsch" />
      <SettingsCard>
        <div style={{ color: T.text, fontFamily: FONT.ui, fontSize: 16, fontWeight: 600, letterSpacing: '-0.01em', marginBottom: 8 }}>
          Standard-Bon-Versand
        </div>
        <div style={{ color: T.textMute, fontFamily: FONT.body, fontSize: 13, lineHeight: 1.55, marginBottom: 16 }}>
          Mise erfüllt die Bonpflicht digital. Drucker laufen nur wenn explizit gewünscht — spart Papier und ist customer-friendlier.
        </div>
        {[
          { name: 'QR-Code nach Zahlung anzeigen', desc: 'Gast scannt für digitalen Bon', on: true },
          { name: 'Automatischer Druck', desc: 'Bon druckt nach jeder Zahlung — NICHT empfohlen', on: false },
          { name: 'Auf Wunsch drucken', desc: 'Bon nur wenn Service-Mitarbeiter Knopf drückt', on: true },
          { name: 'Email-Versand anbieten', desc: 'Bon kann per Mail gesendet werden', on: true },
        ].map(s => (
          <div key={s.name} style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '14px 0', borderBottom: `1px solid ${T.border}`,
          }}>
            <div>
              <div style={{ color: T.text, fontFamily: FONT.ui, fontSize: 14, fontWeight: 600, letterSpacing: '-0.01em' }}>{s.name}</div>
              <div style={{ color: T.textMute, fontFamily: FONT.body, fontSize: 12, marginTop: 2 }}>{s.desc}</div>
            </div>
            <Toggle on={s.on} />
          </div>
        ))}
      </SettingsCard>

      <SettingsCard>
        <div style={{ color: T.text, fontFamily: FONT.ui, fontSize: 16, fontWeight: 600, letterSpacing: '-0.01em', marginBottom: 8 }}>
          Bon-Domain
        </div>
        <div style={{ color: T.textMute, fontFamily: FONT.body, fontSize: 13, lineHeight: 1.5, marginBottom: 12 }}>
          Wo QR-Codes hinverlinken. Bei eigener Domain wirkt der Bon professionell.
        </div>
        <div style={{
          padding: 12, borderRadius: 8,
          backgroundColor: T.bg, border: `1px solid ${T.border}`,
          fontFamily: FONT.mono, fontSize: 13, color: T.text,
        }}>bon.mise.app/r/&#123;txid&#125;</div>
      </SettingsCard>
    </div>
  );
}

function SettingsSumUp() {
  return (
    <div style={{ maxWidth: 640 }}>
      <SettingsHeader title="SumUp Terminal" subtitle="Kartenzahlung & native Integration" />
      <SettingsCard>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{
              width: 48, height: 48, borderRadius: 10,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              backgroundColor: 'rgba(34, 181, 176, 0.15)',
            }}><CreditCard size={24} style={{ color: '#22B5B0' }} /></div>
            <div>
              <div style={{ color: T.text, fontFamily: FONT.ui, fontSize: 18, fontWeight: 700, letterSpacing: '-0.01em' }}>SumUp Solo Lite</div>
              <div style={{ color: T.textMute, fontFamily: FONT.mono, fontSize: 11, marginTop: 2 }}>S/N: SU-44A7-2B91 · Bluetooth</div>
            </div>
          </div>
          <StatusPill icon={Wifi} label="Verbunden" dot tone="ok" />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
          <Stat label="Akku" value="84%" />
          <Stat label="Letzter Sync" value="22:41" />
          <Stat label="Heute" value="142,80 €" />
          <Stat label="Gebühr" value="0,79%" />
        </div>
      </SettingsCard>
    </div>
  );
}

function SettingsTSE() {
  return (
    <div style={{ maxWidth: 640 }}>
      <SettingsHeader title="TSE" subtitle="KassenSichV · fiskaly Cloud" />
      <SettingsCard>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <div>
            <div style={{ color: T.text, fontFamily: FONT.ui, fontSize: 18, fontWeight: 700, letterSpacing: '-0.01em' }}>fiskaly Cloud-TSE</div>
            <div style={{ color: T.textMute, fontFamily: FONT.mono, fontSize: 11, marginTop: 2 }}>S/N: FSK-2026-44A7B91 · BSI-zertifiziert</div>
          </div>
          <StatusPill icon={Shield} label="Aktiv" dot tone="ok" />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 }}>
          <Stat label="Signaturen heute" value="247" />
          <Stat label="Letzte Signatur" value="22:51:14" />
          <Stat label="Zertifikat gültig" value="bis 2031" />
          <Stat label="ELSTER" value="aktiv" />
        </div>
      </SettingsCard>
    </div>
  );
}

function SettingsTische() {
  return (
    <div style={{ maxWidth: 640 }}>
      <SettingsHeader title="Tische & Bereiche" subtitle="Drag-and-Drop Tischplan" />
      {AREAS.map(area => (
        <SettingsCard key={area.id}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ color: T.text, fontFamily: FONT.ui, fontSize: 16, fontWeight: 600, letterSpacing: '-0.01em' }}>{area.name}</div>
              <div style={{ color: T.textMute, fontFamily: FONT.body, fontSize: 12, marginTop: 4 }}>
                {ROOM_LAYOUT[area.id].length} Tische · {ROOM_LAYOUT[area.id].reduce((s, t) => s + t.seats, 0)} Plätze
              </div>
            </div>
            <button style={{
              padding: '8px 14px', borderRadius: 8,
              backgroundColor: T.surfaceHi, color: T.text,
              border: `1px solid ${T.border}`,
              fontFamily: FONT.ui, fontSize: 12, fontWeight: 500, cursor: 'pointer',
            }}>Plan bearbeiten</button>
          </div>
        </SettingsCard>
      ))}
    </div>
  );
}

function SettingsModus() {
  return (
    <div style={{ maxWidth: 640 }}>
      <SettingsHeader title="Modi & Counter" subtitle="Tisch-Service vs. Schnellverkauf" />
      <SettingsCard>
        {[
          { name: 'Tisch-Service', desc: 'Tischplan, Gänge, Splitten, Bonierung', on: true },
          { name: 'Counter / Schnellverkauf', desc: 'Direkt-Kassieren, Pager-System, Hier/Mitnehmen', on: true },
        ].map(m => (
          <div key={m.name} style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '14px 0', borderBottom: `1px solid ${T.border}`,
          }}>
            <div>
              <div style={{ color: T.text, fontFamily: FONT.ui, fontSize: 14, fontWeight: 600, letterSpacing: '-0.01em' }}>{m.name}</div>
              <div style={{ color: T.textMute, fontFamily: FONT.body, fontSize: 12, marginTop: 2 }}>{m.desc}</div>
            </div>
            <Toggle on={m.on} />
          </div>
        ))}
      </SettingsCard>
    </div>
  );
}

function SettingsSprache() {
  const [lang, setLang] = useState('de');
  return (
    <div style={{ maxWidth: 640 }}>
      <SettingsHeader title="Sprache" subtitle="UI-Sprache pro Mitarbeiter" />
      <SettingsCard>
        {[
          { code: 'de', native: 'Deutsch' }, { code: 'en', native: 'English' },
          { code: 'tr', native: 'Türkçe' }, { code: 'ar', native: 'العربية' },
          { code: 'pl', native: 'Polski' }, { code: 'it', native: 'Italiano' },
        ].map(l => (
          <button key={l.code} onClick={() => setLang(l.code)} style={{
            width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '12px 14px', marginBottom: 6, borderRadius: 8,
            backgroundColor: lang === l.code ? T.actionTint : T.surfaceHi,
            border: `1.5px solid ${lang === l.code ? T.action : T.border}`,
            color: T.text, fontFamily: FONT.body, fontSize: 14, fontWeight: 500, cursor: 'pointer',
          }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ fontFamily: FONT.mono, fontSize: 11, color: T.textMute, minWidth: 28 }}>{l.code.toUpperCase()}</span>
              <span>{l.native}</span>
            </span>
            {lang === l.code && <Check size={16} style={{ color: T.action }} />}
          </button>
        ))}
      </SettingsCard>
    </div>
  );
}

function Toggle({ on, onClick }) {
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag onClick={onClick} style={{
      width: 40, height: 24, borderRadius: 12,
      display: 'flex', alignItems: 'center', padding: 2,
      backgroundColor: on ? T.action : T.borderHi,
      justifyContent: on ? 'flex-end' : 'flex-start',
      transition: 'background-color 0.15s',
      border: 'none', cursor: onClick ? 'pointer' : 'default',
    }}>
      <div style={{ width: 20, height: 20, borderRadius: '50%', backgroundColor: T.cream }} />
    </Tag>
  );
}

// ============ COUPON SLOT (im Cart) ============

function CouponSlot({ coupon, onScan, onRemove, discount }) {
  if (!coupon) {
    return (
      <button onClick={onScan} style={{
        width: '100%', padding: '11px 14px', borderRadius: 10, marginBottom: 12,
        backgroundColor: 'transparent',
        border: `1.5px dashed ${T.action}`,
        color: T.action,
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
        cursor: 'pointer', transition: 'all 0.15s',
        fontFamily: FONT.ui, fontSize: 13, fontWeight: 600, letterSpacing: '-0.01em',
      }}>
        <ScanLine size={15} /> QR-Coupon scannen
      </button>
    );
  }

  const typeLabels = {
    percentage: `−${coupon.value}%`,
    fixed: `−${formatEUR(coupon.value)}`,
    free_product: 'GRATIS',
  };
  const typeIcons = { percentage: Percent, fixed: Tag, free_product: Gift };
  const Icon = typeIcons[coupon.type];

  return (
    <div style={{
      padding: '11px 14px', borderRadius: 10, marginBottom: 12,
      backgroundColor: T.actionTint,
      border: `1.5px solid ${T.action}`,
      display: 'flex', alignItems: 'center', gap: 10,
    }}>
      <div style={{
        width: 36, height: 36, borderRadius: 8,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        backgroundColor: T.action, color: T.surfaceTop, flexShrink: 0,
      }}>
        <Icon size={18} strokeWidth={2.5} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          color: T.text, fontFamily: FONT.ui,
          fontSize: 13, fontWeight: 600, letterSpacing: '-0.01em', marginBottom: 1,
        }}>{coupon.name}</div>
        <div style={{
          color: T.action, fontFamily: FONT.mono,
          fontSize: 11, fontWeight: 600, letterSpacing: '0.04em',
        }}>{typeLabels[coupon.type]} · spart {formatEUR(discount)}</div>
      </div>
      <button onClick={onRemove} style={{
        width: 28, height: 28, borderRadius: 6,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        backgroundColor: 'transparent', color: T.action,
        border: 'none', cursor: 'pointer',
      }}>
        <X size={14} />
      </button>
    </div>
  );
}

// ============ COUPON SCANNER MODAL ============

function CouponScannerModal({ coupons, context, subtotal, onScan, onClose }) {
  const [stage, setStage] = useState('scanning');
  const [manualCode, setManualCode] = useState('');
  const activeCoupons = coupons.filter(c => c.active);

  return (
    <div style={{
      position: 'fixed', inset: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.85)', backdropFilter: 'blur(12px)',
      zIndex: 60,
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
    }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{
        width: '100%', maxWidth: 560,
        backgroundColor: T.surface, border: `1px solid ${T.border}`,
        borderRadius: 16, padding: 32,
        boxShadow: '0 24px 64px rgba(0, 0, 0, 0.6)',
        maxHeight: '92vh', overflowY: 'auto',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
          <Eyebrow>QR-Coupon scannen</Eyebrow>
          <button onClick={onClose} style={{
            width: 32, height: 32, borderRadius: '50%',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            backgroundColor: T.surfaceHi, color: T.textMute,
            border: `1px solid ${T.border}`, cursor: 'pointer',
          }}><X size={16} /></button>
        </div>

        {stage === 'scanning' && (
          <>
            <div style={{
              position: 'relative',
              width: '100%', paddingBottom: '70%',
              backgroundColor: T.surfaceTop, borderRadius: 12,
              marginBottom: 20, overflow: 'hidden',
              border: `1px solid ${T.border}`,
            }}>
              <div style={{
                position: 'absolute', inset: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexDirection: 'column',
              }}>
                <div style={{
                  width: '60%', aspectRatio: '1',
                  border: `2px solid ${T.action}`,
                  borderRadius: 16, position: 'relative', overflow: 'hidden',
                }}>
                  {[
                    { top: -2, left: -2, borderTop: `4px solid ${T.action}`, borderLeft: `4px solid ${T.action}` },
                    { top: -2, right: -2, borderTop: `4px solid ${T.action}`, borderRight: `4px solid ${T.action}` },
                    { bottom: -2, left: -2, borderBottom: `4px solid ${T.action}`, borderLeft: `4px solid ${T.action}` },
                    { bottom: -2, right: -2, borderBottom: `4px solid ${T.action}`, borderRight: `4px solid ${T.action}` },
                  ].map((s, i) => (
                    <div key={i} style={{ position: 'absolute', width: 20, height: 20, ...s }} />
                  ))}
                  <div style={{
                    position: 'absolute', left: 0, right: 0, height: 2,
                    backgroundColor: T.action,
                    boxShadow: `0 0 16px ${T.action}`,
                    animation: 'miseScanLine 2s linear infinite',
                  }} />
                  <style>{`
                    @keyframes miseScanLine {
                      0% { top: 0; }
                      50% { top: 100%; }
                      100% { top: 0; }
                    }
                  `}</style>
                </div>
                <div style={{
                  marginTop: 16,
                  color: T.text, fontFamily: FONT.ui,
                  fontSize: 14, fontWeight: 600, letterSpacing: '-0.01em',
                }}>Coupon im Rahmen positionieren</div>
                <div style={{
                  marginTop: 4, color: T.textMute, fontFamily: FONT.body, fontSize: 12,
                }}>Kamera des Gastes auf Scanner halten</div>
              </div>
            </div>

            <div style={{
              marginBottom: 16, padding: '10px 14px',
              backgroundColor: T.bg, borderRadius: 8,
              border: `1px dashed ${T.borderHi}`,
            }}>
              <div style={{
                color: T.textMute, fontFamily: FONT.mono,
                fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase',
                fontWeight: 500, marginBottom: 8,
              }}>— Demo: Coupon simulieren</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {activeCoupons.map(c => {
                  const ineligible = c.minOrder && subtotal < c.minOrder;
                  return (
                    <button key={c.id} onClick={() => onScan(c.code)} style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
                      padding: '8px 10px', borderRadius: 6,
                      backgroundColor: ineligible ? 'transparent' : T.surfaceHi,
                      border: `1px solid ${T.border}`,
                      cursor: 'pointer', textAlign: 'left',
                      opacity: ineligible ? 0.4 : 1,
                    }}>
                      <div>
                        <div style={{ color: T.text, fontFamily: FONT.ui, fontSize: 12, fontWeight: 600 }}>{c.name}</div>
                        <div style={{ color: T.textMute, fontFamily: FONT.mono, fontSize: 10, marginTop: 1 }}>
                          {c.code}{ineligible && ` · min. ${formatEUR(c.minOrder)}`}
                        </div>
                      </div>
                      <ChevronRight size={14} style={{ color: T.textMute }} />
                    </button>
                  );
                })}
              </div>
            </div>

            <button onClick={() => setStage('manual')} style={{
              width: '100%', padding: 12, borderRadius: 8,
              backgroundColor: T.surfaceHi, color: T.text,
              border: `1px solid ${T.border}`, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              fontFamily: FONT.ui, fontSize: 13, fontWeight: 500,
            }}>
              <Edit3 size={14} /> Code manuell eingeben
            </button>
          </>
        )}

        {stage === 'manual' && (
          <div>
            <div style={{
              color: T.text, fontFamily: FONT.ui,
              fontSize: 20, fontWeight: 700, letterSpacing: '-0.02em', marginBottom: 6,
            }}>Coupon-Code eingeben</div>
            <div style={{ color: T.textMute, fontFamily: FONT.body, fontSize: 13, marginBottom: 20 }}>
              Falls QR nicht scannbar. Code steht auf Coupon/Email.
            </div>

            <input value={manualCode} onChange={e => setManualCode(e.target.value.toUpperCase())}
              placeholder="MISE-XXXXX" autoFocus
              style={{
                width: '100%', padding: '14px 16px', borderRadius: 10, marginBottom: 16,
                backgroundColor: T.surfaceHi, border: `1px solid ${T.border}`,
                color: T.text, fontFamily: FONT.mono, fontSize: 16,
                letterSpacing: '0.06em', textTransform: 'uppercase', outline: 'none',
              }} />

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
              <button onClick={() => setStage('scanning')} style={{
                padding: '14px', borderRadius: 10,
                backgroundColor: 'transparent', color: T.text,
                border: `1px solid ${T.border}`,
                fontFamily: FONT.ui, fontSize: 14, fontWeight: 600, cursor: 'pointer',
              }}>Zurück zum Scanner</button>
              <button onClick={() => onScan(manualCode)} disabled={!manualCode} style={{
                padding: '14px', borderRadius: 10,
                backgroundColor: T.action, color: T.surfaceTop, border: 'none',
                fontFamily: FONT.ui, fontSize: 14, fontWeight: 700,
                opacity: manualCode ? 1 : 0.4,
                cursor: manualCode ? 'pointer' : 'not-allowed',
                boxShadow: manualCode ? `0 4px 12px rgba(230, 138, 44, 0.3)` : 'none',
              }}>Einlösen</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ============ SETTINGS COUPONS ============

function SettingsCoupons({ coupons, setCoupons, editingCoupon, setEditingCoupon, showNewCoupon, setShowNewCoupon, onToast }) {
  const toggleActive = (id) => {
    setCoupons(prev => prev.map(c => c.id === id ? { ...c, active: !c.active } : c));
  };

  const deleteCoupon = (id) => {
    setCoupons(prev => prev.filter(c => c.id !== id));
    onToast('Coupon gelöscht', 'warn');
  };

  const copyCode = (code) => {
    if (navigator.clipboard) navigator.clipboard.writeText(code);
    onToast(`Code kopiert: ${code}`, 'ok');
  };

  return (
    <div style={{ maxWidth: 800 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 32 }}>
        <div>
          <div style={{
            color: T.action, fontFamily: FONT.mono,
            fontSize: 11, letterSpacing: '0.14em', textTransform: 'uppercase',
            fontWeight: 600, marginBottom: 8,
          }}>Stammkunden-Bonus · QR-System</div>
          <div style={{
            color: T.text, fontFamily: FONT.ui,
            fontSize: 40, fontWeight: 800, letterSpacing: '-0.03em', lineHeight: 1,
          }}>Coupons</div>
        </div>
        <button onClick={() => setShowNewCoupon(true)} style={{
          padding: '12px 18px', borderRadius: 10,
          backgroundColor: T.action, color: T.surfaceTop,
          border: 'none', cursor: 'pointer',
          fontFamily: FONT.ui, fontSize: 14, fontWeight: 700, letterSpacing: '-0.01em',
          display: 'flex', alignItems: 'center', gap: 8,
          boxShadow: `0 4px 12px rgba(230, 138, 44, 0.25)`,
        }}>
          <Plus size={16} /> Neuer Coupon
        </button>
      </div>

      <div style={{ marginBottom: 24 }}>
        <div style={{
          padding: '14px 18px', borderRadius: 10,
          backgroundColor: T.surface, border: `1px solid ${T.border}`,
          display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16,
        }}>
          <Stat label="Aktive Coupons" value={coupons.filter(c => c.active).length} />
          <Stat label="Heute eingelöst" value="34" />
          <Stat label="Diese Woche" value="218" />
          <Stat label="Umsatz mit Coupon" value="2.184 €" />
        </div>
      </div>

      <Eyebrow>Alle Coupons</Eyebrow>
      <div style={{ marginTop: 12 }}>
        {coupons.map(coupon => (
          <CouponRow key={coupon.id} coupon={coupon}
            onToggle={() => toggleActive(coupon.id)}
            onEdit={() => setEditingCoupon(coupon)}
            onDelete={() => deleteCoupon(coupon.id)}
            onCopy={() => copyCode(coupon.code)} />
        ))}
      </div>

      {(showNewCoupon || editingCoupon) && (
        <CouponEditor coupon={editingCoupon}
          onSave={(data) => {
            if (editingCoupon) {
              setCoupons(prev => prev.map(c => c.id === editingCoupon.id ? { ...c, ...data } : c));
              onToast('Coupon aktualisiert', 'ok');
              setEditingCoupon(null);
            } else {
              setCoupons(prev => [...prev, { ...data, id: `cp_${Date.now()}`, usageCount: 0 }]);
              onToast('Coupon erstellt', 'ok');
              setShowNewCoupon(false);
            }
          }}
          onClose={() => { setEditingCoupon(null); setShowNewCoupon(false); }} />
      )}
    </div>
  );
}

function CouponRow({ coupon, onToggle, onEdit, onDelete, onCopy }) {
  const typeLabels = {
    percentage: `−${coupon.value}%`,
    fixed: `−${formatEUR(coupon.value)}`,
    free_product: 'GRATIS',
  };
  const typeIcons = { percentage: Percent, fixed: Tag, free_product: Gift };
  const Icon = typeIcons[coupon.type];

  return (
    <div style={{
      padding: 16, borderRadius: 12, marginBottom: 8,
      backgroundColor: T.surface, border: `1px solid ${T.border}`,
      opacity: coupon.active ? 1 : 0.55,
      display: 'flex', alignItems: 'center', gap: 16,
    }}>
      <div style={{
        width: 48, height: 48, borderRadius: 10,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        backgroundColor: coupon.active ? coupon.color : T.surfaceHi,
        color: coupon.active ? T.surfaceTop : T.textMute, flexShrink: 0,
      }}>
        <Icon size={22} strokeWidth={2.5} />
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
          <span style={{
            color: T.text, fontFamily: FONT.ui,
            fontSize: 15, fontWeight: 700, letterSpacing: '-0.01em',
          }}>{coupon.name}</span>
          <span style={{
            padding: '2px 8px', borderRadius: 4,
            backgroundColor: coupon.active ? T.actionTint : T.surfaceHi,
            color: coupon.active ? T.action : T.textMute,
            fontFamily: FONT.mono, fontSize: 10, fontWeight: 600, letterSpacing: '0.06em',
          }}>{typeLabels[coupon.type]}</span>
        </div>
        <div style={{ color: T.textMute, fontFamily: FONT.body, fontSize: 12, marginBottom: 4 }}>
          {coupon.description}
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          <button onClick={onCopy} style={{
            display: 'flex', alignItems: 'center', gap: 4,
            color: T.textMute, fontFamily: FONT.mono, fontSize: 10, letterSpacing: '0.06em',
            background: 'none', border: 'none', cursor: 'pointer', padding: 0,
          }}>
            <Copy size={10} /> {coupon.code}
          </button>
          <span style={{ color: T.textDim, fontFamily: FONT.mono, fontSize: 10 }}>
            {coupon.usageCount}× eingelöst{coupon.usageLimit && ` von ${coupon.usageLimit}`}
          </span>
        </div>
      </div>

      <Toggle on={coupon.active} onClick={onToggle} />

      <button onClick={onEdit} style={{
        width: 36, height: 36, borderRadius: 8,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        backgroundColor: T.surfaceHi, color: T.text,
        border: `1px solid ${T.border}`, cursor: 'pointer',
      }}><Edit3 size={14} /></button>

      <button onClick={onDelete} style={{
        width: 36, height: 36, borderRadius: 8,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        backgroundColor: T.surfaceHi, color: T.err,
        border: `1px solid ${T.border}`, cursor: 'pointer',
      }}><Trash size={14} /></button>
    </div>
  );
}

function CouponEditor({ coupon, onSave, onClose }) {
  const initialForm = coupon ? {
    ...coupon,
    value: coupon.type === 'fixed' ? coupon.value / 100 : coupon.value,
    minOrder: coupon.minOrder / 100,
  } : {
    name: '', description: '', code: 'MISE-',
    type: 'percentage', value: 10, minOrder: 0,
    validUntil: '2026-12-31', active: true,
    usageLimit: null, productId: '', color: T.action,
  };
  const [form, setForm] = useState(initialForm);

  const isValid = form.name && form.code && (
    (form.type === 'percentage' && form.value > 0 && form.value <= 100) ||
    (form.type === 'fixed' && form.value > 0) ||
    (form.type === 'free_product' && form.productId)
  );

  const handleSave = () => {
    let value = form.value;
    if (form.type === 'fixed') value = Math.round(form.value * 100);
    let minOrder = Math.round(form.minOrder * 100);
    onSave({ ...form, value, minOrder });
  };

  const inputStyle = {
    width: '100%', padding: '12px 14px', borderRadius: 10,
    backgroundColor: T.surfaceHi, border: `1px solid ${T.border}`,
    color: T.text, fontFamily: FONT.body, fontSize: 14, outline: 'none',
  };

  return (
    <div style={{
      position: 'fixed', inset: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.7)', backdropFilter: 'blur(8px)',
      zIndex: 60,
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
    }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{
        width: '100%', maxWidth: 600,
        backgroundColor: T.surface, border: `1px solid ${T.border}`,
        borderRadius: 16, padding: 32,
        maxHeight: '92vh', overflowY: 'auto',
        boxShadow: '0 24px 64px rgba(0, 0, 0, 0.5)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
          <Eyebrow>{coupon ? 'Coupon bearbeiten' : 'Neuer Coupon'}</Eyebrow>
          <button onClick={onClose} style={{
            width: 32, height: 32, borderRadius: '50%',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            backgroundColor: T.surfaceHi, color: T.textMute,
            border: `1px solid ${T.border}`, cursor: 'pointer',
          }}><X size={16} /></button>
        </div>

        <FormGroup label="Name (interne Übersicht)">
          <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
            placeholder="z.B. Willkommen-Rabatt" style={inputStyle} />
        </FormGroup>

        <FormGroup label="Beschreibung (für Gäste & Service)">
          <input value={form.description} onChange={e => setForm({ ...form, description: e.target.value })}
            placeholder="z.B. 10% auf gesamte Rechnung" style={inputStyle} />
        </FormGroup>

        <FormGroup label="QR-Code">
          <input value={form.code} onChange={e => setForm({ ...form, code: e.target.value.toUpperCase() })}
            placeholder="MISE-XXXXX"
            style={{ ...inputStyle, fontFamily: FONT.mono, letterSpacing: '0.06em' }} />
        </FormGroup>

        <FormGroup label="Coupon-Typ">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
            {[
              { id: 'percentage', icon: Percent, label: 'Prozent-Rabatt', sub: 'z.B. 10%' },
              { id: 'fixed', icon: Tag, label: 'Festbetrag', sub: 'z.B. 5 €' },
              { id: 'free_product', icon: Gift, label: 'Gratis-Produkt', sub: 'z.B. Espresso' },
            ].map(t => (
              <button key={t.id} onClick={() => setForm({ ...form, type: t.id })} style={{
                padding: 14, borderRadius: 10,
                backgroundColor: form.type === t.id ? T.actionTint : T.surfaceHi,
                border: `1.5px solid ${form.type === t.id ? T.action : T.border}`,
                color: T.text, cursor: 'pointer',
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
              }}>
                <t.icon size={18} style={{ color: form.type === t.id ? T.action : T.textMute }} />
                <span style={{ fontFamily: FONT.ui, fontSize: 12, fontWeight: 600, letterSpacing: '-0.01em' }}>{t.label}</span>
                <span style={{ color: T.textMute, fontFamily: FONT.body, fontSize: 10 }}>{t.sub}</span>
              </button>
            ))}
          </div>
        </FormGroup>

        {form.type === 'percentage' && (
          <FormGroup label="Rabatt in %">
            <input type="number" value={form.value}
              onChange={e => setForm({ ...form, value: parseInt(e.target.value) || 0 })}
              min="1" max="100" style={inputStyle} />
          </FormGroup>
        )}

        {form.type === 'fixed' && (
          <FormGroup label="Rabatt in €">
            <input type="number" value={form.value}
              onChange={e => setForm({ ...form, value: parseFloat(e.target.value) || 0 })}
              min="0.01" step="0.50" style={inputStyle} />
          </FormGroup>
        )}

        {form.type === 'free_product' && (
          <FormGroup label="Gratis-Produkt">
            <select value={form.productId} onChange={e => setForm({ ...form, productId: e.target.value })}
              style={{ ...inputStyle, appearance: 'none' }}>
              <option value="">— Produkt wählen —</option>
              {Object.values(PRODUCTS).flat().map(p => (
                <option key={p.id} value={p.id}>{p.name} ({formatEUR(p.price)})</option>
              ))}
            </select>
          </FormGroup>
        )}

        <FormGroup label="Mindestbestellwert in € (0 = kein Limit)">
          <input type="number" value={form.minOrder}
            onChange={e => setForm({ ...form, minOrder: parseFloat(e.target.value) || 0 })}
            min="0" step="1" style={inputStyle} />
        </FormGroup>

        <FormGroup label="Gültig bis">
          <input type="date" value={form.validUntil}
            onChange={e => setForm({ ...form, validUntil: e.target.value })} style={inputStyle} />
        </FormGroup>

        <FormGroup label="Max. Einlösungen (leer = unbegrenzt)">
          <input type="number" value={form.usageLimit || ''}
            onChange={e => setForm({ ...form, usageLimit: e.target.value ? parseInt(e.target.value) : null })}
            placeholder="unbegrenzt" style={inputStyle} />
        </FormGroup>

        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '12px 16px', borderRadius: 10, marginBottom: 20,
          backgroundColor: T.surfaceHi, border: `1px solid ${T.border}`,
        }}>
          <div>
            <div style={{ color: T.text, fontFamily: FONT.ui, fontSize: 13, fontWeight: 600 }}>Coupon aktiv</div>
            <div style={{ color: T.textMute, fontFamily: FONT.body, fontSize: 11, marginTop: 2 }}>
              Inaktive Coupons können nicht eingelöst werden
            </div>
          </div>
          <Toggle on={form.active} onClick={() => setForm({ ...form, active: !form.active })} />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 8 }}>
          <button onClick={onClose} style={{
            padding: '14px', borderRadius: 10,
            backgroundColor: 'transparent', color: T.text,
            border: `1px solid ${T.border}`,
            fontFamily: FONT.ui, fontSize: 14, fontWeight: 600, cursor: 'pointer',
          }}>Abbrechen</button>
          <button onClick={handleSave} disabled={!isValid} style={{
            padding: '14px', borderRadius: 10,
            backgroundColor: T.action, color: T.surfaceTop, border: 'none',
            fontFamily: FONT.ui, fontSize: 14, fontWeight: 700,
            opacity: isValid ? 1 : 0.4,
            cursor: isValid ? 'pointer' : 'not-allowed',
            boxShadow: isValid ? `0 4px 12px rgba(230, 138, 44, 0.3)` : 'none',
          }}>{coupon ? 'Speichern' : 'Coupon erstellen'}</button>
        </div>
      </div>
    </div>
  );
}

function FormGroup({ label, children }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{
        color: T.textMute, fontFamily: FONT.mono,
        fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase',
        fontWeight: 500, marginBottom: 6,
      }}>{label}</div>
      {children}
    </div>
  );
}
