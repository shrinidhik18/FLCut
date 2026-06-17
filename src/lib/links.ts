import { db, links, clicks } from "@/db";
import { eq, sql, and, desc, count } from "drizzle-orm";
import { memoryStore } from "./memoryStore";
import { Link } from "@/db/schema";

// ── Link resolution ───────────────────────────────────────────────────────────

export type ResolveResult =
  | { status: "ok"; url: string }
  | { status: "not_found" }
  | { status: "not_live_yet" }
  | { status: "expired" }
  | { status: "capped"; fallbackUrl: string | null }
  | { status: "inactive" };

const isDbPlaceholder =
  !process.env.DATABASE_URL ||
  process.env.DATABASE_URL.includes("user:password") ||
  process.env.DATABASE_URL.includes("dbname");

// Helper to run query with dynamic memory fallback
async function executeQuery<T>(
  dbTask: () => Promise<T>,
  fallbackTask: () => Promise<T> | T
): Promise<T> {
  if (isDbPlaceholder) {
    return fallbackTask();
  }
  try {
    return await dbTask();
  } catch (err) {
    console.warn("[FLCut DB Fallback] Database error, using in-memory store instead:", err);
    return fallbackTask();
  }
}

/**
 * Given a slug, figure out where to send the visitor.
 * All scheduling and cap logic lives here — the redirect route stays thin.
 */
export async function resolveLink(slug: string): Promise<ResolveResult> {
  return executeQuery(
    async () => {
      const [link] = await db
        .select()
        .from(links)
        .where(eq(links.slug, slug))
        .limit(1);

      if (!link) return { status: "not_found" };
      if (!link.isActive) return { status: "inactive" };

      const now = new Date();

      if (link.goLiveAt && now < link.goLiveAt) return { status: "not_live_yet" };
      if (link.expiresAt && now >= link.expiresAt) return { status: "expired" };

      // Click cap check
      if (link.clickCap !== null && link.clickCap !== undefined) {
        const [{ total }] = await db
          .select({ total: count() })
          .from(clicks)
          .where(and(eq(clicks.linkId, link.id), eq(clicks.isBot, false)));

        if (total >= link.clickCap) {
          return { status: "capped", fallbackUrl: link.capFallbackUrl ?? null };
        }
      }

      return { status: "ok", url: link.originalUrl };
    },
    () => {
      const link = memoryStore.getLinkBySlug(slug);
      if (!link) return { status: "not_found" };
      if (!link.isActive) return { status: "inactive" };

      const now = new Date();
      if (link.goLiveAt && now < link.goLiveAt) return { status: "not_live_yet" };
      if (link.expiresAt && now >= link.expiresAt) return { status: "expired" };

      if (link.clickCap !== null && link.clickCap !== undefined) {
        const total = memoryStore.getClicksForLink(link.id).filter((c) => !c.isBot).length;
        if (total >= link.clickCap) {
          return { status: "capped", fallbackUrl: link.capFallbackUrl ?? null };
        }
      }

      return { status: "ok", url: link.originalUrl };
    }
  );
}

// ── Analytics queries ─────────────────────────────────────────────────────────

export async function getTotalClicks(linkId: string): Promise<number> {
  return executeQuery(
    async () => {
      const [row] = await db
        .select({ total: count() })
        .from(clicks)
        .where(and(eq(clicks.linkId, linkId), eq(clicks.isBot, false)));
      return row.total;
    },
    () => memoryStore.getClicksForLink(linkId).filter((c) => !c.isBot).length
  );
}

export async function getUniqueClicks(linkId: string): Promise<number> {
  return executeQuery(
    async () => {
      const result = await db.execute(
        sql`SELECT COUNT(DISTINCT ip_hash) as unique_count
            FROM clicks
            WHERE link_id = ${linkId} AND is_bot = false`
      );
      const row = result.rows[0] as Record<string, unknown> | undefined;
      return Number(row?.unique_count ?? 0);
    },
    () => {
      const uniqueHashes = new Set(
        memoryStore.getClicksForLink(linkId).filter((c) => !c.isBot).map((c) => c.ipHash)
      );
      return uniqueHashes.size;
    }
  );
}

