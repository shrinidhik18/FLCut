import { NextRequest, NextResponse } from "next/server";
import { db, links } from "@/db";
import { eq } from "drizzle-orm";
import {
  getLinkById,
  getTotalClicks,
  getUniqueClicks,
  getClicksByDay,
  getClicksByReferrer,
  getClicksByDevice,
  getClicksByCountry,
} from "@/lib/links";

import { memoryStore } from "@/lib/memoryStore";

// GET /api/links/[id] — full link detail + analytics
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const link = await getLinkById(id);
  if (!link) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const token = req.cookies.get("flcut_token")?.value;
  if (link.creatorToken !== token) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const [total, unique, byDay, byReferrer, byDevice, byCountry] =
    await Promise.all([
      getTotalClicks(id),
      getUniqueClicks(id),
      getClicksByDay(id, 14),
      getClicksByReferrer(id),
      getClicksByDevice(id),
      getClicksByCountry(id),
    ]);

  return NextResponse.json({
    link,
    analytics: { total, unique, byDay, byReferrer, byDevice, byCountry },
  });
}

// PATCH /api/links/[id] — toggle active, update expiry, etc.
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const link = await getLinkById(id);
  if (!link) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const token = req.cookies.get("flcut_token")?.value;
  if (link.creatorToken !== token) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const allowed = ["isActive", "title", "expiresAt", "goLiveAt", "clickCap", "capFallbackUrl"];
  const updates: Record<string, unknown> = {};
  for (const key of allowed) {
    if (key in body) {
      if ((key === "expiresAt" || key === "goLiveAt") && body[key]) {
        updates[key] = new Date(body[key]);
      } else {
        updates[key] = body[key];
      }
    }
  }

  const isDbPlaceholder =
    !process.env.DATABASE_URL ||
    process.env.DATABASE_URL.includes("user:password") ||
    process.env.DATABASE_URL.includes("dbname");

  let updated;
  if (isDbPlaceholder) {
    updated = memoryStore.updateLink(id, updates);
  } else {
    try {
      const [res] = await db
        .update(links)
        .set(updates)
        .where(eq(links.id, id))
        .returning();
      updated = res;
    } catch (err) {
      console.warn("[PATCH /api/links/[id]] DB update failed, using memory fallback:", err);
      updated = memoryStore.updateLink(id, updates);
    }
  }

  return NextResponse.json({ link: updated });
}

// DELETE /api/links/[id] — remove a link and cascade-delete its clicks
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const link = await getLinkById(id);
  if (!link) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const token = req.cookies.get("flcut_token")?.value;
  if (link.creatorToken !== token) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const isDbPlaceholder =
    !process.env.DATABASE_URL ||
    process.env.DATABASE_URL.includes("user:password") ||
    process.env.DATABASE_URL.includes("dbname");

  if (isDbPlaceholder) {
    memoryStore.deleteLink(id);
  } else {
    try {
      await db.delete(links).where(eq(links.id, id));
    } catch (err) {
      console.warn("[DELETE /api/links/[id]] DB delete failed, using memory fallback:", err);
      memoryStore.deleteLink(id);
    }
  }
  return NextResponse.json({ success: true });
}
