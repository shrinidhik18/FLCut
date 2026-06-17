"use client";

import { useState } from "react";
import { ShortenForm } from "@/components/ShortenForm";

export default function HomePage() {
  return (
    <main className="min-h-screen flex flex-col">
      {/* ── Nav ───────────────────────────────────────────────────────────── */}
      <nav className="flex items-center justify-between px-6 py-4 border-b border-[var(--border)]">
        <div className="flex items-center gap-2">
          <span className="text-xl font-bold tracking-tight">
            <span className="text-[var(--brand-light)]">FL</span>
            <span className="text-[var(--text)]">Cut</span>
          </span>
          <span className="text-[10px] font-medium uppercase tracking-widest text-[var(--muted)] bg-[var(--surface-2)] border border-[var(--border)] rounded-full px-2 py-0.5">
            beta
          </span>
        </div>
        <a href="/dashboard" className="btn-ghost text-xs">
          My Links →
        </a>
      </nav>

      {/* ── Hero ──────────────────────────────────────────────────────────── */}
      <section className="flex-1 flex flex-col items-center justify-center px-4 py-16 animate-fade-in">
        <div className="text-center mb-10 max-w-2xl">
          <div className="inline-flex items-center gap-2 text-xs font-medium text-[var(--brand-light)] bg-[rgba(99,102,241,0.1)] border border-[rgba(99,102,241,0.2)] rounded-full px-3 py-1.5 mb-6">
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--brand-light)] animate-pulse-soft" />
            Built for Finite Loop Club events
          </div>
          <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-[var(--text)] mb-4 leading-tight">
            Short links that{" "}
            <span className="bg-gradient-to-r from-[var(--brand-light)] to-[var(--brand)] bg-clip-text text-transparent">
              actually tell you something
            </span>
          </h1>
          <p className="text-[var(--muted)] text-base sm:text-lg leading-relaxed">
            Shorten a registration link, give it a name, share it on WhatsApp
            and Instagram — then see which one actually drove signups. 
            No account needed.
          </p>
        </div>

        {/* ── Form card ─────────────────────────────────────────────────── */}
        <div className="w-full max-w-xl">
          <ShortenForm />
        </div>

        {/* ── Feature pills ─────────────────────────────────────────────── */}
        <div className="mt-12 flex flex-wrap justify-center gap-3">
          {[
            { icon: "⚡", label: "Custom aliases" },
            { icon: "📅", label: "Schedule go-live" },
            { icon: "⏱️", label: "Auto-expiry" },
            { icon: "🎯", label: "Click cap & waitlist" },
            { icon: "📊", label: "Real analytics" },
            { icon: "🤖", label: "Bot filtering" },
          ].map(({ icon, label }) => (
            <span
              key={label}
              className="flex items-center gap-1.5 text-xs text-[var(--muted)] bg-[var(--surface)] border border-[var(--border)] rounded-full px-3 py-1.5"
            >
              {icon} {label}
            </span>
          ))}
        </div>
      </section>

      {/* ── Footer ────────────────────────────────────────────────────────── */}
      <footer className="text-center py-5 text-xs text-[var(--muted)] border-t border-[var(--border)]">
        FLCut · Finite Loop Club ·{" "}
        <a
          href="https://github.com/finiteloop"
          className="hover:text-[var(--text)] transition-colors"
        >
          GitHub
        </a>
      </footer>
    </main>
  );
}