export async function getClicksByDay(linkId: string, days = 14) {
  return executeQuery(
    async () => {
      const since = new Date();
      since.setDate(since.getDate() - days);

      const result = await db.execute(
        sql`SELECT DATE_TRUNC('day', clicked_at AT TIME ZONE 'UTC') as day,
                   COUNT(*) FILTER (WHERE is_bot = false) as clicks
            FROM clicks
            WHERE link_id = ${linkId}
              AND clicked_at >= ${since.toISOString()}
            GROUP BY 1
            ORDER BY 1 ASC`
      );
      return result.rows as unknown as { day: string; clicks: number }[];
    },
    () => {
      const since = new Date();
      since.setDate(since.getDate() - days);
      const clicksList = memoryStore.getClicksForLink(linkId).filter(
        (c) => !c.isBot && c.clickedAt >= since
      );
      // Group by day key
      const counts: Record<string, number> = {};
      clicksList.forEach((c) => {
        const dayStr = c.clickedAt.toISOString().split("T")[0] + "T00:00:00.000Z";
        counts[dayStr] = (counts[dayStr] ?? 0) + 1;
      });
      return Object.entries(counts)
        .map(([day, clicks]) => ({ day, clicks }))
        .sort((a, b) => a.day.localeCompare(b.day));
    }
  );
}

export async function getClicksByReferrer(linkId: string) {
  return executeQuery(
    async () => {
      const result = await db.execute(
        sql`SELECT COALESCE(referrer, 'Direct') as referrer, COUNT(*) as cnt
            FROM clicks
            WHERE link_id = ${linkId} AND is_bot = false
            GROUP BY 1
            ORDER BY cnt DESC
            LIMIT 10`
      );
      return result.rows as unknown as { referrer: string; cnt: number }[];
    },
    () => {
      const clicksList = memoryStore.getClicksForLink(linkId).filter((c) => !c.isBot);
      const counts: Record<string, number> = {};
      clicksList.forEach((c) => {
        const ref = c.referrer || "Direct";
        counts[ref] = (counts[ref] ?? 0) + 1;
      });
      return Object.entries(counts)
        .map(([referrer, cnt]) => ({ referrer, cnt }))
        .sort((a, b) => b.cnt - a.cnt)
        .slice(0, 10);
    }
  );
}

export async function getClicksByDevice(linkId: string) {
  return executeQuery(
    async () => {
      const result = await db.execute(
        sql`SELECT device_type, COUNT(*) as cnt
            FROM clicks
            WHERE link_id = ${linkId} AND is_bot = false
            GROUP BY 1
            ORDER BY cnt DESC`
      );
      return result.rows as unknown as { device_type: string; cnt: number }[];
    },
    () => {
      const clicksList = memoryStore.getClicksForLink(linkId).filter((c) => !c.isBot);
      const counts: Record<string, number> = {};
      clicksList.forEach((c) => {
        const dev = c.deviceType || "desktop";
        counts[dev] = (counts[dev] ?? 0) + 1;
      });
      return Object.entries(counts)
        .map(([device_type, cnt]) => ({ device_type, cnt }))
        .sort((a, b) => b.cnt - a.cnt);
    }
  );
}

export async function getClicksByCountry(linkId: string) {
  return executeQuery(
    async () => {
      const result = await db.execute(
        sql`SELECT COALESCE(country, 'Unknown') as country, COUNT(*) as cnt
            FROM clicks
            WHERE link_id = ${linkId} AND is_bot = false
            GROUP BY 1
            ORDER BY cnt DESC
            LIMIT 10`
      );
      return result.rows as unknown as { country: string; cnt: number }[];
    },
    () => {
      const clicksList = memoryStore.getClicksForLink(linkId).filter((c) => !c.isBot);
      const counts: Record<string, number> = {};
      clicksList.forEach((c) => {
        const country = c.country || "Unknown";
        counts[country] = (counts[country] ?? 0) + 1;
      });
      return Object.entries(counts)
        .map(([country, cnt]) => ({ country, cnt }))
        .sort((a, b) => b.cnt - a.cnt)
        .slice(0, 10);
    }
  );
}

// ── Link management ───────────────────────────────────────────────────────────

export async function getLinksByToken(creatorToken: string): Promise<Link[]> {
  return executeQuery(
    () =>
      db
        .select()
        .from(links)
        .where(eq(links.creatorToken, creatorToken))
        .orderBy(desc(links.createdAt)),
    () => memoryStore.getLinksByToken(creatorToken)
  );
}

export async function getLinkById(id: string): Promise<Link | null> {
  return executeQuery(
    async () => {
      const [link] = await db.select().from(links).where(eq(links.id, id)).limit(1);
      return link ?? null;
    },
    () => memoryStore.getLinkById(id)
  );
}

export async function slugExists(slug: string): Promise<boolean> {
  return executeQuery(
    async () => {
      const [row] = await db
        .select({ id: links.id })
        .from(links)
        .where(eq(links.slug, slug))
        .limit(1);
      return !!row;
    },
    () => !!memoryStore.getLinkBySlug(slug)
  );
}
