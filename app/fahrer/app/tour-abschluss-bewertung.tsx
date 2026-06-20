'use client';
/**
 * FahrerTourAbschlussBewertung
 * After-tour feedback card in the driver app.
 * Shows when batch is completed; lets driver rate difficulty/traffic/customer issues.
 */
import { useState, useEffect } from 'react';
import { Star, CheckCircle, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  batchId: string | null;
  driverId: string | null;
  locationId: string | null;
  batchState: string | null;
}

function StarPicker({ value, onChange, label }: { value: number; onChange: (v: number) => void; label: string }) {
  return (
    <div className="flex flex-col items-center gap-1">
      <span className="text-[10px] text-white/60 font-semibold">{label}</span>
      <div className="flex gap-0.5">
        {[1, 2, 3, 4, 5].map((s) => (
          <button key={s} onClick={() => onChange(s)}>
            <Star
              className={cn('h-5 w-5 transition-colors', s <= value ? 'text-yellow-400 fill-yellow-400' : 'text-white/30')}
            />
          </button>
        ))}
      </div>
    </div>
  );
}

export function FahrerTourAbschlussBewertung({ batchId, driverId, locationId, batchState }: Props) {
  const [submitted, setSubmitted]     = useState(false);
  const [alreadyDone, setAlreadyDone] = useState(false);
  const [loading, setLoading]         = useState(true);
  const [submitting, setSubmitting]   = useState(false);

  const [difficulty, setDifficulty] = useState(3);
  const [traffic, setTraffic]       = useState(3);
  const [customer, setCustomer]     = useState(3);
  const [issues, setIssues]         = useState({
    parking: false, customer_issue: false, nav: false, address: false,
  });
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (!batchId || !driverId) { setLoading(false); return; }
    const check = async () => {
      try {
        const res = await fetch(`/api/delivery/driver/tour-feedback?batch_id=${batchId}&driver_id=${driverId}`);
        if (res.ok) {
          const j = await res.json() as { feedback: unknown };
          if (j.feedback) setAlreadyDone(true);
        }
      } catch { /* ignore */ }
      finally { setLoading(false); }
    };
    check();
  }, [batchId, driverId]);

  const isCompleted = batchState === 'completed' || batchState === 'closed';
  if (!isCompleted || !batchId || !driverId || !locationId || loading || alreadyDone) return null;

  const toggleIssue = (key: keyof typeof issues) =>
    setIssues((prev) => ({ ...prev, [key]: !prev[key] }));

  const submit = async () => {
    setSubmitting(true);
    try {
      await fetch('/api/delivery/driver/tour-feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          batch_id:           batchId,
          driver_id:          driverId,
          location_id:        locationId,
          difficulty_rating:  difficulty,
          traffic_rating:     traffic,
          customer_rating:    customer,
          had_parking_issue:  issues.parking,
          had_customer_issue: issues.customer_issue,
          had_nav_issue:      issues.nav,
          had_address_issue:  issues.address,
          driver_notes:       notes.trim() || undefined,
        }),
      });
      setSubmitted(true);
    } catch { /* ignore */ }
    finally { setSubmitting(false); }
  };

  if (submitted) {
    return (
      <div className="mx-4 mb-4 rounded-2xl bg-emerald-900/50 border border-emerald-700 p-4 flex items-center gap-3">
        <CheckCircle className="h-5 w-5 text-emerald-400" />
        <p className="text-sm font-semibold text-emerald-300">Bewertung gespeichert — Danke!</p>
      </div>
    );
  }

  const issueLabels: { key: keyof typeof issues; label: string }[] = [
    { key: 'parking',        label: '🅿 Parken' },
    { key: 'customer_issue', label: '👤 Kunde' },
    { key: 'nav',            label: '🗺 Navigation' },
    { key: 'address',        label: '📍 Adresse' },
  ];

  return (
    <div className="mx-4 mb-4 rounded-2xl bg-slate-800/80 border border-slate-700 p-4 space-y-4">
      <p className="text-sm font-bold text-white">Tour abgeschlossen — kurze Bewertung?</p>

      {/* Star pickers */}
      <div className="flex justify-around">
        <StarPicker value={difficulty} onChange={setDifficulty} label="Schwierigkeitsgrad" />
        <StarPicker value={traffic}    onChange={setTraffic}    label="Verkehrslage" />
        <StarPicker value={customer}   onChange={setCustomer}   label="Kunden" />
      </div>

      {/* Issue chips */}
      <div className="flex flex-wrap gap-2">
        {issueLabels.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => toggleIssue(key)}
            className={cn(
              'rounded-full px-3 py-1 text-xs font-semibold border transition-colors',
              issues[key]
                ? 'bg-red-900/50 border-red-500 text-red-300'
                : 'bg-slate-700 border-slate-600 text-slate-300'
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Notes */}
      <textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="Anmerkungen (optional)…"
        rows={2}
        className="w-full rounded-xl bg-slate-700/80 border border-slate-600 px-3 py-2 text-xs text-white placeholder-slate-400 resize-none focus:outline-none focus:ring-1 focus:ring-slate-500"
      />

      <button
        onClick={submit}
        disabled={submitting}
        className="w-full rounded-xl bg-matcha-600 hover:bg-matcha-500 disabled:opacity-50 text-white text-sm font-bold py-2.5 transition-colors flex items-center justify-center gap-2"
      >
        {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
        {submitting ? 'Speichern…' : 'Bewertung absenden'}
      </button>
    </div>
  );
}
