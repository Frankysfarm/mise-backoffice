/**
 * Mise Format-Helpers
 *
 * Konsistente Formatierung über das ganze System.
 * Alle Preise sind in CENTS gespeichert (BigInt-safe) — NIEMALS Float-Euro.
 */

/**
 * Formatiert Cents als deutsches Euro-Format.
 * @param {number} cents — Betrag in Cents (z.B. 990 = 9,90 €)
 * @returns {string} — z.B. "9,90 €"
 */
export const formatEUR = (cents) =>
  `${(cents / 100).toFixed(2).replace('.', ',')} €`;

/**
 * Formatiert große Beträge mit Tausendertrennzeichen.
 * @param {number} cents
 * @returns {string} — z.B. "1.245,80 €"
 */
export const formatEURLarge = (cents) => {
  const euros = (cents / 100).toFixed(2).replace('.', ',');
  const [int, dec] = euros.split(',');
  const intFormatted = int.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${intFormatted},${dec} €`;
};

/**
 * Aktuelle Uhrzeit in HH:MM (24h, deutsches Format).
 * @returns {string} — z.B. "23:14"
 */
export const formatTime = () => {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

/**
 * Uhrzeit mit Sekunden (z.B. für TSE-Logs).
 * @returns {string} — z.B. "23:14:08"
 */
export const formatTimeWithSeconds = () => {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`;
};

/**
 * Datum kurz im deutschen Format.
 * @param {Date} date
 * @returns {string} — z.B. "17.05.2026"
 */
export const formatDate = (date) => {
  const d = date instanceof Date ? date : new Date(date);
  return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()}`;
};

/**
 * Generiert eine eindeutige Transaction-ID im Mise-Format.
 * @returns {string} — z.B. "MISE-LXNF8QZ4"
 */
export const generateTransactionId = () =>
  `MISE-${Date.now().toString(36).toUpperCase()}`;

/**
 * Berechnet Item-Gesamtpreis inkl. Modifier-Aufpreise.
 * @param {Object} item — { price, qty, extra }
 * @returns {number} — Cents
 */
export const calcItemTotal = (item) =>
  (item.price + (item.extra || 0)) * item.qty;

/**
 * Berechnet Order-Gesamtpreis.
 * @param {Array} items
 * @returns {number} — Cents
 */
export const calcOrderTotal = (items) =>
  items.reduce((sum, item) => sum + calcItemTotal(item), 0);

/**
 * Berechnet Coupon-Rabatt.
 * Unterstützt percentage, fixed, free_product.
 * @param {Object|null} coupon
 * @param {number} subtotal — Cents
 * @param {Function} findProduct — Lookup-Function für free_product
 * @returns {number} — Rabatt in Cents
 */
export const calcCouponDiscount = (coupon, subtotal, findProduct) => {
  if (!coupon) return 0;
  if (coupon.minOrder && subtotal < coupon.minOrder) return 0;
  if (coupon.type === 'percentage') {
    return Math.round(subtotal * coupon.value / 100);
  }
  if (coupon.type === 'fixed') {
    return Math.min(coupon.value, subtotal);
  }
  if (coupon.type === 'free_product') {
    const product = findProduct(coupon.productId);
    return product ? product.price : 0;
  }
  return 0;
};

/**
 * Berechnet MwSt-Splits für gemischte Carts (Speisen 7%, Getränke 19%).
 * @param {Array} items — mit isFood-Flag pro Item
 * @returns {Object} — { net7, tax7, net19, tax19 }
 */
export const calcTaxSplit = (items) => {
  let net7 = 0, tax7 = 0, net19 = 0, tax19 = 0;
  items.forEach(item => {
    const rate = item.isFood ? 7 : 19;
    const gross = calcItemTotal(item);
    const net = Math.round(gross / (1 + rate / 100));
    const tax = gross - net;
    if (rate === 7) { net7 += net; tax7 += tax; }
    else { net19 += net; tax19 += tax; }
  });
  return { net7, tax7, net19, tax19 };
};

/**
 * BigInt-safe Adapter für Mise-DB-Werte aus numeric(10,2) Spalten.
 * Akzeptiert Float-Euro (z.B. 9.90), konvertiert via Cents zu BigInt-format.
 * Verwende DIESEN statt formatEUR() für Werte aus customer_orders.gesamtbetrag etc.
 *
 * @param {number | string | null | undefined} euro
 * @returns {string} formatiertes Euro im DE-Format mit Komma + €
 */
export const formatEURfromNumeric = (euro) => {
  if (euro == null) return "0,00 €";
  const cents = Math.round(Number(euro) * 100);
  return formatEUR(cents);
};
