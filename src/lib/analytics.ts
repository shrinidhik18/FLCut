import { UAParser } from "ua-parser-js";

/**
 * Patterns we consider bots/crawlers.
 * Intentionally not exhaustive — just the high-volume ones.
 * A fully hardened bot filter would use a headless-challenge or ML classifier,
 * which is out of scope here.
 */
const BOT_UA_RE =
  /bot|crawl|spider|slurp|mediapartners|google|bing|yahoo|duckduck|baidu|yandex|facebot|ia_archiver|feedfetcher|python-requests|curl|wget|axios|go-http|java\/|apache-httpclient|scrapy|phantomjs|headless/i;

/**
 * Normalize raw referrer header values to the clean channel names
 * that FLC actually wants to see in the dashboard.
 *
 * FLC shares links via WhatsApp, Instagram, Discord, and printed posters.
 * Raw referrer strings are noisy — normalise them to a short canonical label.
 * "no referrer" → "direct" (poster / typed-in URL / private browsing).
 *
 * This is intentionally a small, curated list. Unknown domains are truncated
 * to just the hostname so they're still readable, not shown as a raw path.
 */
export function normalizeReferrer(raw: string | null): string {
  if (!raw) return "direct";

  let hostname: string;
  try {
    hostname = new URL(raw).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    // Not a valid URL — just return cleaned raw string
    return raw.slice(0, 50);
  }

  // ── Known channels ───────────────────────────────────────────────────────
  if (hostname === "instagram.com" || hostname.endsWith(".instagram.com")) return "instagram";
  if (hostname === "t.co" || hostname === "twitter.com" || hostname === "x.com") return "twitter";
  if (
    hostname === "web.whatsapp.com" ||
    hostname === "whatsapp.com" ||
    hostname.endsWith(".whatsapp.com")
  ) return "whatsapp";
  if (hostname === "discord.com" || hostname === "discord.gg" || hostname.endsWith(".discord.com")) return "discord";
  if (hostname === "linkedin.com" || hostname.endsWith(".linkedin.com")) return "linkedin";
  if (hostname === "facebook.com" || hostname === "fb.com" || hostname.endsWith(".facebook.com")) return "facebook";
  if (hostname === "telegram.org" || hostname === "t.me") return "telegram";
  if (hostname === "mail.google.com" || hostname === "gmail.com") return "gmail";
  if (hostname === "youtube.com" || hostname === "youtu.be" || hostname.endsWith(".youtube.com")) return "youtube";
  if (hostname === "linktr.ee" || hostname.endsWith(".linktr.ee")) return "linktree";

  // ── Self-referrals (QR, embedded iframes, etc.) ──────────────────────────
  const selfHost = process.env.NEXT_PUBLIC_BASE_URL
    ? new URL(process.env.NEXT_PUBLIC_BASE_URL).hostname
    : "localhost";
  if (hostname === selfHost) return "internal";

  // ── Fallback: return the bare hostname, capped at 40 chars ───────────────
  return hostname.slice(0, 40);
}

export type DeviceType = "mobile" | "tablet" | "desktop" | "bot";

export interface ParsedRequest {
  deviceType: DeviceType;
  isBot: boolean;
  userAgent: string | null;
  referrer: string | null;
  country: string | null;
}

export function parseRequest(request: Request): ParsedRequest {
  const ua = request.headers.get("user-agent") ?? null;
  const rawReferrer =
    request.headers.get("referer") ?? request.headers.get("referrer") ?? null;
  // Cloudflare sets this; Vercel Edge sets x-vercel-ip-country
  const country =
    request.headers.get("cf-ipcountry") ??
    request.headers.get("x-vercel-ip-country") ??
    null;

  const isBot = ua ? BOT_UA_RE.test(ua) : false;

  // Normalize referrer to a clean channel name ("instagram", "whatsapp", "direct", …)
  // This is what FLC actually wants to see on the dashboard — not raw URLs.
  const referrer = normalizeReferrer(rawReferrer);

  let deviceType: DeviceType = "desktop";
  if (isBot) {
    deviceType = "bot";
  } else if (ua) {
    const parser = new UAParser(ua);
    const device = parser.getDevice().type;
    if (device === "mobile") deviceType = "mobile";
    else if (device === "tablet") deviceType = "tablet";
    else deviceType = "desktop";
  }

  return { deviceType, isBot, userAgent: ua, referrer, country };
}

/**
 * Hash the IP with a daily salt so we can count unique-per-day without
 * storing raw IPs. Not reversible. Resets every UTC midnight automatically.
 */
export async function hashIp(ip: string): Promise<string> {
  const today = new Date().toISOString().slice(0, 10); // "2025-06-14"
  const salt = `flcut-${today}`;
  const data = new TextEncoder().encode(`${salt}:${ip}`);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function getIp(request: Request): string {
  return (
    request.headers.get("cf-connecting-ip") ??
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    "unknown"
  );
}
