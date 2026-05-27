import { createServiceClient } from '@/lib/supabase/server';
import { Check, Mail, X } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function UnsubscribePage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; email?: string }>;
}) {
  const sp = await searchParams;
  const svc = createServiceClient();

  let result: { ok: boolean; email?: string; error?: string } = { ok: false };

  if (sp.token) {
    const { data } = await svc.rpc('unsubscribe_by_token', { p_token: sp.token });
    result = (data as any) ?? { ok: false, error: 'Token ungültig' };
  } else if (sp.email) {
    // Fallback ohne Token (aus Welcome-E-Mail direkt)
    await svc
      .from('customer_orders')
      .update({ marketing_optin: false })
      .eq('kunde_email', sp.email);
    result = { ok: true, email: sp.email };
  } else {
    result = { ok: false, error: 'Kein Token oder Email übergeben' };
  }

  return (
    <div className="min-h-screen bg-surface flex items-center justify-center p-6">
      <div className="max-w-md w-full bg-card rounded-3xl p-8 shadow-strong text-center">
        <div className={`h-16 w-16 mx-auto rounded-full flex items-center justify-center mb-4 ${result.ok ? 'bg-matcha-500 text-white' : 'bg-red-100 text-red-700'}`}>
          {result.ok ? <Check size={28} /> : <X size={28} />}
        </div>

        {result.ok ? (
          <>
            <h1 className="font-display text-2xl font-bold">Abgemeldet</h1>
            <p className="text-muted-foreground mt-3">
              {result.email && <>Die E-Mail <strong className="text-foreground font-mono text-sm">{result.email}</strong> erhält</>}
              {!result.email && 'Du erhältst'} keine Marketing-E-Mails mehr von uns.
            </p>
            <p className="mt-4 text-xs text-muted-foreground">
              Bestellbestätigungen bekommst du weiterhin — das sind keine Marketing-Mails.
            </p>
          </>
        ) : (
          <>
            <h1 className="font-display text-2xl font-bold">Konnten dich nicht abmelden</h1>
            <p className="text-muted-foreground mt-3">{result.error}</p>
            <p className="mt-4 text-xs text-muted-foreground">
              Schreib uns direkt zurück auf die E-Mail — wir nehmen dich manuell aus der Liste.
            </p>
          </>
        )}

        <div className="mt-8 pt-6 border-t text-xs text-muted-foreground flex items-center justify-center gap-1">
          <Mail size={10} /> Mise · Das Betriebssystem für Restaurants
        </div>
      </div>
    </div>
  );
}
