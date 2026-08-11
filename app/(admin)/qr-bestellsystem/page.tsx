import { redirect } from 'next/navigation';

export default function LegacyQrOrderingRedirect() {
  redirect('/neo/app/tischbestellung');
}
