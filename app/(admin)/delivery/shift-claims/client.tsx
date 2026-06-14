'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { RefreshCw, CheckCircle2, XCircle, ClipboardList } from 'lucide-react';

interface ShiftClaimWithDriver {
  id: string;
  driverId: string;
  plannedStart: string;
  plannedEnd: string;
  status: 'pending' | 'approved' | 'rejected' | 'cancelled';
  notes: string | null;
  rejectionReason: string | null;
  createdAt: string;
  driverName: string | null;
  driverVehicle: string | null;
}

interface ClaimStats {
  pending: number;
  approved: number;
  rejected: number;
  cancelled: number;
}

export function ShiftClaimsClient({ locationId }: { locationId: string }) {
  const [claims, setClaims] = useState<ShiftClaimWithDriver[]>([]);
  const [stats, setStats] = useState<ClaimStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    Promise.all([
      fetch('/api/delivery/admin/shift-claims').then(r => r.ok ? r.json() : null),
      fetch('/api/delivery/admin/shift-claims?action=stats').then(r => r.ok ? r.json() : null),
    ]).then(([cl, st]) => {
      if (cl?.claims) setClaims(cl.claims as ShiftClaimWithDriver[]);
      if (st?.stats) setStats(st.stats as ClaimStats);
    }).catch(() => {}).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [locationId]);

  const act = async (claimId: string, action: 'approve' | 'reject', reason?: string) => {
    setActing(claimId);
    setError(null);
    const res = await fetch('/api/delivery/admin/shift-claims', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, claim_id: claimId, reason }),
    });
    if (res.ok) {
      setClaims(prev => prev.filter(c => c.id !== claimId));
      setStats(prev => prev ? { ...prev, pending: Math.max(0, prev.pending - 1), [action === 'approve' ? 'approved' : 'rejected']: prev[action === 'approve' ? 'approved' : 'rejected'] + 1 } : prev);
    } else {
      const json = await res.json();
      setError(json.error ?? 'Fehler beim Aktualisieren');
    }
    setActing(null);
  };

  const formatDT = (iso: string) =>
    new Date(iso).toLocaleString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <button onClick={load} disabled={loading} className="flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-semibold bg-card border-border text-muted-foreground hover:bg-muted transition disabled:opacity-50">
          <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
          Aktualisieren
        </button>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-red-800 text-sm">{error}</div>
      )}

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className={cn('rounded-xl border px-4 py-3', stats.pending > 0 ? 'bg-amber-50 border-amber-200' : 'bg-card')}>
            <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">Ausstehend</div>
            <div className={cn('font-display text-2xl font-black', stats.pending > 0 ? 'text-amber-700' : '')}>{stats.pending}</div>
          </div>
          <div className="rounded-xl border bg-matcha-50 border-matcha-200 px-4 py-3">
            <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">Genehmigt (30T)</div>
            <div className="font-display text-2xl font-black text-matcha-700">{stats.approved}</div>
          </div>
          <div className="rounded-xl border bg-card px-4 py-3">
            <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">Abgelehnt (30T)</div>
            <div className="font-display text-2xl font-black">{stats.rejected}</div>
          </div>
          <div className="rounded-xl border bg-card px-4 py-3">
            <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">Zurückgezogen (30T)</div>
            <div className="font-display text-2xl font-black">{stats.cancelled}</div>
          </div>
        </div>
      )}

      {loading && <div className="flex items-center justify-center py-16 text-muted-foreground">Lade Anmeldungen…</div>}

      {!loading && claims.length === 0 && (
        <div className="flex items-center gap-2 justify-center py-16 text-muted-foreground text-sm">
          <ClipboardList className="h-4 w-4" />
          Keine offenen Schicht-Anmeldungen.
        </div>
      )}

      {!loading && claims.length > 0 && (
        <div className="rounded-xl border bg-card overflow-hidden">
          <div className="px-4 py-3 border-b font-display font-bold text-sm">
            Offene Anmeldungen ({claims.length})
          </div>
          <div className="divide-y divide-border">
            {claims.map(claim => (
              <div key={claim.id} className="px-4 py-3 flex items-center gap-4">
                <div className="h-9 w-9 rounded-full bg-matcha-100 text-matcha-800 flex items-center justify-center text-sm font-black shrink-0">
                  {(claim.driverName ?? 'F').charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium">{claim.driverName ?? claim.driverId.slice(0, 8)}</div>
                  {claim.driverVehicle && <div className="text-xs text-muted-foreground">{claim.driverVehicle}</div>}
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {formatDT(claim.plannedStart)} – {new Date(claim.plannedEnd).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
                  </div>
                  {claim.notes && <div className="text-xs text-muted-foreground italic mt-0.5">„{claim.notes}"</div>}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button onClick={() => act(claim.id, 'approve')} disabled={acting === claim.id}
                    className="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-bold bg-matcha-700 text-white hover:bg-matcha-800 disabled:opacity-50 transition">
                    <CheckCircle2 className="h-3.5 w-3.5" /> Genehmigen
                  </button>
                  <button onClick={() => act(claim.id, 'reject')} disabled={acting === claim.id}
                    className="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-bold border border-red-300 text-red-700 hover:bg-red-50 disabled:opacity-50 transition">
                    <XCircle className="h-3.5 w-3.5" /> Ablehnen
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
