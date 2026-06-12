'use client';

import { useState, useEffect, useCallback } from 'react';
import { Trophy, Star, Gift, TrendingUp, Users, Coins, RefreshCw, Plus, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';

// ── Typen ─────────────────────────────────────────────────────────────────────

interface LoyaltyKpis {
  totalAccounts: number;
  activeAccounts: number;
  totalPointsOutstanding: number;
  totalLifetimeEarned: number;
  tierBreakdown: { bronze: number; silver: number; gold: number; platinum: number };
  avgPointsPerAccount: number;
  redemptionRate: number;
}

interface LeaderboardEntry {
  rank: number;
  accountId: string;
  customerEmail: string;
  customerName: string | null;
  totalPoints: number;
  lifetimePoints: number;
  tier: 'bronze' | 'silver' | 'gold' | 'platinum';
  lastActivityAt: string;
}

type LoyaltyTier = 'bronze' | 'silver' | 'gold' | 'platinum';

// ── Helpers ───────────────────────────────────────────────────────────────────

const TIER_META: Record<LoyaltyTier, { label: string; color: string; bg: string; icon: string }> = {
  bronze:   { label: 'Bronze',   color: 'text-amber-700',   bg: 'bg-amber-100',   icon: '🥉' },
  silver:   { label: 'Silber',   color: 'text-slate-500',   bg: 'bg-slate-100',   icon: '🥈' },
  gold:     { label: 'Gold',     color: 'text-yellow-600',  bg: 'bg-yellow-100',  icon: '🥇' },
  platinum: { label: 'Platin',   color: 'text-purple-600',  bg: 'bg-purple-100',  icon: '💎' },
};

function TierBadge({ tier }: { tier: LoyaltyTier }) {
  const m = TIER_META[tier];
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium', m.bg, m.color)}>
      {m.icon} {m.label}
    </span>
  );
}

function StatCard({ icon: Icon, label, value, sub, color = 'text-foreground' }: {
  icon: React.ElementType;
  label: string;
  value: string | number;
  sub?: string;
  color?: string;
}) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </div>
      <div className={cn('text-2xl font-bold', color)}>{value}</div>
      {sub && <div className="text-xs text-muted-foreground mt-0.5">{sub}</div>}
    </div>
  );
}

// ── Haupt-Komponente ──────────────────────────────────────────────────────────

