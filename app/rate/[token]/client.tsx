'use client';

import { useState } from 'react';

interface Props {
  token: string;
  orderId: string | null;
  bestellnummer: string | null;
  orderStatus: string | null;
  alreadyRated: boolean;
  validToken: boolean;
}

const STAR_LABELS = ['', 'Sehr schlecht', 'Schlecht', 'Ok', 'Gut', 'Ausgezeichnet'];
const STAR_COLORS = ['', 'text-red-500', 'text-orange-400', 'text-yellow-400', 'text-lime-500', 'text-green-500'];

export default function RatingClient({
  token,
  orderId,
  bestellnummer,
  orderStatus,
  alreadyRated: initialAlreadyRated,
  validToken,
}: Props) {
  const [hoveredStar, setHoveredStar] = useState(0);
  const [selectedStar, setSelectedStar] = useState(0);
  const [comment, setComment]   = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted]   = useState(initialAlreadyRated);
  const [error, setError] = useState<string | null>(null);

  if (!validToken) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-sm p-8 max-w-sm w-full text-center">
          <div className="text-4xl mb-4">🔗</div>
          <h1 className="text-xl font-semibold text-gray-900 mb-2">Link ungültig</h1>
          <p className="text-gray-500 text-sm">
            Dieser Bewertungs-Link ist abgelaufen oder ungültig.
          </p>
        </div>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-sm p-8 max-w-sm w-full text-center">
          <div className="text-5xl mb-4">🎉</div>
          <h1 className="text-xl font-semibold text-gray-900 mb-2">Danke für dein Feedback!</h1>
          <p className="text-gray-500 text-sm">
            Deine Bewertung hilft uns, unsere Lieferung zu verbessern.
          </p>
        </div>
      </div>
    );
  }

  async function handleSubmit() {
    if (!selectedStar || !orderId) return;
    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch(`/api/delivery/orders/${orderId}/rate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, rating: selectedStar, comment: comment.trim() || undefined }),
      });
      const data = await res.json() as { ok?: boolean; error?: string; alreadyRated?: boolean };
      if (data.ok) {
        setSubmitted(true);
      } else {
        setError(data.error ?? 'Fehler beim Speichern.');
      }
    } catch {
      setError('Netzwerkfehler. Bitte erneut versuchen.');
    } finally {
      setSubmitting(false);
    }
  }

  const displayStar = hoveredStar || selectedStar;

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-sm p-8 max-w-sm w-full">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="text-3xl mb-3">🛵</div>
          <h1 className="text-xl font-semibold text-gray-900">Wie war deine Lieferung?</h1>
          {bestellnummer && (
            <p className="text-sm text-gray-400 mt-1">Bestellung #{bestellnummer}</p>
          )}
        </div>

        {/* Sterne */}
        <div className="flex justify-center gap-2 mb-3">
          {[1, 2, 3, 4, 5].map(star => (
            <button
              key={star}
              type="button"
              onClick={() => setSelectedStar(star)}
              onMouseEnter={() => setHoveredStar(star)}
              onMouseLeave={() => setHoveredStar(0)}
              className="text-4xl transition-transform hover:scale-110 focus:outline-none"
              aria-label={`${star} Stern${star !== 1 ? 'e' : ''}`}
            >
              <span className={star <= displayStar ? STAR_COLORS[displayStar] : 'text-gray-200'}>
                ★
              </span>
            </button>
          ))}
        </div>

        {/* Star-Label */}
        <p className={`text-center text-sm font-medium mb-5 h-5 ${displayStar ? STAR_COLORS[displayStar] : 'text-transparent'}`}>
          {STAR_LABELS[displayStar]}
        </p>

        {/* Kommentar */}
        <textarea
          value={comment}
          onChange={e => setComment(e.target.value)}
          placeholder="Optionaler Kommentar…"
          rows={3}
          maxLength={500}
          className="w-full border border-gray-200 rounded-xl p-3 text-sm text-gray-800 placeholder-gray-400 resize-none focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-300 mb-4"
        />

        {error && (
          <p className="text-red-500 text-sm text-center mb-3">{error}</p>
        )}

        {/* Absenden */}
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!selectedStar || submitting}
          className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-200 disabled:text-gray-400 text-white font-semibold py-3 rounded-xl transition-colors"
        >
          {submitting ? 'Wird gespeichert…' : 'Bewertung abschicken'}
        </button>

        {!selectedStar && (
          <p className="text-center text-xs text-gray-400 mt-3">Wähle zuerst eine Bewertung aus</p>
        )}
      </div>
    </div>
  );
}
