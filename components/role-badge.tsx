import { Badge } from '@/components/ui/badge';

const map: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'gold' | 'accent' | 'muted' }> = {
  // Management-Hierarchie
  admin:       { label: 'Admin',       variant: 'destructive' },
  backoffice:  { label: 'Backoffice',  variant: 'gold' },
  manager:     { label: 'Manager',     variant: 'default' },
  teamleiter:  { label: 'Teamleiter',  variant: 'accent' },
  mitarbeiter: { label: 'Mitarbeiter', variant: 'muted' },
  // Service-Rollen-Vorlagen (Restaurant-spezifisch)
  server:      { label: 'Service',     variant: 'accent' },
  bartender:   { label: 'Bartender',   variant: 'accent' },
  cook:        { label: 'Koch',        variant: 'default' },
  dishwasher:  { label: 'Spüler',      variant: 'muted' },
};

export function RoleBadge({ rolle }: { rolle: string }) {
  const m = map[rolle] ?? { label: rolle, variant: 'muted' as const };
  return <Badge variant={m.variant}>{m.label}</Badge>;
}

export function StatusBadge({ status }: { status: string }) {
  const variants: Record<string, 'secondary' | 'destructive' | 'muted' | 'gold'> = {
    aktiv: 'secondary', inaktiv: 'muted', gekündigt: 'destructive', pause: 'gold',
  };
  return <Badge variant={variants[status] ?? 'muted'}>{status}</Badge>;
}

/**
 * Beschreibungen pro Rolle — für Owner-UI (Mitarbeiter anlegen, Rollen erklären).
 */
export const ROLE_DESCRIPTIONS: Record<string, { kurz: string; rechte: string[] }> = {
  admin:       { kurz: 'Vollzugriff inkl. andere Admins anlegen', rechte: ['Alle Module', 'Alle Mitarbeiter', 'Alle Settings', 'TSE/Compliance', 'Andere Admins'] },
  backoffice:  { kurz: 'Buchhaltung + alle Reports', rechte: ['Alle Module', 'DSFinV-K-Export', 'Z-Bericht', 'Tagesabschluss', 'KEINE Admin-Anlage'] },
  manager:     { kurz: 'POS + Tische + Menü + Settings', rechte: ['POS-Terminal', 'Tische + QR', 'Menü + Steuersätze', 'Mitarbeiter (außer Admin)', 'Storno mit PIN'] },
  teamleiter:  { kurz: 'Wie Mitarbeiter + Schicht-Aufsicht', rechte: ['POS-Terminal', 'Schicht öffnen/schließen', 'Storno mit PIN', 'Andere Mitarbeiter sehen'] },
  mitarbeiter: { kurz: 'Nur POS bedienen', rechte: ['POS-Terminal nutzen', 'Bestellungen aufnehmen', 'Bezahlen abwickeln', 'Eigene Schicht'] },
  server:      { kurz: 'Service vorne — Tisch + Bezahlen', rechte: ['POS-Terminal', 'Tische bedienen', 'Bezahlen', 'Bon drucken', 'KEIN Storno ohne PIN'] },
  bartender:   { kurz: 'Bar — Getränke + Schnell-Bezahlen', rechte: ['POS-Terminal', 'Getränke-Kategorie priorisiert', 'Bar-Schicht', 'Bezahlen'] },
  cook:        { kurz: 'Küche — KDS-Tickets', rechte: ['KDS-Monitor', 'Bestellung als „bereit" markieren', 'Sonderwünsche lesen'] },
  dishwasher:  { kurz: 'Spüler — keine POS-Rechte', rechte: ['Stempeluhr', 'Eigene Schicht-Stunden'] },
};
