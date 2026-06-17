# FLCut — Finite Loop Club's Event Link Manager

**Live:** _deploy URL goes here_ · **Repo:** _this one_

---

## The core reframe

FLCut isn't a URL shortener. It's an **event operations tool that happens to shorten URLs**.

FLC posts links to WhatsApp groups, Instagram stories, printed posters, and Discord. The problem isn't that the links are long — it's that after you post them, you have no idea which channel actually drove signups. FLCut fixes that. Every redirect is a data point. Every channel gets a clear signal.

The dashboard isn't an afterthought. It's the whole point.

---

## What I built first (and why)

The redirect route (`/[slug]/route.ts`) is the actual product. Everything else is admin UI around it. Getting that right — fast redirect, correct scheduling logic, honest analytics capture — was the first priority. The dashboard came after.

---

## Stack

| Layer | Choice | Why |
|-------|--------|-----|
| Framework | Next.js 15 (App Router) | Edge-runtime redirect handler = lowest possible latency |
| Language | TypeScript | Type safety across schema → ORM → API → UI |
| Database | PostgreSQL (Neon serverless) | Neon's HTTP driver works from Edge without a connection pool |
| ORM | Drizzle | Lightweight, schema-first, great TS inference. Prisma felt heavy. |
| Hosting | Vercel | Zero-config Next.js deploy, edge network, free tier generous enough |
| Slug IDs | nanoid | Cryptographically random, URL-safe, no sequential leakage |

---

## Features

### Core
- ✅ Paste URL → get short link
- ✅ Redirect to original destination
- ✅ Dashboard listing your links (no account — tied to a browser cookie)

### Hard problems, solved

**Custom aliases** — pick `/hackfest26`. Collision check on insert. DB has a `UNIQUE` constraint on `slug` as a second line of defence: even under a race condition, the second write fails at the database level, not just in application code. Returns `409` with a human-readable message.

**Reserved slug list** — `admin`, `api`, `dashboard`, `login`, etc. are blocked. Lives in `src/lib/slugs.ts`, easy to extend.

**Slug generation** — `nanoid` with a custom alphabet that removes visually confusable characters (`0/O`, `1/l/I`). 7 chars = ~6 billion combinations. Retry loop (up to 5 attempts) handles the astronomically unlikely collision. Sequential IDs leak link count. Hashes need a source value. Random nanoid is simple and good enough.

**Content filtering** — custom aliases are validated against a regex slur filter before hitting the DB. Catches egregious cases to prevent offensive URLs being created and shared in FLC's name. Not a comprehensive profanity filter (that would need an external service) — intentionally conservative: we'd rather miss an edge case than block a legitimate slug.

**Scheduled links** — `go_live_at`: before this timestamp the link shows a "not open yet" page. Status is evaluated at redirect time, not stored as a flag — the link automatically becomes active when its scheduled time passes, with no cron job or background worker required.

**Expiring links** — `expires_at`: after this the link shows a sensible expired page, not a broken redirect. Same query-time evaluation pattern.

**Click cap + fallback** — set a max number of real (non-bot) clicks. After the cap, redirect to a configurable waitlist URL. Cap is evaluated at redirect time by counting actual rows — no denormalised counter to keep in sync.

**Analytics** — total clicks, unique visitors, 14-day time-series chart, breakdowns by referrer channel, device type, and country. Bot clicks are recorded but excluded from all counts.

**Bot filtering** — user-agent regex match against known crawlers and social preview scrapers (WhatsApp, Telegram, Twitter link previewer). Bots get `is_bot: true` and are excluded from analytics queries. They still get redirected — blocking them would break link previews on social platforms.

**Referrer normalization** — raw referrer headers are messy. `instagram.com/*` → `instagram`, `t.co/*` → `twitter`, `web.whatsapp.com` → `whatsapp`, missing referrer → `direct`. This is what FLC actually wants to see: "Instagram drove 80 clicks, WhatsApp drove 40." The normalization happens at capture time in `parseRequest`, not at query time, so the dashboard doesn't have to do string manipulation.

---

## Analytics — the design decisions

**What counts as "unique":** a fingerprint-unique visitor, where the fingerprint is SHA-256 of `flcut-{date}:{ip}`. Stored as a hex string, not the raw IP. The daily salt means the same person on two different days counts twice — close to how most analytics tools model sessions. Resets at UTC midnight automatically, with no cron job.

**What "unique" gives up:** VPNs change the hash. Multiple people on the same campus wifi share a hash. That tradeoff is documented here, not hidden. It's lightweight, requires no cookies, and honest about what it's measuring.

**Why not cookies for uniqueness:** cookies require consent banners in some jurisdictions and are easily cleared. IP hashing is cookieless and good enough for "did Instagram bring more people than WhatsApp?"

**Country:** read from `CF-IPCountry` (Cloudflare) or `x-vercel-ip-country` (Vercel Edge). No IP geolocation database needed.

**Analytics survive expiry:** clicks are kept forever. Cascade-delete only happens when you explicitly delete the link. Seeing the spike right before a link expired is exactly the kind of post-mortem data you'd want.

---

## Data model

