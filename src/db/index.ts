import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";

// Reuse the connection across hot-reloads in dev
// In production this is just a new connection each time (serverless-friendly)
const sql = neon(process.env.DATABASE_URL || "postgresql://placeholder:placeholder@localhost/placeholder");
export const db = drizzle(sql, { schema });

export * from "./schema";
