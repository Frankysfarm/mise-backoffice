'use client';

/**
 * DispatchDriverFeedbackScorePanel — Phase 359
 * Shows top-5 drivers sorted by f_feedback score
 * 5-Min-Polling, collapsible, only shows if f_feedback > 0 for any driver
 */

import React, { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, MessageSquare } from 'lucide-react';

type ScoreGrade = 'A+' | 'A' | 'B' | 'C' | 'D';

interface LeaderboardEntry {
  driverId: string;
  driverName: string | null;
  initials: string;
  compositeScore: number;
  grade: ScoreGrade;
  fFeedback: number;
}

const GRADE_COLORS: Record<ScoreGrade, string> = {
  'A+': 'bg-emerald-100 text-emerald-800',
  'A':  'bg-green-100 text-green-800',
  'B':  'bg-blue-100 text-blue-800',
  'C':  'bg-amber-100 text-amber-800',
  'D':  'bg-red-100 text-red-800',
};

export function DispatchDriverFeedbackScorePanel() {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [open, setOpen] = useState(true);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const res = await fetch('/api/delivery/admin/driver-score?action=leaderboard&period=week&limit=10');
        if (!res.ok) return;
        const d = await res.json();
        const all: LeaderboardEntry[] = d.entries ?? [];
        const withFeedback = all
          .filter(e => e.fFeedback > 0)
          .sort((a, b) => b.fFeedback - a.fFeedback)
          .slice(0, 5);
        if (!cancelled) { setEntries(withFeedback); setLoaded(true); }
      } catch { setLoaded(true); }
    };

    load();
    const iv = setInterval(load, 5 * 60 * 1000);
    return () => { cancelled = true; clearInterval(iv); };
  }, []);

  if (!loaded || entries.length === 0) return null;

  return (
    <div className="mt-3 rounded-xl border bg-card overflow-hidden">
      <button
        onClick={() => setOpen((o: boolean) => !o)}
        className="flex w-full items-center justify-between px-4 py-3 hover:bg-muted/50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <MessageSquare className="h-4 w-4 text-emerald-600" />
          <span className="text-sm font-semibold">Top Feedback-Fahrer</span>
          <span className="rounded-full bg-emerald-100 px-1.5 py-0.5 text-[10px] font-bold text-emerald-800">
            {entries.length}
          </span>
        </div>
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>

      {open && (
        <div className="divide-y">
          {entries.map((e: LeaderboardEntry) => (
            <div key={e.driverId} className="flex items-center gap-3 px-4 py-2.5">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-xs font-bold text-emerald-700">
                {e.initials}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium truncate">{e.driverName ?? e.driverId.slice(0, 8)}</span>
                  <span className={`inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-bold ${GRADE_COLORS[e.grade]}`}>
                    {e.grade}
                  </span>
                </div>
                <div className="mt-1 h-1.5 rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full rounded-full bg-emerald-500"
                    style={{ width: `${Math.min(100, (e.fFeedback / 5) * 100)}%` }}
                  />
                </div>
              </div>
              <div className="text-right shrink-0">
                <div className="text-sm font-bold">{e.fFeedback.toFixed(2)}</div>
                <div className="text-[10px] text-muted-foreground">/ 5</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default DispatchDriverFeedbackScorePanel;