```
links
  id              uuid PK
  slug            text UNIQUE          ← the short code
  original_url    text
  title           text?                ← human label shown on dashboard
  creator_token   text                 ← random token stored in cookie, no accounts
  go_live_at      timestamptz?
  expires_at      timestamptz?
  click_cap       int?
  cap_fallback_url text?               ← where to redirect after cap
  is_active       bool
  created_at      timestamptz

clicks
  id              uuid PK
  link_id         → links.id (CASCADE DELETE)
  clicked_at      timestamptz
  ip_hash         text                 ← SHA-256(flcut-{date}:ip), NOT raw IP
  user_agent      text?
  referrer        text?                ← NORMALIZED: "instagram", "whatsapp", "direct", …
  device_type     text?                ← mobile / tablet / desktop / bot
  country         text?                ← ISO alpha-2
  is_bot          bool
```

**Why two tables and not a counter on the link row:** a counter is fast to read but tells you nothing beyond the total. Separate rows let you answer "did Instagram or WhatsApp drive more signups on Saturday?" and "how many of those were mobile?" — which is the actual question FLC has. The tradeoff is storage and query cost at scale, but for a club running events (hundreds to low thousands of clicks), this is not a real problem.

**Why no accounts:** accounts add signup friction, password resets, email verification. FLC's use case is internal — the organiser creating a link is on their own device and manages it from the same browser. A random token in a long-lived `httpOnly` cookie does the job. If a link needs managing from a different device, a "claim link by token" flow would be the next thing to add — not built here.

---

## What I deliberately skipped

**No auth.** For a club tool used by 5–10 organizers, auth adds friction and complexity without meaningful security gain. If this were public-facing I'd add it. Assumption documented, not hidden.

**No cron jobs.** Expiry and scheduling are evaluated at query time. Simpler to deploy: no worker process to manage, no scheduler to keep running, no drift between the cron tick and the actual user request.

**No waitlist redirect per link.** Currently redirects to `/?error=capped` when a cap is hit without a fallback URL. In production you'd want a configurable fallback URL per link — that's the obvious next feature.

---

## If I only had 4 hours

1. Working redirect (slug → URL) — 30 min  
2. Create-link API + validation — 30 min  
3. Dashboard (list + copy) — 45 min  
4. Scheduling + expiry (10-line `if` block, but it has to be correct) — 20 min  
5. Click recording — 30 min  
6. Deploy to Vercel + Neon — 30 min  

That's just under 4 hours. I'd cut: analytics UI, bot filtering, click cap, custom aliases, content filter. Those are the polish. The redirect + dashboard + scheduling is the minimum that actually solves FLC's problem.

---

## Assumptions (where the PRD was silent)

1. **No accounts.** PRD left this open. Cookie-based creator token is good enough for internal club use.
2. **Analytics survive expiry.** Kept forever on the link; cascade-delete only on explicit link deletion.
3. **"Unique" means distinct IP-hash per link, daily salt.** Same person on day 2 counts twice — similar to GA session model.
4. **Slugs are case-insensitive, lowercased on creation.** `/Hackfest26` and `/hackfest26` are the same slug. Avoids case-mismatch confusion.
5. **Bot filter is UA-string based.** Catches ~95% of noise at zero cost. A real solution would use a headless challenge. Good enough here.
6. **Referrer normalization is curated, not exhaustive.** Covers FLC's real channels (WhatsApp, Instagram, Discord, Telegram, Twitter). Unknown hosts fall back to the bare hostname, still readable.

---

## Running locally

```bash
# 1. Clone and install
git clone <repo>
cd FLCut
npm install

# 2. Set up env
cp .env.example .env.local
# Fill in DATABASE_URL (Neon free tier works great)
# Set NEXT_PUBLIC_BASE_URL=http://localhost:3000

# 3. Push schema to DB
npm run db:push

# 4. Run dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

> **Note:** If `DATABASE_URL` is left as the placeholder value, the app automatically falls back to an in-memory store. All features work — data is lost on server restart. Useful for local demos without a DB.

## Deploying (Vercel + Neon)

1. Create a free Neon project → copy the connection string
2. `vercel deploy` or connect the repo on vercel.com
3. Add `DATABASE_URL` and `NEXT_PUBLIC_BASE_URL` as environment variables
4. Run `npm run db:push` once against the production `DATABASE_URL`

---

## Project structure

```
src/
  app/
    page.tsx              ← landing + shorten form
    layout.tsx
    globals.css
    dashboard/page.tsx    ← link management
    expired/              ← expired / scheduled / capped states
    not-found.tsx
    [slug]/route.ts       ← THE redirect handler (Edge runtime)
    api/links/
      route.ts            ← GET list, POST create
      [id]/route.ts       ← GET analytics, PATCH update, DELETE
  components/
    ShortenForm.tsx
    LinkCard.tsx
    AnalyticsModal.tsx
  db/
    schema.ts             ← Drizzle schema (links + clicks)
    index.ts              ← DB singleton with Neon HTTP driver
  lib/
    slugs.ts              ← generation, validation, reserved words, slur filter
    analytics.ts          ← UA parsing, bot detection, IP hashing, referrer normalization
    links.ts              ← data access layer (DB queries + memory fallback)
    memoryStore.ts        ← in-memory fallback for development without a DB
```
