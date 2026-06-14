// Shared types for the order storefront.

export type Location = {
  id: string;
  name: string;
  adresse: string | null;
  stadt: string | null;
  plz: string | null;
  telefon: string | null;
};

export type Category = {
  id: string;
  name: string;
  icon: string | null;
  sort_order: number;
};

export type MenuItem = {
  id: string;
  name: string;
  beschreibung: string | null;
  preis: number;
  bild_url: string | null;
  category_id: string | null;
  allergene: string[] | null;
  tags: string[] | null;
  beliebt: boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  extras: any;
};

export type ExtraOption = { id: string; name: string; preis: number };

export type ExtraGroup = {
  id: string;
  name: string;
  typ: 'size' | 'milk' | 'extra' | 'note';
  required: boolean;
  multiple: boolean;
  options?: ExtraOption[];
};

export type SelectedExtras = {
  [groupId: string]: string[];
};

export type CartItem = {
  item: MenuItem;
  qty: number;
  lineId?: string;
  extras?: SelectedExtras;
  notiz?: string;
  extra_preis?: number;
};

export type OrderType = 'abholung' | 'lieferung';

export type PaymentMethod = 'bar' | 'karte' | 'online';

export type CheckoutForm = {
  name: string;
  telefon: string;
  email?: string;
  adresse?: string;
  plz?: string;
  stadt?: string;
  lat?: number | null;
  lng?: number | null;
  etage?: string;
  tuercode?: string;
  lieferhinweis?: string;
  zahlungsart: PaymentMethod;
  marketing_optin?: boolean;
  whatsapp_optin?: boolean;
};

export const DELIVERY_FEE = 2.9;
export const MIN_ORDER = 12;

export const ALLERGEN_LABEL: Record<string, string> = {
  gluten: 'Gluten',
  laktose: 'Laktose',
  ei: 'Ei',
  nuss: 'Nüsse',
  sesam: 'Sesam',
  soja: 'Soja',
  fisch: 'Fisch',
  senf: 'Senf',
  sellerie: 'Sellerie',
};
