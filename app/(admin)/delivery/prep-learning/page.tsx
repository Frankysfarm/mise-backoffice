import type { Metadata } from 'next';
import PrepLearningClient from './client';

export const metadata: Metadata = { title: 'Küchen-Lernkurve | Mise Delivery' };

export default function PrepLearningPage() {
  return <PrepLearningClient />;
}
