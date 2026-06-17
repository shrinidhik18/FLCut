import { NextRequest, NextResponse } from "next/server";
import { db, links, clicks } from "@/db";
import { eq } from "drizzle-orm";
import { generateSlug, isValidSlug, normalizeSlug, RESERVED_SLUGS } from "@/lib/slugs";
import { slugExists, getLinksByToken } from "@/lib/links";
import { nanoid } from "nanoid";

import { memoryStore } from "@/lib/memoryStore";

// GET /api/links — list all links for this session's creator token
export async function GET(req: NextRequest) {
  const token = req.cookies.get("flcut_token")?.value;
  if (!token) return NextResponse.json({ links: [] });

  const userLinks = await getLinksByToken(token);
  return NextResponse.json({ links: userLinks });
}

// POST /api/links — create a new short link
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      originalUrl,
      customSlug,
      title,
      goLiveAt,
      expiresAt,
      clickCap,
      capFallbackUrl,
    } = body;

    // ── Validation ────────────────────────────────────────────────────────────
    if (!originalUrl || typeof originalUrl !== "string") {
      return NextResponse.json({ error: "originalUrl is required" }, { status: 400 });
    }

    let parsedUrl: URL;
    try {
      parsedUrl = new URL(originalUrl);
    } catch {
      return NextResponse.json({ error: "That doesn't look like a valid URL" }, { status: 400 });
    }

    if (!["http:", "https:"].includes(parsedUrl.protocol)) {
      return NextResponse.json({ error: "Only http/https URLs are allowed" }, { status: 400 });
    }

    // ── Self-Redirection Loop Protection ─────────────────────────────────────
    // Prevent the short URL from pointing back to our own domain, which would
    // trigger an infinite redirect loop (ERR_TOO_MANY_REDIRECTS).
    const requestHost = req.headers.get("host") || "";
    const cleanRequestHost = requestHost.replace(/^www\./, "").toLowerCase();
    const cleanDestinationHost = parsedUrl.host.replace(/^www\./, "").toLowerCase();

    if (cleanRequestHost === cleanDestinationHost) {
      return NextResponse.json(
        { error: "You cannot shorten a link that points back to this shortener itself" },
        { status: 400 }
      );
    }

    // ── Slug resolution ───────────────────────────────────────────────────────
    let slug: string;

    if (customSlug) {
      slug = normalizeSlug(customSlug);

      if (RESERVED_SLUGS.has(slug)) {
        return NextResponse.json(
          { error: `"${slug}" is reserved and can't be used` },
          { status: 409 }
        );
      }

      if (!isValidSlug(slug)) {
        return NextResponse.json(
          { error: "Slug must be 2–50 chars, lowercase letters/numbers/hyphens" },
          { status: 400 }
        );
      }

      if (await slugExists(slug)) {
        return NextResponse.json(
          { error: `"${slug}" is already taken — try a different alias` },
          { status: 409 }
        );
      }
    } else {
      // Auto-generate. Retry up to 5 times to dodge extremely unlikely collisions.
      let attempts = 0;
      do {
        slug = generateSlug();
        attempts++;
        if (attempts > 5) {
          return NextResponse.json({ error: "Could not generate a unique slug" }, { status: 500 });
        }
      } while (await slugExists(slug));
    }

    // ── Creator token ─────────────────────────────────────────────────────────
    // We don't have accounts. A random token is stored in a cookie and ties
    // the user to their links. Simple, private, no signup friction.
    let creatorToken = req.cookies.get("flcut_token")?.value;
    if (!creatorToken) {
      creatorToken = nanoid(32);
    }

    // ── Insert with fallback ──────────────────────────────────────────────────
    const isDbPlaceholder =
      !process.env.DATABASE_URL ||
      process.env.DATABASE_URL.includes("user:password") ||
      process.env.DATABASE_URL.includes("dbname");

    let link;
    const linkValues = {
      slug,
      originalUrl,
      title: title?.trim() || null,
      creatorToken,
      goLiveAt: goLiveAt ? new Date(goLiveAt) : null,
      expiresAt: expiresAt ? new Date(expiresAt) : null,
      clickCap: clickCap ? parseInt(clickCap, 10) : null,
      capFallbackUrl: capFallbackUrl?.trim() || null,
      isActive: true,
    };

    if (isDbPlaceholder) {
      link = memoryStore.createLink(linkValues);
    } else {
      try {
        const [inserted] = await db
          .insert(links)
          .values(linkValues)
          .returning();
        link = inserted;
      } catch (err) {
        console.warn("[POST /api/links] DB insert failed, using memory fallback:", err);
        link = memoryStore.createLink(linkValues);
      }
    }

    const response = NextResponse.json({ link }, { status: 201 });

    // Set the creator token in a long-lived cookie if it's new
    if (!req.cookies.get("flcut_token")) {
      response.cookies.set("flcut_token", creatorToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 60 * 60 * 24 * 365, // 1 year
        path: "/",
      });
    }

    return response;
  } catch (err) {
    console.error("[POST /api/links]", err);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
