import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-surface">
      <main className="mx-auto flex min-h-screen max-w-lg flex-col items-center justify-center px-6 text-center">
        <div className="mb-4 text-6xl">🍵</div>
        <h1 className="font-display text-2xl font-bold">Diese Bestellung kennen wir nicht.</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Prüfe, ob die Bestellnummer korrekt ist — oder frag direkt bei uns nach.
        </p>
        <Link
          href="https://www.frankys-home.de"
          className="mt-6 inline-flex h-10 items-center rounded-full bg-matcha-700 px-5 text-sm font-semibold text-white hover:bg-matcha-800"
        >
          Zurück zur Seite
        </Link>
      </main>
    </div>
  );
}
