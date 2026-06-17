import { NextRequest, NextResponse } from "next/server";
import { notFound } from "next/navigation";
import { db, clicks, links } from "@/db";
import { eq } from "drizzle-orm";
import { resolveLink } from "@/lib/links";
import { parseRequest, hashIp, getIp } from "@/lib/analytics";

import { memoryStore } from "@/lib/memoryStore";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000";

  console.log(`[slug redirect] Routing hit for slug: "${slug}"`);
  const result = await resolveLink(slug);
  console.log(`[slug redirect] Resolution result for "${slug}":`, JSON.stringify(result));

  // Record click for all outcomes except "not_found"
  if (result.status !== "not_found") {
    const parsed = parseRequest(req);
    const ip = getIp(req);
    const ipHash = await hashIp(ip);

    const isDbPlaceholder =
      !process.env.DATABASE_URL ||
      process.env.DATABASE_URL.includes("user:password") ||
      process.env.DATABASE_URL.includes("dbname");

    if (isDbPlaceholder) {
      const link = memoryStore.getLinkBySlug(slug);
      if (link) {
        memoryStore.recordClick({
          linkId: link.id,
          ipHash,
          userAgent: parsed.userAgent,
          referrer: parsed.referrer,
          deviceType: parsed.deviceType,
          country: parsed.country,
          isBot: parsed.isBot,
        });
      }
    } else {
      // Fetch link id with a plain select — no relational API needed
      db.select({ id: links.id })
        .from(links)
        .where(eq(links.slug, slug))
        .limit(1)
        .then(([row]) => {
          if (!row?.id) return;
          return db.insert(clicks).values({
            linkId: row.id,
            ipHash,
            userAgent: parsed.userAgent,
            referrer: parsed.referrer,
            deviceType: parsed.deviceType,
            country: parsed.country,
            isBot: parsed.isBot,
          });
        })
        .catch((e) => {
          console.warn("[click insert] DB error, using memory fallback:", e);
          const link = memoryStore.getLinkBySlug(slug);
          if (link) {
            memoryStore.recordClick({
              linkId: link.id,
              ipHash,
              userAgent: parsed.userAgent,
              referrer: parsed.referrer,
              deviceType: parsed.deviceType,
              country: parsed.country,
              isBot: parsed.isBot,
            });
          }
        });
    }
  }

  switch (result.status) {
    case "ok":
      return NextResponse.redirect(result.url, { status: 302 });
    case "capped":
      if (result.fallbackUrl) {
        return NextResponse.redirect(result.fallbackUrl, { status: 302 });
      }
      return NextResponse.redirect(`${baseUrl}/expired?reason=capped&slug=${slug}`);
    case "not_live_yet":
      return NextResponse.redirect(`${baseUrl}/expired?reason=not_live_yet&slug=${slug}`);
    case "expired":
    case "inactive":
      return NextResponse.redirect(`${baseUrl}/expired?reason=expired&slug=${slug}`);
    case "not_found":
    default:
      notFound();
  }
}
