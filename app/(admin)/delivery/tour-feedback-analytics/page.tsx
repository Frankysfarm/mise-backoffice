import { Suspense } from 'react';
import { TourFeedbackAnalyticsClient } from './client';

export const metadata = { title: 'Feedback Analytics' };

export default function TourFeedbackAnalyticsPage() {
  return (
    <Suspense fallback={<div className="p-8 text-slate-400">Lade Feedback-Analytics…</div>}>
      <TourFeedbackAnalyticsClient />
    </Suspense>
  );
}
