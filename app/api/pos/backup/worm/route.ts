import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import JSZip from 'jszip';
import crypto from 'crypto';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;  // 5 Min für große Exports

/**
 * WORM-Backup auf S3 mit Object Lock (10 Jahre compliance mode).
 * - Läuft monatlich via Vercel-Cron
 * - Exportiert ALLE fiskalisch relevanten Daten des Vormonats
 * - Lädt als ZIP ins S3-Bucket (Object Lock compliance mode = 10 Jahre unveränderbar)
 * - Trägt Metadaten in fiscal_backups ein (append-only)
 *
 * Alternativ manuell aufrufbar: GET /api/pos/backup/worm?tenant_id=xxx&from=2026-01-01&to=2026-01-31
 */

export async function GET(req: NextRequest) { return run(req); }
export async function POST(req: NextRequest) { return run(req); }

async function run(req: NextRequest) {
  // Config-Check
  const bucket = process.env.AWS_WORM_BUCKET;
  const region = process.env.AWS_WORM_REGION ?? 'eu-central-1';
  if (!bucket || !process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) {
    return NextResponse.json({
      ok: false,
      error: 'AWS WORM nicht konfiguriert. Benötigt: AWS_WORM_BUCKET, AWS_WORM_REGION, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY',
    }, { status: 503 });
  }

  // Auth / Tenant-Scope
  const specificTenantId = req.nextUrl.searchParams.get('tenant_id');
  let tenantIds: string[] = [];

  if (specificTenantId) {
    // Manueller Call mit Auth-Check
    const sb = await createClient();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return NextResponse.json({ ok: false, error: 'Nicht eingeloggt' }, { status: 401 });
    const svc = createServiceClient();
    const { data: emp } = await svc.from('employees').select('tenant_id, rolle').eq('auth_user_id', user.id).maybeSingle();
    if (emp?.tenant_id !== specificTenantId || emp.rolle !== 'admin') {
      return NextResponse.json({ ok: false, error: 'Kein Zugriff' }, { status: 403 });
    }
    tenantIds = [specificTenantId];
  } else {
    // Cron-Call: alle Tenants
    const svc = createServiceClient();
    const { data: tenants } = await svc.from('tenants').select('id');
    tenantIds = (tenants as any[] ?? []).map((t) => t.id);
  }

  // Zeitraum: wenn nicht explizit, nimm Vormonat
  const fromStr = req.nextUrl.searchParams.get('from');
  const toStr = req.nextUrl.searchParams.get('to');
  const now = new Date();
  const vormonatStart = fromStr ?? new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().slice(0, 10);
  const vormonatEnde = toStr ?? new Date(now.getFullYear(), now.getMonth(), 0).toISOString().slice(0, 10);

  const s3 = new S3Client({
    region,
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    },
  });

  const svc = createServiceClient();
  const results: any[] = [];

  for (const tenantId of tenantIds) {
    try {
      // Skippen wenn schon Backup vorhanden
      const { count: existing } = await svc.from('fiscal_backups')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', tenantId)
        .eq('zeitraum_von', vormonatStart)
        .eq('zeitraum_bis', vormonatEnde);
      if (existing && existing > 0) {
        results.push({ tenant_id: tenantId, skipped: 'bereits gesichert' });
        continue;
      }

      // Alle fiskalischen Daten des Zeitraums exportieren
      const [
        { data: transactions },
        { data: orderItems },
        { data: zReports },
        { data: shifts },
        { data: bewirtung },
        { data: tseOutages },
        { data: auditLog },
      ] = await Promise.all([
        svc.from('pos_transactions').select('*').eq('tenant_id', tenantId)
          .gte('created_at', `${vormonatStart}T00:00:00`).lte('created_at', `${vormonatEnde}T23:59:59`),
        svc.from('order_items').select('*, order:customer_orders!inner(id, tenant_id, bestellt_am)')
          .eq('order.tenant_id', tenantId)
          .gte('order.bestellt_am', `${vormonatStart}T00:00:00`).lte('order.bestellt_am', `${vormonatEnde}T23:59:59`),
        svc.from('pos_z_reports').select('*').eq('tenant_id', tenantId)
          .gte('erstellt_am', `${vormonatStart}T00:00:00`).lte('erstellt_am', `${vormonatEnde}T23:59:59`),
        svc.from('pos_shifts').select('*').eq('tenant_id', tenantId)
          .gte('start_at', `${vormonatStart}T00:00:00`).lte('start_at', `${vormonatEnde}T23:59:59`),
        svc.from('bewirtungsbelege').select('*, transaction:pos_transactions!inner(tenant_id, created_at)')
          .eq('transaction.tenant_id', tenantId)
          .gte('transaction.created_at', `${vormonatStart}T00:00:00`).lte('transaction.created_at', `${vormonatEnde}T23:59:59`),
        svc.from('tse_outage_log').select('*').eq('tenant_id', tenantId)
          .gte('start_at', `${vormonatStart}T00:00:00`).lte('start_at', `${vormonatEnde}T23:59:59`),
        svc.from('audit_log').select('*').eq('tenant_id', tenantId)
          .gte('created_at', `${vormonatStart}T00:00:00`).lte('created_at', `${vormonatEnde}T23:59:59`),
      ]);

      // ZIP bauen
      const zip = new JSZip();
      zip.file('transactions.json', JSON.stringify(transactions ?? [], null, 2));
      zip.file('order_items.json', JSON.stringify(orderItems ?? [], null, 2));
      zip.file('z_reports.json', JSON.stringify(zReports ?? [], null, 2));
      zip.file('shifts.json', JSON.stringify(shifts ?? [], null, 2));
      zip.file('bewirtungsbelege.json', JSON.stringify(bewirtung ?? [], null, 2));
      zip.file('tse_outages.json', JSON.stringify(tseOutages ?? [], null, 2));
      zip.file('audit_log.json', JSON.stringify(auditLog ?? [], null, 2));
      zip.file('manifest.json', JSON.stringify({
        tenant_id: tenantId,
        zeitraum_von: vormonatStart,
        zeitraum_bis: vormonatEnde,
        erstellt_am: new Date().toISOString(),
        records: {
          transactions: transactions?.length ?? 0,
          order_items: orderItems?.length ?? 0,
          z_reports: zReports?.length ?? 0,
          shifts: shifts?.length ?? 0,
          bewirtung: bewirtung?.length ?? 0,
          tse_outages: tseOutages?.length ?? 0,
          audit_log: auditLog?.length ?? 0,
        },
        gesetzlich: {
          grundlage: '§ 147 AO / GoBD',
          aufbewahrung_jahre: 10,
          worm_mode: 'S3 Object Lock COMPLIANCE',
        },
      }, null, 2));

      const blob = await zip.generateAsync({ type: 'uint8array' });
      const buffer = Buffer.from(blob);

      // SHA-256 Integrity-Hash
      const sha256 = crypto.createHash('sha256').update(buffer).digest('hex');

      // S3 Object Lock: 10 Jahre Compliance-Mode
      const retainUntil = new Date();
      retainUntil.setFullYear(retainUntil.getFullYear() + 10);

      const s3Key = `fiscal-backups/${tenantId}/${vormonatStart}_${vormonatEnde}.zip`;

      await s3.send(new PutObjectCommand({
        Bucket: bucket,
        Key: s3Key,
        Body: buffer,
        ContentType: 'application/zip',
        ContentLength: buffer.length,
        ChecksumSHA256: crypto.createHash('sha256').update(buffer).digest('base64'),
        // WORM: 10 Jahre unveränderbar
        ObjectLockMode: 'COMPLIANCE',
        ObjectLockRetainUntilDate: retainUntil,
        Metadata: {
          'tenant-id': tenantId,
          'zeitraum-von': vormonatStart,
          'zeitraum-bis': vormonatEnde,
          'sha256': sha256,
          'gobd': 'true',
        },
      }));

      // Eintrag in DB (append-only via Trigger)
      await svc.from('fiscal_backups').insert({
        tenant_id: tenantId,
        zeitraum_von: vormonatStart,
        zeitraum_bis: vormonatEnde,
        s3_bucket: bucket,
        s3_key: s3Key,
        content_sha256: sha256,
        object_lock_bis: retainUntil.toISOString(),
        groesse_bytes: buffer.length,
        anzahl_transaktionen: transactions?.length ?? 0,
        anzahl_z_reports: zReports?.length ?? 0,
      });

      results.push({
        tenant_id: tenantId,
        ok: true,
        s3_key: s3Key,
        size: buffer.length,
        transactions: transactions?.length ?? 0,
        lock_until: retainUntil.toISOString(),
      });
    } catch (e) {
      console.error('[WORM-Backup]', tenantId, e);
      results.push({
        tenant_id: tenantId,
        ok: false,
        error: e instanceof Error ? e.message : 'Fehler',
      });
    }
  }

  return NextResponse.json({
    ok: true,
    zeitraum: { from: vormonatStart, to: vormonatEnde },
    results,
  });
}
