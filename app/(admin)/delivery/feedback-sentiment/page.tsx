import { Suspense } from 'react';
import FeedbackSentimentClient from './client';

export const dynamic = 'force-dynamic';

export default function FeedbackSentimentPage() {
  return (
    <Suspense fallback={<div className="p-8 text-gray-500">Lade Feedback-Analyse…</div>}>
      <FeedbackSentimentClient />
    </Suspense>
  );
}
