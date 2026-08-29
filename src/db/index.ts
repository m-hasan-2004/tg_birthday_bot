import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema.js";
import { env } from "../config/env.js";

// For serverless/connection pooling in PostgreSQL:
// If running in production with transaction poolers (like Supabase/Neon/PgBouncer),
// prepare: false is recommended.
const client = postgres(env.DATABASE_URL, {
  max: env.NODE_ENV === "production" ? 10 : 5,
  idle_timeout: 20,
  connect_timeout: 10,
  prepare: false,
});

export const db = drizzle(client, { schema });
export type DB = typeof db;
