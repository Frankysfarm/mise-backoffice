import { DeliveryProgressDashboard } from './client';

export const metadata = { title: 'Smart Delivery System — Fortschritt' };
export const revalidate = 60;

async function fetchGitHubData() {
  const REPO = 'Frankysfarm/mise-backoffice';
  try {
    const [commitsRes, progressRes] = await Promise.all([
      fetch(`https://api.github.com/repos/${REPO}/commits?per_page=30`, { next: { revalidate: 60 } }),
      fetch(`https://api.github.com/repos/${REPO}/contents/DELIVERY_PROGRESS.md`, { next: { revalidate: 60 } }),
    ]);
    const commits = commitsRes.ok ? await commitsRes.json() : [];
    const progressData = progressRes.ok ? await progressRes.json() : null;
    const progressContent = progressData?.content ? Buffer.from(progressData.content, 'base64').toString('utf-8') : '';
    return { commits, progressContent };
  } catch (e) {
    return { commits: [], progressContent: '' };
  }
}

export default async function Page() {
  const data = await fetchGitHubData();
  return <DeliveryProgressDashboard commits={data.commits} progressContent={data.progressContent} />;
}
