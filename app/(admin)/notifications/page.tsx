import { createClient } from '@/lib/supabase/server';
import { requireManagerPlus } from '@/lib/auth/requireRole';
import Link from 'next/link';
import { PageHeader } from '@/components/layout/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty';
import { dateTimeDE } from '@/lib/utils';
import { Settings } from 'lucide-react';

export default async function NotificationsPage() {
  await requireManagerPlus();
  const supabase = await createClient();
  const { data: notifs } = await supabase.from('notifications')
    .select('id,typ,titel,nachricht,link,gelesen,created_at,employee:employees!notifications_employee_id_fkey(vorname,nachname)')
    .order('created_at', { ascending: false }).limit(100);

  return (
    <div>
      <PageHeader
        title="Benachrichtigungen"
        description="Zentrale Feed-Ansicht der letzten 100 Events."
        actions={<Link href="/notifications/rules"><Button variant="outline"><Settings className="h-4 w-4" /> Regeln bearbeiten</Button></Link>}
      />
      {(notifs?.length ?? 0) === 0 ? (
        <EmptyState title="Noch keine Benachrichtigungen" />
      ) : (
        <div className="space-y-2">
          {notifs!.map(n => {
            const v = n.typ === 'dringend' ? 'destructive' : n.typ === 'warnung' ? 'gold' : n.typ === 'erfolg' ? 'secondary' : 'muted';
            return (
              <Card key={n.id}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <Badge variant={v as any}>{n.typ}</Badge>
                        <span className="font-medium">{n.titel}</span>
                        {!n.gelesen && <span className="h-2 w-2 rounded-full bg-matcha-600" />}
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">{n.nachricht}</p>
                      {n.employee && (
                        <p className="mt-1 text-xs text-muted-foreground">
                          An: {(n.employee as any).vorname} {(n.employee as any).nachname}
                        </p>
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground whitespace-nowrap">{dateTimeDE(n.created_at)}</span>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