export function LoyaltyAdminClient({ locationId }: { locationId: string | null }) {
  const [kpis, setKpis] = useState<LoyaltyKpis | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [adjustEmail, setAdjustEmail] = useState('');
  const [adjustPoints, setAdjustPoints] = useState('');
  const [adjustReason, setAdjustReason] = useState('');
  const [adjusting, setAdjusting] = useState(false);
  const [adjustMsg, setAdjustMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!locationId) { setLoading(false); return; }
    try {
      const res = await fetch(`/api/delivery/admin/loyalty?location_id=${locationId}`);
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json() as { kpis: LoyaltyKpis; leaderboard: LeaderboardEntry[] };
      setKpis(data.kpis);
      setLeaderboard(data.leaderboard);
    } catch { /* ignore */ } finally {
      setLoading(false);
    }
  }, [locationId]);

  useEffect(() => { void load(); }, [load]);

  async function submitAdjust(sign: 1 | -1) {
    const pts = parseInt(adjustPoints, 10);
    if (!adjustEmail || !pts || !adjustReason) {
      setAdjustMsg('E-Mail, Punkte und Grund erforderlich');
      return;
    }
    setAdjusting(true);
    setAdjustMsg(null);
    try {
      const res = await fetch('/api/delivery/admin/loyalty', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          location_id: locationId,
          email: adjustEmail,
          points: pts * sign,
          reason: adjustReason,
        }),
      });
      const data = await res.json() as { ok: boolean; newBalance?: number; reason?: string };
      if (data.ok) {
        setAdjustMsg(`✓ Neuer Kontostand: ${data.newBalance} Punkte`);
        setAdjustEmail('');
        setAdjustPoints('');
        setAdjustReason('');
        void load();
      } else {
        setAdjustMsg(`Fehler: ${data.reason ?? 'Unbekannt'}`);
      }
    } catch (e) {
      setAdjustMsg(`Fehler: ${e instanceof Error ? e.message : 'Unbekannt'}`);
    } finally {
      setAdjusting(false);
    }
  }

  if (!locationId) {
    return (
      <div className="p-6 text-center text-muted-foreground">
        Kein Standort zugeordnet.
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Trophy className="h-6 w-6 text-yellow-500" />
            Loyalty-Punkte
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            10 Punkte pro € · 100 Punkte = 1 € Rabatt · Tier-System Bronze/Silber/Gold/Platin
          </p>
        </div>
        <button
          onClick={() => void load()}
          className="flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm hover:bg-accent"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Aktualisieren
        </button>
      </div>

      {loading && (
        <div className="text-center text-muted-foreground py-8">Lade Daten…</div>
      )}

      {!loading && kpis && (
        <>
          {/* KPI-Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard icon={Users}       label="Loyalty-Konten"        value={kpis.totalAccounts}                 sub={`${kpis.activeAccounts} aktiv (30 T.)`} />
            <StatCard icon={Coins}       label="Punkte ausstehend"     value={kpis.totalPointsOutstanding.toLocaleString('de-DE')} sub={`≙ ${(kpis.totalPointsOutstanding * 0.01).toFixed(2)} € Wert`} />
            <StatCard icon={TrendingUp}  label="Lifetime vergeben"     value={kpis.totalLifetimeEarned.toLocaleString('de-DE')} sub={`Ø ${kpis.avgPointsPerAccount} P./Konto`} />
            <StatCard icon={Gift}        label="Einlösungsrate"        value={`${kpis.redemptionRate} %`}          sub="eingelöst vs. verdient" />
          </div>

          {/* Tier-Verteilung */}
          <div className="rounded-lg border bg-card p-4">
            <h2 className="font-semibold text-sm mb-3 flex items-center gap-1.5">
              <Star className="h-4 w-4 text-yellow-500" /> Tier-Verteilung
            </h2>
            <div className="grid grid-cols-4 gap-3">
              {(['bronze','silver','gold','platinum'] as LoyaltyTier[]).map((tier) => {
                const m = TIER_META[tier];
                const count = kpis.tierBreakdown[tier];
                return (
                  <div key={tier} className={cn('rounded-lg p-3 text-center', m.bg)}>
                    <div className="text-2xl mb-1">{m.icon}</div>
                    <div className={cn('font-semibold text-sm', m.color)}>{m.label}</div>
                    <div className="text-xl font-bold mt-1">{count}</div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Leaderboard */}
          <div className="rounded-lg border bg-card">
            <div className="px-4 py-3 border-b font-semibold flex items-center gap-2">
              <Trophy className="h-4 w-4 text-yellow-500" /> Top-Kunden Leaderboard
            </div>
            {leaderboard.length === 0 ? (
              <div className="p-6 text-center text-muted-foreground text-sm">
                Noch keine Loyalty-Punkte vergeben.
              </div>
            ) : (
              <div className="divide-y">
                {leaderboard.map((entry) => (
                  <div key={entry.accountId} className="flex items-center gap-3 px-4 py-3 hover:bg-accent/50">
                    {/* Rang */}
                    <div className="w-8 text-center font-bold text-lg text-muted-foreground">
                      {entry.rank === 1 ? '🥇' : entry.rank === 2 ? '🥈' : entry.rank === 3 ? '🥉' : `#${entry.rank}`}
                    </div>
                    {/* Kunden-Info */}
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">
                        {entry.customerName ?? entry.customerEmail}
                      </div>
                      <div className="text-xs text-muted-foreground truncate">
                        {entry.customerEmail}
                      </div>
                    </div>
                    {/* Tier */}
                    <TierBadge tier={entry.tier} />
                    {/* Punkte */}
                    <div className="text-right">
                      <div className="font-bold text-sm">{entry.totalPoints.toLocaleString('de-DE')} P</div>
                      <div className="text-xs text-muted-foreground">{entry.lifetimePoints.toLocaleString('de-DE')} gesamt</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {/* Manuelle Punkte-Anpassung */}
      <div className="rounded-lg border bg-card p-4">
        <h2 className="font-semibold text-sm mb-3">Manuelle Punkte-Anpassung</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <input
            type="email"
            value={adjustEmail}
            onChange={(e) => setAdjustEmail(e.target.value)}
            placeholder="Kunden-E-Mail"
            className="rounded-md border bg-background px-3 py-2 text-sm"
          />
          <input
            type="number"
            value={adjustPoints}
            onChange={(e) => setAdjustPoints(e.target.value)}
            placeholder="Punkte (z.B. 100)"
            min={1}
            className="rounded-md border bg-background px-3 py-2 text-sm"
          />
          <input
            type="text"
            value={adjustReason}
            onChange={(e) => setAdjustReason(e.target.value)}
            placeholder="Begründung"
            className="rounded-md border bg-background px-3 py-2 text-sm"
          />
        </div>
        <div className="flex gap-2 mt-3">
          <button
            onClick={() => void submitAdjust(1)}
            disabled={adjusting}
            className="flex items-center gap-1.5 rounded-md bg-emerald-600 px-3 py-1.5 text-sm text-white hover:bg-emerald-700 disabled:opacity-50"
          >
            <Plus className="h-3.5 w-3.5" /> Hinzufügen
          </button>
          <button
            onClick={() => void submitAdjust(-1)}
            disabled={adjusting}
            className="flex items-center gap-1.5 rounded-md bg-rose-600 px-3 py-1.5 text-sm text-white hover:bg-rose-700 disabled:opacity-50"
          >
            <Minus className="h-3.5 w-3.5" /> Abziehen
          </button>
        </div>
        {adjustMsg && (
          <p className={cn('mt-2 text-sm', adjustMsg.startsWith('✓') ? 'text-emerald-600' : 'text-rose-600')}>
            {adjustMsg}
          </p>
        )}
      </div>

      {!loading && kpis && kpis.totalAccounts === 0 && (
        <div className="rounded-lg border border-dashed bg-muted/30 p-6 text-center text-sm text-muted-foreground">
          <Trophy className="h-8 w-8 mx-auto mb-2 opacity-30" />
          Noch kein Loyalty-Konto angelegt. Punkte werden automatisch nach jeder Lieferung vergeben,
          sofern eine E-Mail-Adresse in der Bestellung hinterlegt ist.
        </div>
      )}
    </div>
  );
}
