export type ExternalSource = 'lieferando' | 'ubereats' | 'wolt' | 'deliverect' | 'otter' | 'custom';

export type MappedOrder = {
  external_id: string;
  source: ExternalSource;
  location_hint?: string | null; // Filiale (z.B. externer Store-ID)
  typ: 'lieferung' | 'abholung' | 'vor_ort';
  kunde_name: string;
  kunde_telefon?: string | null;
  kunde_email?: string | null;
  kunde_adresse?: string | null;
  kunde_plz?: string | null;
  kunde_stadt?: string | null;
  kunde_lat?: number | null;
  kunde_lng?: number | null;
  kunde_etage?: string | null;
  kunde_tuer_code?: string | null;
  kunde_lieferhinweis?: string | null;
  kunde_notiz?: string | null;
  zahlungsart: string; // 'bar' | 'karte' | 'online' | 'stripe' | 'paypal'
  bezahlt: boolean;
  liefergebuehr: number;
  trinkgeld: number;
  zwischensumme: number;
  gesamtbetrag: number;
  geschaetzte_zubereitung_min?: number | null;
  geschaetzte_lieferung_min?: number | null;
  items: {
    name: string;
    menge: number;
    einzelpreis: number;
    extras?: unknown[];
    notiz?: string | null;
  }[];
};

export type AdapterResult =
  | { ok: true; order: MappedOrder }
  | { ok: false; error: string; ignore?: boolean };

export interface SourceAdapter {
  source: ExternalSource;
  match(payload: unknown, headers: Record<string, string>): boolean;
  parse(payload: unknown, headers: Record<string, string>): AdapterResult;
}
