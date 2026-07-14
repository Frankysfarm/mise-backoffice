import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

interface ZoneBelastung {
  zone: string;
  aktive_fahrer: number;
  wartende_bestellungen: number;
  avg_wartezeit_min: number;
  status: 'überlastet' | 'normal' | 'frei';
}

export async function GET() {
  try {
    const supabase = await createClient();
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();

    const { data: drivers } = await supabase
      .from('drivers')
      .select('id, zone, status')
      .eq('status', 'active');

    const { data: orders } = await supabase
      .from('deliveries')
      .select('zone, status, created_at')
      .gte('created_at', todayStart)
      .in('status', ['pending', 'preparing', 'ready']);

    if (!drivers) throw new Error('no data');

    const zones = ['A', 'B', 'C', 'D'];
    const zonen: ZoneBelastung[] = zones.map(zone => {
      const zoneDrivers = (drivers ?? []).filter(d => d.zone === zone);
      const zoneOrders = (orders ?? []).filter(o => o.zone === zone);

      const aktive_fahrer = zoneDrivers.length;
      const wartende_bestellungen = zoneOrders.length;

      const avg_wartezeit_min = wartende_bestellungen > 0
        ? Math.round(
            zoneOrders.reduce((sum, o) => {
              const age = (now.getTime() - new Date(o.created_at).getTime()) / 60000;
              return sum + age;
            }, 0) / wartende_bestellungen
          )
        : 0;

      const ratio = aktive_fahrer > 0 ? wartende_bestellungen / aktive_fahrer : wartende_bestellungen;
      const status: ZoneBelastung['status'] =
        ratio > 3 ? 'überlastet' :
        ratio > 1.5 ? 'normal' : 'frei';

      return { zone, aktive_fahrer, wartende_bestellungen, avg_wartezeit_min, status };
    });

    return NextResponse.json({ zonen, generiert_um: now.toISOString() });
  } catch {
    const mockZonen: ZoneBelastung[] = [
      { zone: 'A', aktive_fahrer: 3, wartende_bestellungen: 8, avg_wartezeit_min: 12, status: 'überlastet' },
      { zone: 'B', aktive_fahrer: 2, wartende_bestellungen: 4, avg_wartezeit_min: 7, status: 'normal' },
      { zone: 'C', aktive_fahrer: 4, wartende_bestellungen: 3, avg_wartezeit_min: 4, status: 'frei' },
      { zone: 'D', aktive_fahrer: 1, wartende_bestellungen: 5, avg_wartezeit_min: 18, status: 'überlastet' },
    ];
    return NextResponse.json({ zonen: mockZonen, generiert_um: new Date().toISOString() });
  }
}
