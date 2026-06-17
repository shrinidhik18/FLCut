"use client";

import { useState } from "react";
import { AnalyticsModal } from "@/components/AnalyticsModal";
import { format, isPast, isFuture } from "date-fns";

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

interface Props {
  link: Link;
  onDelete: (id: string) => void;
  onToggle: (id: string, isActive: boolean) => void;
}

function getLinkStatus(link: Link): "active" | "expired" | "pending" | "inactive" {
  if (!link.isActive) return "inactive";
  const now = new Date();
  if (link.expiresAt && isPast(new Date(link.expiresAt))) return "expired";
  if (link.goLiveAt && isFuture(new Date(link.goLiveAt))) return "pending";
  return "active";
}

const statusConfig = {
  active:   { label: "Active",      cls: "badge-active" },
  expired:  { label: "Expired",     cls: "badge-expired" },
  pending:  { label: "Scheduled",   cls: "badge-pending" },
  inactive: { label: "Paused",      cls: "badge-inactive" },
};

export function LinkCard({ link, onDelete, onToggle }: Props) {
  const [showAnalytics, setShowAnalytics] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [copied, setCopied] = useState(false);

  const base = typeof window !== "undefined" ? window.location.origin : "";
  const shortUrl = `${base}/${link.slug}`;
  const status = getLinkStatus(link);
  const { label, cls } = statusConfig[status];

  function handleCopy() {
    navigator.clipboard.writeText(shortUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <>
      <div className="card group hover:border-[var(--border-hover)] transition-all duration-200">
        {/* Top row */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`badge ${cls}`}>
                <span className="w-1.5 h-1.5 rounded-full bg-current" />
                {label}
              </span>
              {link.title && (
                <span className="text-sm font-semibold text-[var(--text)] truncate">
                  {link.title}
                </span>
              )}
            </div>
            {/* Short URL */}
            <button
              onClick={handleCopy}
              className="mono text-[var(--brand-light)] text-sm font-medium hover:text-[var(--brand)] transition-colors mt-1.5 text-left"
            >
              {shortUrl}
              <span className="ml-2 text-[10px] text-[var(--muted)] opacity-0 group-hover:opacity-100 transition-opacity">
                {copied ? "✓ copied" : "click to copy"}
              </span>
            </button>
            {/* Original URL */}
            <p className="text-xs text-[var(--muted)] truncate mt-0.5 max-w-xs sm:max-w-sm">
              → {link.originalUrl}
            </p>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => setShowAnalytics(true)}
              className="btn-ghost text-xs"
              title="View analytics"
            >
              📊 Stats
            </button>
            <button
              onClick={() => onToggle(link.id, !link.isActive)}
              className="btn-ghost text-xs"
              title={link.isActive ? "Pause" : "Resume"}
            >
              {link.isActive ? "⏸" : "▶"}
            </button>
            {!confirmDelete ? (
              <button
                onClick={() => setConfirmDelete(true)}
                className="btn-danger text-xs"
                title="Delete"
              >
                🗑
              </button>
            ) : (
              <div className="flex gap-1">
                <button
                  onClick={() => onDelete(link.id)}
                  className="btn-danger text-xs"
                >
                  Confirm
                </button>
                <button
                  onClick={() => setConfirmDelete(false)}
                  className="btn-ghost text-xs"
                >
                  Cancel
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Meta row */}
        <div className="mt-3 pt-3 border-t border-[var(--border)] flex flex-wrap gap-x-4 gap-y-1 text-xs text-[var(--muted)]">
          <span>Created {format(new Date(link.createdAt), "MMM d, yyyy")}</span>
          {link.goLiveAt && (
            <span>
              🕐 Live {format(new Date(link.goLiveAt), "MMM d HH:mm")}
            </span>
          )}
          {link.expiresAt && (
            <span>
              ⏱ Expires {format(new Date(link.expiresAt), "MMM d HH:mm")}
            </span>
          )}
          {link.clickCap && (
            <span>🎯 Cap: {link.clickCap} clicks</span>
          )}
        </div>
      </div>

      {showAnalytics && (
        <AnalyticsModal linkId={link.id} slug={link.slug} onClose={() => setShowAnalytics(false)} />
      )}
    </>
  );
}
