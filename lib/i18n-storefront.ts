/**
 * Leichtgewichtige i18n für die Storefront.
 * Keine Library — nur Dictionary + Hook.
 */

export type Locale = 'de' | 'en' | 'tr' | 'ar';

export const LOCALES: { id: Locale; label: string; flag: string }[] = [
  { id: 'de', label: 'Deutsch', flag: '🇩🇪' },
  { id: 'en', label: 'English', flag: '🇬🇧' },
  { id: 'tr', label: 'Türkçe',  flag: '🇹🇷' },
  { id: 'ar', label: 'العربية', flag: '🇦🇪' },
];

export const T: Record<Locale, Record<string, string>> = {
  de: {
    'hero.meta.min': 'ab {min}€ Bestellwert',
    'hero.meta.items': '{n} Gerichte auf der Karte',
    'hero.meta.open': 'bis {time} Uhr geöffnet',
    'hero.meta.closed': 'Aktuell geschlossen',
    'hero.meta.rating': '4,9 (312 Bewertungen)',
    'hero.popular_pill': '{n} Favoriten der Gäste',
    'hero.order_abholung': 'Abholung',
    'hero.order_lieferung': 'Lieferung',
    'popular.title': 'Beliebt',
    'cart.empty': 'Noch leer — starte mit einem Klassiker.',
    'cart.subtotal': 'Zwischensumme',
    'cart.delivery_fee': 'Liefergebühr',
    'cart.total': 'Gesamt',
    'cart.checkout': 'Zur Kasse',
    'cart.min_order': 'Mindestbestellwert {min} €',
    'checkout.step.address': 'Adresse',
    'checkout.step.contact': 'Kontakt',
    'checkout.step.payment': 'Bezahlen',
    'checkout.back': 'Zurück',
    'checkout.next': 'Weiter',
    'checkout.submit': 'Jetzt bestellen',
    'checkout.submitting': 'Wird aufgegeben …',
    'checkout.marketing_optin': 'Ja, ich möchte gelegentlich Rabatte und Aktionen per E-Mail.',
    'checkout.privacy_note': 'Wir nutzen deine Daten nur für diese Bestellung.',
    'success.headline': 'Bestellung aufgegeben!',
    'success.eta_delivery': 'Lieferung in etwa {min} Minuten',
    'success.eta_pickup': 'Abholung in etwa {min} Minuten',
    'success.track': 'Bestellung live verfolgen',
    'success.new': 'Neue Bestellung starten',
  },
  en: {
    'hero.meta.min': 'from €{min} order value',
    'hero.meta.items': '{n} dishes on the menu',
    'hero.meta.open': 'open until {time}',
    'hero.meta.closed': 'Currently closed',
    'hero.meta.rating': '4.9 (312 reviews)',
    'hero.popular_pill': '{n} guest favorites',
    'hero.order_abholung': 'Pickup',
    'hero.order_lieferung': 'Delivery',
    'popular.title': 'Popular',
    'cart.empty': 'Empty — start with a classic.',
    'cart.subtotal': 'Subtotal',
    'cart.delivery_fee': 'Delivery fee',
    'cart.total': 'Total',
    'cart.checkout': 'Checkout',
    'cart.min_order': 'Minimum order €{min}',
    'checkout.step.address': 'Address',
    'checkout.step.contact': 'Contact',
    'checkout.step.payment': 'Payment',
    'checkout.back': 'Back',
    'checkout.next': 'Next',
    'checkout.submit': 'Place order',
    'checkout.submitting': 'Placing …',
    'checkout.marketing_optin': 'Yes, send me deals and specials by email.',
    'checkout.privacy_note': 'We use your data only for this order.',
    'success.headline': 'Order placed!',
    'success.eta_delivery': 'Delivery in about {min} minutes',
    'success.eta_pickup': 'Pickup in about {min} minutes',
    'success.track': 'Track order live',
    'success.new': 'Start new order',
  },
  tr: {
    'hero.meta.min': 'sipariş tutarı {min}€ üzeri',
    'hero.meta.items': 'menüde {n} yemek',
    'hero.meta.open': '{time}\'ye kadar açık',
    'hero.meta.closed': 'Şu anda kapalı',
    'hero.meta.rating': '4,9 (312 değerlendirme)',
    'hero.popular_pill': '{n} misafir favorisi',
    'hero.order_abholung': 'Alma',
    'hero.order_lieferung': 'Teslimat',
    'popular.title': 'Popüler',
    'cart.empty': 'Boş — bir klasikle başla.',
    'cart.subtotal': 'Ara toplam',
    'cart.delivery_fee': 'Teslimat ücreti',
    'cart.total': 'Toplam',
    'cart.checkout': 'Kasaya',
    'cart.min_order': 'Min. sipariş {min} €',
    'checkout.step.address': 'Adres',
    'checkout.step.contact': 'İletişim',
    'checkout.step.payment': 'Ödeme',
    'checkout.back': 'Geri',
    'checkout.next': 'İleri',
    'checkout.submit': 'Sipariş ver',
    'checkout.submitting': 'Gönderiliyor …',
    'checkout.marketing_optin': 'Evet, indirimleri e-posta ile almak istiyorum.',
    'checkout.privacy_note': 'Verilerin sadece bu sipariş için kullanılır.',
    'success.headline': 'Sipariş verildi!',
    'success.eta_delivery': 'Yaklaşık {min} dakika içinde teslim',
    'success.eta_pickup': 'Yaklaşık {min} dakika içinde hazır',
    'success.track': 'Siparişi canlı takip et',
    'success.new': 'Yeni sipariş ver',
  },
  ar: {
    'hero.meta.min': 'من {min}€ قيمة الطلب',
    'hero.meta.items': '{n} أطباق على القائمة',
    'hero.meta.open': 'مفتوح حتى الساعة {time}',
    'hero.meta.closed': 'مغلق حالياً',
    'hero.meta.rating': '٤٫٩ (٣١٢ تقييم)',
    'hero.popular_pill': '{n} من أفضل الخيارات',
    'hero.order_abholung': 'استلام',
    'hero.order_lieferung': 'توصيل',
    'popular.title': 'الأكثر طلباً',
    'cart.empty': 'فارغة — ابدأ بكلاسيكية.',
    'cart.subtotal': 'المجموع الفرعي',
    'cart.delivery_fee': 'رسوم التوصيل',
    'cart.total': 'المجموع',
    'cart.checkout': 'الدفع',
    'cart.min_order': 'الحد الأدنى {min} €',
    'checkout.step.address': 'العنوان',
    'checkout.step.contact': 'الاتصال',
    'checkout.step.payment': 'الدفع',
    'checkout.back': 'عودة',
    'checkout.next': 'التالي',
    'checkout.submit': 'أطلب الآن',
    'checkout.submitting': 'جارٍ الإرسال …',
    'checkout.marketing_optin': 'نعم، أرسل لي العروض عبر البريد الإلكتروني.',
    'checkout.privacy_note': 'نستخدم بياناتك فقط لهذا الطلب.',
    'success.headline': 'تم الطلب!',
    'success.eta_delivery': 'التوصيل في حوالي {min} دقيقة',
    'success.eta_pickup': 'الاستلام في حوالي {min} دقيقة',
    'success.track': 'تتبع الطلب مباشرة',
    'success.new': 'طلب جديد',
  },
};

export function detectLocale(accept: string | null | undefined, cookieValue?: string | null): Locale {
  if (cookieValue && ['de', 'en', 'tr', 'ar'].includes(cookieValue)) return cookieValue as Locale;
  const al = (accept ?? '').toLowerCase();
  if (al.startsWith('en')) return 'en';
  if (al.startsWith('tr')) return 'tr';
  if (al.startsWith('ar')) return 'ar';
  return 'de';
}

export function tr(locale: Locale, key: string, vars?: Record<string, string | number>): string {
  const str = T[locale]?.[key] ?? T.de[key] ?? key;
  if (!vars) return str;
  return str.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? `{${k}}`));
}
