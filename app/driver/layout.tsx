export const dynamic = 'force-dynamic';
export const metadata = { title: 'MISE Driver · Mise' };

export default function DriverLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="dark bg-zinc-950 text-white min-h-screen">
      {children}
    </div>
  );
}
