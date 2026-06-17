"use client";

import { useEffect, useState } from "react";
import { LinkCard } from "@/components/LinkCard";
import { ShortenForm } from "@/components/ShortenForm";

interface Link {
  id: string;
  slug: string;
  originalUrl: string;
  title: string | null;
  isActive: boolean;
  createdAt: string;
  goLiveAt: string | null;
  expiresAt: string | null;
  clickCap: number | null;
}

export default function DashboardPage() {
  const [links, setLinks] = useState<Link[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);

  async function fetchLinks() {
    const res = await fetch("/api/links");
    const data = await res.json();
    setLinks(data.links ?? []);
    setLoading(false);
  }

  useEffect(() => {
    fetchLinks();
  }, []);

  async function handleDelete(id: string) {
    await fetch(`/api/links/${id}`, { method: "DELETE" });
    setLinks((prev) => prev.filter((l) => l.id !== id));
  }

  async function handleToggle(id: string, isActive: boolean) {
    await fetch(`/api/links/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive }),
    });
    setLinks((prev) =>
      prev.map((l) => (l.id === id ? { ...l, isActive } : l))
    );
  }

  return (
    <main className="min-h-screen">
      {/* Nav */}
      <nav className="flex items-center justify-between px-6 py-4 border-b border-[var(--border)]">
        <a href="/" className="flex items-center gap-2">
          <span className="text-xl font-bold tracking-tight">
            <span className="text-[var(--brand-light)]">FL</span>
            <span className="text-[var(--text)]">Cut</span>
          </span>
        </a>
        <button
          onClick={() => { setShowNew((v) => !v); }}
          className="btn-primary text-xs"
        >
          {showNew ? "Cancel" : "+ New link"}
        </button>
      </nav>

      <div className="max-w-3xl mx-auto px-4 py-10 space-y-8">
        {/* Inline new-link form */}
        {showNew && (
          <div className="animate-slide-up">
            <p className="text-xs font-medium text-[var(--muted)] mb-3">New link</p>
            <ShortenForm
              onCreated={() => {
                setShowNew(false);
                fetchLinks();
              }}
            />
          </div>
        )}

        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-[var(--text)]">My Links</h1>
          <p className="text-sm text-[var(--muted)] mt-1">
            Links are tied to this browser session — no account needed.
          </p>
        </div>

        {/* Links list */}
        {loading ? (
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="skeleton h-24 w-full" />
            ))}
          </div>
        ) : links.length === 0 ? (
          <div className="card text-center py-16">
            <p className="text-4xl mb-3">🔗</p>
            <p className="text-[var(--text)] font-medium">No links yet</p>
            <p className="text-[var(--muted)] text-sm mt-1">
              Create your first short link above.
            </p>
          </div>
        ) : (
          <div className="space-y-4 animate-fade-in">
            {links.map((link) => (
              <LinkCard
                key={link.id}
                link={link}
                onDelete={handleDelete}
                onToggle={handleToggle}
              />
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
