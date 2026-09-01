export default function TeamNotFound() {
  return (
    <main className="grid min-h-[100dvh] place-items-center bg-white px-6 text-center">
      <div className="max-w-sm">
        <h1 className="font-display text-2xl font-bold tracking-tight text-slate-900">Diesen Betrieb gibt es nicht.</h1>
        <p className="mt-3 text-[15px] leading-relaxed text-slate-600">
          Prüfe den Link, den du von deiner Schichtleitung bekommen hast, oder melde dich über den allgemeinen Team-Eingang an.
        </p>
        <a href="/team" className="mt-6 inline-flex h-12 items-center justify-center rounded-2xl bg-slate-900 px-6 font-semibold text-white">Zum Team-Eingang</a>
      </div>
    </main>
  );
}
