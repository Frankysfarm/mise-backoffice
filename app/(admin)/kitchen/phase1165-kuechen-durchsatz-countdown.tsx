'use client';

import { useEffect, useMemo, useState } from 'react';
import { BarChart2, ChevronDown, ChevronUp, TrendingUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';

// Phase 1165 — Küchen-Durchsatz-Countdown
// Bestellungen pro 10-Min-Slot (letzte 60 Min) als Balkendiagramm + Hochrechnung Stundendurchsatz

interface Order {
  id: string;
  status?: string;
  bestellt_am?: string | null;
}

export function KitchenPhase1165KuechenDurchsatzCountdown({ orders }: { orders: Order[] }) {
  const [open, setOpen] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);

  const { slots, stundeSoll, hochrechnung, trend } = useMemo(() => {
    const SLOT_MIN = 10;
    const SLOTS = 6;
    const slotMs = SLOT_MIN * 60_000;
    const buckets: number[] = Array(SLOTS).fill(0);
    const cutoff = now - SLOTS * slotMs;

    for (const o of orders) {
      if (!o.bestellt_am) continue;
      const t = new Date(o.bestellt_am).getTime();
      if (t < cutoff) continue;
      const idx = Math.floor((now - t) / slotMs);
      if (idx >= 0 && idx < SLOTS) buckets[SLOTS - 1 - idx]++;
    }

    const labels = Array.from({ length: SLOTS }, (_, i) => {
      const ms = now - (SLOTS - 1 - i) * slotMs;
      const d = new Date(ms);
      return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    });

    const total60 = buckets.reduce((a, b) => a + b, 0);
    const hochrechnungVal = Math.round(total60 * (60 / (SLOTS * SLOT_MIN)));

    const firstHalf = buckets.slice(0, 3).reduce((a, b) => a + b, 0);
    const secHalf = buckets.slice(3).reduce((a, b) => a + b, 0);
    const trendVal: 'up' | 'down' | 'flat' = secHalf > firstHalf + 1 ? 'up' : secHalf < firstHalf - 1 ? 'down' : 'flat';

    return {
      slots: labels.map((label, i) => ({ label, value: buckets[i] })),
      stundeSoll: 30,
      hochrechnung: hochrechnungVal,
      trend: trendVal,
    };
  }, [orders, now]);

  const auslastungPct = Math.min(100, Math.round((hochrechnung / stundeSoll) * 100));
  const ampel = auslastungPct >= 90 ? 'rot' : auslastungPct >= 60 ? 'amber' : 'gruen';
  const barColor = ampel === 'rot' ? '#dc2626' : ampel === 'amber' ? '#d97706' : '#4d7c0f';
  const ampelBg = ampel === 'rot' ? 'bg-red-50 border-red-200' : ampel === 'amber' ? 'bg-amber-50 border-amber-200' : 'bg-matcha-50 border-matcha-200';
  const ampelText = ampel === 'rot' ? 'text-red-700' : ampel === 'amber' ? 'text-amber-700' : 'text-matcha-700';

  return (
    <div className={cn('rounded-2xl border overflow-hidden', ampelBg)}>
      <button onClick={() => setOpen(v => !v)} className="w-full flex items-center gap-2 px-4 py-3 hover:bg-black/5 transition">
        <BarChart2 size={16} className={ampelText} />
        <span className={cn('font-bold text-sm uppercase tracking-wider', ampelText)}>
          Küchen-Durchsatz
        </span>
        <span className={cn('ml-auto rounded-full text-white text-[10px] font-bold px-2 py-0.5', ampel === 'rot' ? 'bg-red-600' : ampel === 'amber' ? 'bg-amber-500' : 'bg-matcha-600')}>
          {hochrechnung}/Std Prognose
        </span>
        <TrendingUp size={14} className={cn(trend === 'up' ? 'text-red-500' : trend === 'down' ? 'text-matcha-600' : 'text-muted-foreground', 'rotate-0')} />
        {open ? <ChevronUp size={14} className={ampelText} /> : <ChevronDown size={14} className={ampelText} />}
      </button>

      {open && (
        <div className="border-t border-black/10 px-4 py-3 space-y-3">
          <div className="flex items-center gap-4 rounded-xl bg-white/60 border px-3 py-2">
            <div className="text-center">
              <div className={cn('text-2xl font-black tabular-nums', ampelText)}>{hochrechnung}</div>
              <div className="text-[9px] text-muted-foreground">Best./Std Hochrechnung</div>
            </div>
            <div className="flex-1">
              <div className="h-2 rounded-full bg-muted overflow-hidden">
                <div className="h-full rounded-full transition-all duration-700" style={{ width: `${auslastungPct}%`, backgroundColor: barColor }} />
              </div>
              <div className="flex justify-between mt-0.5">
                <span className="text-[9px] text-muted-foreground">0</span>
                <span className="text-[9px] text-muted-foreground">{stundeSoll} Ziel</span>
              </div>
            </div>
            <div className={cn('text-lg font-black tabular-nums', ampelText)}>{auslastungPct}%</div>
          </div>

          <div className="h-28">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={slots} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                <XAxis dataKey="label" tick={{ fontSize: 9 }} />
                <Tooltip formatter={(v: number) => [`${v} Best.`, 'Bestellungen']} />
                <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                  {slots.map((s, i) => <Cell key={i} fill={s.value >= 6 ? '#dc2626' : s.value >= 4 ? '#d97706' : barColor} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          <p className="text-[10px] text-muted-foreground text-center">
            Bestellungen je 10-Min-Slot — letzte 60 Min · Ziel: {stundeSoll} Best./Std
          </p>
        </div>
      )}
    </div>
  );
}
