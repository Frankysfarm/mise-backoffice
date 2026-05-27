import { createServiceClient } from '@/lib/supabase/server';
import { Card } from '@/components/ui/card';
import { AlertTriangle, Archive, CheckCircle2, Lock } from 'lucide-react';
import { WormActions } from './worm-actions';

export async function WormBackupCard({ tenantId }: { tenantId: string }) {
  const svc = createServiceClient();
  const [{ data: backups, count }, { count: totalCount }] = await Promise.all([
    svc.from('fiscal_backups').select('*', { count: 'exact' })
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })
      .limit(5),
    svc.from('fiscal_backups').select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId),
  ]);

  const hasBackups = (count ?? 0) > 0;
  const latest = (backups as any[] ?? [])[0];

  return (
    <Card className={`p-5 mb-4 ${hasBackups ? 'bg-matcha-50 border-matcha-300' : 'bg-amber-50 border-amber-300'}`}>
      <div className="flex items-start gap-3 mb-4">
        <div className={`h-10 w-10 rounded-xl grid place-items-center ${hasBackups ? 'bg-matcha-700 text-white' : 'bg-amber-500 text-white'}`}>
          {hasBackups ? <Lock className="h-5 w-5" /> : <AlertTriangle className="h-5 w-5" />}
        </div>
        <div className="flex-1">
          <h3 className="font-display text-lg font-bold">
            WORM-Backup (10 Jahre Aufbewahrung nach § 147 AO)
          </h3>
          <p className="text-sm text-muted-foreground mt-0.5">
            Monatliche Voll-Sicherung aller fiskalischen Daten auf AWS S3 mit Object Lock.
            Unveränderbar für 10 Jahre — GoBD-konform.
          </p>
        </div>
      </div>

      {hasBackups ? (
        <>
          <div className="grid grid-cols-3 gap-3 mb-4">
            <div className="rounded-xl bg-white/80 p-3">
              <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Backups gesamt</div>
              <div className="font-display text-2xl font-black">{totalCount ?? count}</div>
            </div>
            <div className="rounded-xl bg-white/80 p-3">
              <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Letztes Backup</div>
              <div className="font-display text-sm font-bold">
                {latest ? new Date(latest.created_at).toLocaleDateString('de-DE') : '—'}
              </div>
            </div>
            <div className="rounded-xl bg-white/80 p-3">
              <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Sperre bis</div>
              <div className="font-display text-sm font-bold">
                {latest ? new Date(latest.object_lock_bis).toLocaleDateString('de-DE') : '—'}
              </div>
            </div>
          </div>

          {backups && backups.length > 0 && (
            <details className="mt-3 text-xs">
              <summary className="cursor-pointer font-semibold">Letzte {backups.length} Backups</summary>
              <div className="mt-2 space-y-1">
                {(backups as any[]).map((b) => (
                  <div key={b.id} className="flex justify-between font-mono text-[11px] bg-white/60 rounded px-2 py-1">
                    <span>{b.zeitraum_von} – {b.zeitraum_bis}</span>
                    <span>{((b.groesse_bytes ?? 0) / 1024).toFixed(0)} KB · {b.anzahl_transaktionen} TX</span>
                  </div>
                ))}
              </div>
            </details>
          )}
        </>
      ) : (
        <div className="rounded-xl bg-white/60 p-4 text-sm">
          <div className="font-bold mb-1">Noch keine Backups vorhanden.</div>
          <div className="text-muted-foreground">
            Läuft automatisch jeden Monat am 1. um 05:00 Uhr. Oder jetzt manuell auslösen:
          </div>
        </div>
      )}

      <WormActions tenantId={tenantId} />
    </Card>
  );
}
