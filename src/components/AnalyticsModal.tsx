"use client";

import { useEffect, useState } from "react";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from "recharts";
import { format } from "date-fns";

interface Analytics {
  total: number;
  unique: number;
  byDay: { day: string; clicks: number }[];
  byReferrer: { referrer: string; cnt: number }[];
  byDevice: { device_type: string; cnt: number }[];
  byCountry: { country: string; cnt: number }[];
}

const COLORS = ["#6366f1", "#34d399", "#fbbf24", "#f87171", "#a78bfa", "#60a5fa"];

interface Props {
  linkId: string;
  slug: string;
  onClose: () => void;
}

export function AnalyticsModal({ linkId, slug, onClose }: Props) {
  const [data, setData] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/links/${linkId}`)
      .then((r) => r.json())
      .then((d) => {
        setData(d.analytics);
        setLoading(false);
      });

    // Close on Escape
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [linkId, onClose]);

  const chartData = (data?.byDay ?? []).map((row) => ({
    date: format(new Date(row.day), "MMM d"),
    clicks: Number(row.clicks),
  }));

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="card w-full max-w-2xl max-h-[90vh] overflow-y-auto animate-slide-up"
        style={{ border: "1px solid var(--border-hover)" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-lg font-bold text-[var(--text)]">
              Analytics
            </h2>
            <p className="mono text-xs text-[var(--brand-light)] mt-0.5">/{slug}</p>
          </div>
          <button onClick={onClose} className="btn-ghost text-xs w-8 h-8 p-0 flex items-center justify-center">
            ✕
          </button>
        </div>

        {loading ? (
          <div className="space-y-4">
            {[...Array(4)].map((_, i) => <div key={i} className="skeleton h-16 w-full" />)}
          </div>
        ) : !data ? (
          <p className="text-[var(--muted)] text-sm text-center py-8">No data yet.</p>
        ) : (
          <div className="space-y-6">
            {/* Stat pills */}
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl bg-[var(--surface-2)] border border-[var(--border)] p-4 text-center">
                <p className="text-3xl font-bold text-[var(--brand-light)]">{data.total}</p>
                <p className="text-xs text-[var(--muted)] mt-1">Total clicks</p>
              </div>
              <div className="rounded-xl bg-[var(--surface-2)] border border-[var(--border)] p-4 text-center">
                <p className="text-3xl font-bold text-[var(--success)]">{data.unique}</p>
                <p className="text-xs text-[var(--muted)] mt-1">Unique visitors</p>
              </div>
            </div>

            {/* Click timeline */}
            {chartData.length > 0 && (
              <div>
                <p className="text-xs font-medium text-[var(--muted)] mb-3">Clicks over last 14 days</p>
                <ResponsiveContainer width="100%" height={160}>
                  <LineChart data={chartData}>
                    <XAxis dataKey="date" tick={{ fill: "#8888a8", fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis allowDecimals={false} tick={{ fill: "#8888a8", fontSize: 11 }} axisLine={false} tickLine={false} width={28} />
                    <Tooltip
                      contentStyle={{ background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }}
                      labelStyle={{ color: "var(--muted)" }}
                      itemStyle={{ color: "var(--brand-light)" }}
                    />
                    <Line type="monotone" dataKey="clicks" stroke="#6366f1" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Device + Referrer */}
            <div className="grid grid-cols-2 gap-4">
              {/* Device breakdown */}
              {data.byDevice.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-[var(--muted)] mb-3">By device</p>
                  <ResponsiveContainer width="100%" height={140}>
                    <PieChart>
                      <Pie
                        data={data.byDevice}
                        dataKey="cnt"
                        nameKey="device_type"
                        cx="50%" cy="50%"
                        innerRadius={40} outerRadius={60}
                        paddingAngle={3}
                      >
                        {data.byDevice.map((_, i) => (
                          <Cell key={i} fill={COLORS[i % COLORS.length]} />
                        ))}
                      </Pie>
                      <Legend
                        formatter={(v) => <span style={{ fontSize: 11, color: "var(--muted)" }}>{v}</span>}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              )}

              {/* Top referrers */}
              {data.byReferrer.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-[var(--muted)] mb-3">Top referrers</p>
                  <div className="space-y-2">
                    {data.byReferrer.slice(0, 5).map((row) => {
                      const max = data.byReferrer[0].cnt;
                      return (
                        <div key={row.referrer} className="space-y-0.5">
                          <div className="flex justify-between text-xs">
                            <span className="text-[var(--text)] truncate max-w-[120px]" title={row.referrer}>
                              {row.referrer === "Direct" ? "Direct" : new URL("https://" + row.referrer.replace(/^https?:\/\//, "")).hostname.replace("www.", "")}
                            </span>
                            <span className="text-[var(--muted)]">{row.cnt}</span>
                          </div>
                          <div className="h-1.5 rounded-full bg-[var(--surface-2)]">
                            <div
                              className="h-1.5 rounded-full bg-[var(--brand)]"
                              style={{ width: `${(row.cnt / max) * 100}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Country breakdown */}
            {data.byCountry.length > 0 && (
              <div>
                <p className="text-xs font-medium text-[var(--muted)] mb-3">Top countries</p>
                <div className="flex flex-wrap gap-2">
                  {data.byCountry.map((row) => (
                    <span
                      key={row.country}
                      className="text-xs bg-[var(--surface-2)] border border-[var(--border)] rounded-full px-2.5 py-1"
                    >
                      {row.country} · <span className="text-[var(--brand-light)]">{row.cnt}</span>
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
