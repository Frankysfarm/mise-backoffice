import { Suspense } from 'react';
import { Metadata } from 'next';
import { requireManagerPlus } from '@/lib/auth/requireRole';
import { TourSurveyClient } from './client';

export const metadata: Metadata = {
  title: 'Fahrer-Feedback-Terminal | Mise Delivery',
};

export default async function TourSurveyPage() {
  await requireManagerPlus();
  return (
    <Suspense fallback={<div className="p-8 text-sm text-muted-foreground">Lade Umfrage-Auswertung…</div>}>
      <TourSurveyClient />
    </Suspense>
  );
}
