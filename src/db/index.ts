import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import postgres from "postgres";
import { drizzle as drizzlePg } from "drizzle-orm/postgres-js";
import * as schema from "./schema.js";
import { env } from "../config/env.js";

function createDatabase() {
  const dbUrl = (env.DATABASE_URL || "").replace(/&?channel_binding=[^&]+/g, "");
  
  if (dbUrl.includes("neon.tech")) {
    const sql = neon(dbUrl);
    return drizzle(sql, { schema });
  }

  const client = postgres(dbUrl || "postgresql://localhost:5432/dating_app", {
    max: env.NODE_ENV === "production" ? 10 : 5,
    idle_timeout: 20,
    connect_timeout: 10,
    prepare: false,
  });
  return drizzlePg(client, { schema });
}

export const db = createDatabase();
export type DB = any;

