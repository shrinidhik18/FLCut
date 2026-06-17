import { Link, Click } from "@/db/schema";
import fs from "fs";
import path from "path";

const filePath = path.join(process.cwd(), ".next", "memory_db.json");

// Simple database fallback for when PostgreSQL connection is missing or fails.
// Persists to a local JSON file so that state is shared between Next.js processes/route handlers.
class MemoryStore {
  private linksMap = new Map<string, Link>();
  private clicksList: Click[] = [];

  constructor() {
    // Ensure the directory exists
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    if (fs.existsSync(filePath)) {
      this.loadFromFile();
    } else {
      // Add a default demo link
      const demoLink: Link = {
        id: "demo-link-id",
        slug: "demo",
        originalUrl: "https://finiteloop.club",
        title: "Finite Loop Club Homepage",
        creatorToken: "demo-token",
        goLiveAt: null,
        expiresAt: null,
        clickCap: null,
        capFallbackUrl: null,
        isActive: true,
        createdAt: new Date(),
      };
      this.linksMap.set(demoLink.id, demoLink);
      
      // Add some mock clicks for demo stats
      const now = new Date();
      for (let i = 0; i < 25; i++) {
        const clickDate = new Date();
        clickDate.setDate(now.getDate() - Math.floor(Math.random() * 10));
        this.clicksList.push({
          id: `click-id-${i}`,
          linkId: demoLink.id,
          clickedAt: clickDate,
          ipHash: `hash-${Math.floor(Math.random() * 5)}`,
          userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
          referrer: Math.random() > 0.4 ? "https://instagram.com" : "Direct",
          deviceType: Math.random() > 0.5 ? "mobile" : "desktop",
          country: Math.random() > 0.3 ? "IN" : "US",
          isBot: false,
        });
      }
      this.saveToFile();
    }
  }

  private saveToFile() {
    try {
      const data = {
        links: Array.from(this.linksMap.entries()),
        clicks: this.clicksList,
      };
      fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf8");
    } catch (err) {
      console.error("[MemoryStore] Failed to write memory_db.json:", err);
    }
  }

  private loadFromFile() {
    try {
      if (!fs.existsSync(filePath)) {
        return;
      }
      const raw = fs.readFileSync(filePath, "utf8");
      const data = JSON.parse(raw);
      
      const newLinksMap = new Map<string, Link>();
      if (Array.isArray(data.links)) {
        for (const [id, link] of data.links) {
          if (link.goLiveAt) link.goLiveAt = new Date(link.goLiveAt);
          if (link.expiresAt) link.expiresAt = new Date(link.expiresAt);
          if (link.createdAt) link.createdAt = new Date(link.createdAt);
          newLinksMap.set(id, link);
        }
      }
      this.linksMap = newLinksMap;

      if (Array.isArray(data.clicks)) {
        this.clicksList = data.clicks.map((c: any) => {
          if (c.clickedAt) c.clickedAt = new Date(c.clickedAt);
          return c;
        });
      }
    } catch (err) {
      console.error("[MemoryStore] Failed to read memory_db.json:", err);
    }
  }

  getLinks(): Link[] {
    this.loadFromFile();
    return Array.from(this.linksMap.values()).sort(
      (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
    );
  }

  getLinkBySlug(slug: string): Link | null {
    this.loadFromFile();
    const slugLower = slug.toLowerCase();
    return Array.from(this.linksMap.values()).find(
      (l) => l.slug.toLowerCase() === slugLower
    ) ?? null;
  }

  getLinkById(id: string): Link | null {
    this.loadFromFile();
    return this.linksMap.get(id) ?? null;
  }

  getLinksByToken(token: string): Link[] {
    this.loadFromFile();
    return Array.from(this.linksMap.values())
      .filter((l) => l.creatorToken === token)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  createLink(link: Omit<Link, "id" | "createdAt">): Link {
    this.loadFromFile();
    const newLink: Link = {
      ...link,
      id: `link-${Math.random().toString(36).substring(2, 9)}`,
      createdAt: new Date(),
    };
    this.linksMap.set(newLink.id, newLink);
    this.saveToFile();
    return newLink;
  }

  updateLink(id: string, updates: Partial<Link>): Link {
    this.loadFromFile();
    const existing = this.linksMap.get(id);
    if (!existing) throw new Error("Link not found");
    const updated = { ...existing, ...updates };
    this.linksMap.set(id, updated);
    this.saveToFile();
    return updated;
  }

  deleteLink(id: string) {
    this.loadFromFile();
    this.linksMap.delete(id);
    this.clicksList = this.clicksList.filter((c) => c.linkId !== id);
    this.saveToFile();
  }

  recordClick(click: Omit<Click, "id" | "clickedAt">): Click {
    this.loadFromFile();
    const newClick: Click = {
      ...click,
      id: `click-${Math.random().toString(36).substring(2, 9)}`,
      clickedAt: new Date(),
    };
    this.clicksList.push(newClick);
    this.saveToFile();
    return newClick;
  }

  getClicksForLink(linkId: string): Click[] {
    this.loadFromFile();
    return this.clicksList.filter((c) => c.linkId === linkId);
  }
}

export const memoryStore = new MemoryStore();
