"use client";

import { useState } from "react";

interface CreatedLink {
  id: string;
  slug: string;
  originalUrl: string;
  title: string | null;
  goLiveAt: string | null;
  expiresAt: string | null;
  clickCap: number | null;
}

interface ShortenFormProps {
  onCreated?: () => void;
}

export function ShortenForm({ onCreated }: ShortenFormProps = {}) {
  const [url, setUrl] = useState("");
  const [alias, setAlias] = useState("");
  const [title, setTitle] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [goLiveAt, setGoLiveAt] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [clickCap, setClickCap] = useState("");
  const [capFallbackUrl, setCapFallbackUrl] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CreatedLink | null>(null);
  const [copied, setCopied] = useState(false);

  const base =
    typeof window !== "undefined"
      ? window.location.origin
      : process.env.NEXT_PUBLIC_BASE_URL ?? "";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setResult(null);
    setLoading(true);

    try {
      const res = await fetch("/api/links", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          originalUrl: url,
          customSlug: alias || undefined,
          title: title || undefined,
          goLiveAt: goLiveAt || undefined,
          expiresAt: expiresAt || undefined,
          clickCap: clickCap || undefined,
          capFallbackUrl: capFallbackUrl || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Something went wrong");
      } else {
        setResult(data.link);
        onCreated?.();
        setUrl("");
        setAlias("");
        setTitle("");
        setGoLiveAt("");
        setExpiresAt("");
        setClickCap("");
        setCapFallbackUrl("");
        setShowAdvanced(false);
      }
    } catch {
      setError("Network error — please try again");
    } finally {
      setLoading(false);
    }
  }

  function handleCopy() {
    if (!result) return;
    navigator.clipboard.writeText(`${base}/${result.slug}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="card animate-slide-up">
      {result ? (
        /* ── Success state ── */
        <div className="space-y-4 animate-fade-in">
          <div className="flex items-center gap-2 text-[var(--success)] text-sm font-medium">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
            Link created!
          </div>

          <div className="rounded-xl bg-[var(--surface-2)] border border-[var(--border)] p-4 flex items-center gap-3">
            <div className="flex-1 min-w-0">
              <p className="mono text-[var(--brand-light)] font-semibold text-sm truncate">
                {base}/{result.slug}
              </p>
              <p className="text-[var(--muted)] text-xs truncate mt-0.5">
                → {result.originalUrl}
              </p>
            </div>
            <button onClick={handleCopy} className="btn-ghost shrink-0 text-xs">
              {copied ? "✓ Copied" : "Copy"}
            </button>
          </div>

          <div className="flex gap-2">
            <a href="/dashboard" className="btn-ghost flex-1 text-center text-xs">
              View Dashboard
            </a>
            <button
              onClick={() => setResult(null)}
              className="btn-primary flex-1 text-xs"
            >
              Shorten another
            </button>
          </div>
        </div>
      ) : (
        /* ── Form ── */
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-[var(--muted)] mb-1.5">
              Long URL *
            </label>
            <input
              className="input"
              type="url"
              placeholder="https://forms.gle/your-registration-form"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-[var(--muted)] mb-1.5">
                Custom alias
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)] text-xs pointer-events-none">
                  flcut/
                </span>
                <input
                  className="input pl-10"
                  type="text"
                  placeholder="hackfest26"
                  value={alias}
                  onChange={(e) => setAlias(e.target.value.toLowerCase())}
                  pattern="[a-z0-9][a-z0-9\-]{0,48}[a-z0-9]|[a-z0-9]{1,2}"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-[var(--muted)] mb-1.5">
                Label (optional)
              </label>
              <input
                className="input"
                type="text"
                placeholder="Hackfest 2026 Registration"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>
          </div>

          {/* ── Advanced toggle ── */}
          <button
            type="button"
            onClick={() => setShowAdvanced((v) => !v)}
            className="text-xs text-[var(--muted)] hover:text-[var(--text)] transition-colors flex items-center gap-1"
          >
            <span className={`transition-transform ${showAdvanced ? "rotate-90" : ""}`}>▶</span>
            Schedule, expiry & click cap
          </button>

          {showAdvanced && (
            <div className="space-y-3 pt-1 animate-slide-up">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-[var(--muted)] mb-1.5">
                    Go live at
                  </label>
                  <input
                    className="input"
                    type="datetime-local"
                    value={goLiveAt}
                    onChange={(e) => setGoLiveAt(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[var(--muted)] mb-1.5">
                    Expires at
                  </label>
                  <input
                    className="input"
                    type="datetime-local"
                    value={expiresAt}
                    onChange={(e) => setExpiresAt(e.target.value)}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-[var(--muted)] mb-1.5">
                    Click cap
                  </label>
                  <input
                    className="input"
                    type="number"
                    placeholder="100"
                    min="1"
                    value={clickCap}
                    onChange={(e) => setClickCap(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[var(--muted)] mb-1.5">
                    Cap fallback URL
                  </label>
                  <input
                    className="input"
                    type="url"
                    placeholder="https://waitlist.example.com"
                    value={capFallbackUrl}
                    onChange={(e) => setCapFallbackUrl(e.target.value)}
                  />
                </div>
              </div>
            </div>
          )}

          {error && (
            <p className="text-xs text-[var(--danger)] bg-[rgba(248,113,113,0.08)] border border-[rgba(248,113,113,0.2)] rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <button type="submit" className="btn-primary w-full" disabled={loading}>
            {loading ? (
              <span className="flex items-center gap-2">
                <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Shortening…
              </span>
            ) : (
              "Shorten link →"
            )}
          </button>
        </form>
      )}
    </div>
  );
}
