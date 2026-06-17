export default function NotFoundPage() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-4 animate-fade-in">
      <div className="text-center max-w-sm">
        <p className="text-6xl mb-4">🔍</p>
        <h1 className="text-2xl font-bold text-[var(--text)] mb-2">Link not found</h1>
        <p className="text-[var(--muted)] text-sm mb-6">
          This short link doesn't exist. Double-check the URL or ask whoever sent it to you.
        </p>
        <a href="/" className="btn-primary">
          Go home
        </a>
      </div>
    </main>
  );
}
