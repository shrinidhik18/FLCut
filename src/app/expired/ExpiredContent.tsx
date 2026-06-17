"use client";

import { useSearchParams } from "next/navigation";

const reasons: Record<string, { icon: string; title: string; body: string }> = {
  expired: {
    icon: "⏰",
    title: "This link has expired",
    body: "The event registration or resource this link pointed to is no longer active.",
  },
  not_live_yet: {
    icon: "🕐",
    title: "Not open yet",
    body: "This link is scheduled but hasn't gone live yet. Check back when the event starts.",
  },
  capped: {
    icon: "🎯",
    title: "Spots filled up",
    body: "This link has hit its registration cap. If there's a waitlist, you would have been redirected automatically.",
  },
};

export function ExpiredContent() {
  const params = useSearchParams();
  const reason = params.get("reason") ?? "expired";
  const slug = params.get("slug");
  const cfg = reasons[reason] ?? reasons.expired;

  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-4 animate-fade-in">
      <div className="text-center max-w-sm">
        <p className="text-6xl mb-4">{cfg.icon}</p>
        <h1 className="text-2xl font-bold text-[var(--text)] mb-2">{cfg.title}</h1>
        <p className="text-[var(--muted)] text-sm mb-6">{cfg.body}</p>
        {slug && (
          <p className="mono text-xs text-[var(--muted)] mb-6 bg-[var(--surface-2)] border border-[var(--border)] rounded-lg px-3 py-2">
            /{slug}
          </p>
        )}
        <a href="/" className="btn-primary">
          Go to FLCut
        </a>
      </div>
    </main>
  );
}
