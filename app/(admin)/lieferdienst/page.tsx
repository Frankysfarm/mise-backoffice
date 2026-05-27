import { LieferdienstClient } from './client';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Lieferdienst-Display · Mise' };

/**
 * DEV-Modus: kein Auth-Gate, kein Login.
 * Wird für Pilot später mit requireManagerPlus geschützt.
 */
export default function LieferdienstPage() {
  return <LieferdienstClient />;
}
