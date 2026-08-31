import { ApplicantAssessment } from './test';
export default async function ApplicantAssessmentPage({ params }: { params: Promise<{ token: string }> }) { const { token } = await params; return <main className="min-h-screen bg-slate-50 px-4 py-8"><ApplicantAssessment token={token} /></main>; }
