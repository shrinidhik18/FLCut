import { customAlphabet } from "nanoid";

// No confusable chars (0/O, 1/l/I). 7 chars = ~35^7 ≈ 6 billion combos.
// Collision probability stays negligible until millions of links.
const nanoid = customAlphabet("23456789abcdefghjkmnpqrstuvwxyz", 7);

/**
 * Words we won't let people use as slugs — they'd shadow real routes
 * or cause moderation headaches.
 */
export const RESERVED_SLUGS = new Set([
  "api",
  "admin",
  "dashboard",
  "login",
  "logout",
  "register",
  "new",
  "create",
  "health",
  "status",
  "robots",
  "sitemap",
  "favicon",
  "_next",
  "static",
  "public",
  "404",
  "500",
  "expired",
  "not-found",
]);

/** Slug validation — alphanumeric + hyphens, 2–50 chars */
const SLUG_RE = /^[a-z0-9][a-z0-9-]{0,48}[a-z0-9]$|^[a-z0-9]{1,2}$/;

/**
 * Very lightweight content filter for custom slug aliases.
 *
 * This is NOT a comprehensive profanity filter — that would require a
 * maintained word list or an external service. This catches the most
 * egregious cases to prevent obviously offensive short URLs from being
 * created and shared in FLC's name on public channels.
 *
 * The regex uses word-boundary-style checks so that "scunthorpe" isn't
 * accidentally blocked. Intentionally conservative: we'd rather miss an
 * edge case than block a legitimate slug.
 */
const SLUR_RE =
  /\b(f+u+c+k|s+h+i+t|b+i+t+c+h|n+[i1]+g+[ge]|c+u+n+t|w+h+o+r+e|k+[i1]+k+e|f+[a@]+g+[gs]?|d+[i1]+c+k|p+u+s+s+[yi]|a+s+s+h+o+l+e|b+[a@]+s+t+[ae]+r+d|c+[o0]+c+k|p+[o0]+r+n|s+e+x+y?|n+[a@]+z+[i1]|h+[i1]+t+l+[e3]+r)\b/i;

export function generateSlug(): string {
  return nanoid();
}

export function isValidSlug(slug: string): boolean {
  const lower = slug.toLowerCase();
  if (RESERVED_SLUGS.has(lower)) return false;
  if (!SLUG_RE.test(lower)) return false;

  // 1. Highly offensive substrings (no clean English words contain these, or exceptions are handled)
  const SUBSTRING_SLURS = [
    "fuck",
    "nigger",
    "nigga",
    "cunt",
    "whore",
    "pussy",
    "asshole",
    "bastard",
    "hitler",
    "nazi",
    "porn",
    "shit",
    "bitch"
  ];

  for (const slur of SUBSTRING_SLURS) {
    if (lower.includes(slur)) {
      if (slur === "cunt") {
        // Exclude classic false positives for "cunt"
        if (lower.includes("scunthorpe") || lower.includes("cunctat")) {
          continue;
        }
      }
      return false;
    }
  }

  // 2. Slurs that are only offensive as full words (separated by hyphens or exact match)
  // This avoids false positives on words like "class", "assume", "unisex", "button", "cocktail".
  const parts = lower.split("-");
  const EXACT_SLURS = new Set([
    "ass",
    "cock",
    "sex",
    "sexy",
    "dick",
    "fag",
    "fags"
  ]);

  for (const part of parts) {
    if (EXACT_SLURS.has(part)) {
      return false;
    }
  }

  return true;
}

export function normalizeSlug(raw: string): string {
  return raw.toLowerCase().trim();
}
