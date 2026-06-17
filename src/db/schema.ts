import {
  pgTable,
  text,
  timestamp,
  integer,
  boolean,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

// ─── links ────────────────────────────────────────────────────────────────────
// One row per shortened URL. Slugs are the short codes people see.
export const links = pgTable(
  "links",
  {
    id: text("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),

    slug: text("slug").notNull(), // e.g. "hackfest26" or "xK7p2"

    originalUrl: text("original_url").notNull(),

    // Optional human label shown on dashboard
    title: text("title"),

    // Who created it — we don't do accounts, so we store a random token
    // that gets set in a cookie. Owner can manage their own links without login.
    creatorToken: text("creator_token").notNull(),

    // Scheduling: null = always active
    goLiveAt: timestamp("go_live_at", { withTimezone: true }),
    expiresAt: timestamp("expires_at", { withTimezone: true }),

    // Click cap: once total clicks hit this, redirect to capFallbackUrl instead
    clickCap: integer("click_cap"),
    capFallbackUrl: text("cap_fallback_url"),

    // Soft-delete / manual disable
    isActive: boolean("is_active").default(true).notNull(),

    createdAt: timestamp("created_at", { withTimezone: true })
      .default(sql`now()`)
      .notNull(),
  },
  (t) => [uniqueIndex("links_slug_idx").on(t.slug)]
);

// ─── clicks ───────────────────────────────────────────────────────────────────
// One row per visit. We never store raw IPs — only a salted SHA-256 hash.
// That gives us uniqueness without a privacy problem.
export const clicks = pgTable(
  "clicks",
  {
    id: text("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),

    linkId: text("link_id")
      .notNull()
      .references(() => links.id, { onDelete: "cascade" }),

    clickedAt: timestamp("clicked_at", { withTimezone: true })
      .default(sql`now()`)
      .notNull(),

    // Hashed IP (SHA-256 + daily salt). Used for unique-click counting.
    ipHash: text("ip_hash"),

    // Raw headers we got — useful for debugging
    userAgent: text("user_agent"),
    referrer: text("referrer"),

    // Parsed from user agent / IP
    deviceType: text("device_type"), // "mobile" | "desktop" | "tablet" | "bot"
    country: text("country"),        // ISO-3166 alpha-2 from CF-IPCountry header

    isBot: boolean("is_bot").default(false).notNull(),
  },
  (t) => [
    index("clicks_link_id_idx").on(t.linkId),
    index("clicks_clicked_at_idx").on(t.clickedAt),
  ]
);

// Types inferred from schema
export type Link = typeof links.$inferSelect;
export type NewLink = typeof links.$inferInsert;
export type Click = typeof clicks.$inferSelect;
export type NewClick = typeof clicks.$inferInsert;
