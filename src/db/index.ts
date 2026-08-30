import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import postgres from "postgres";
import { drizzle as drizzlePg } from "drizzle-orm/postgres-js";
import * as schema from "./schema.js";
import { env } from "../config/env.js";

function createDatabase() {
  const dbUrl = (env.DATABASE_URL || "").replace(/&?channel_binding=[^&]+/g, "");
  
  if (dbUrl.includes("neon") || process.env.VERCEL || dbUrl.startsWith("postgres")) {
    const rawSql = neon(dbUrl);
    const sqlProxy: any = (query: any, params: any, opts: any) => {
      if (typeof query === "string") {
        return rawSql.query(query, params, opts);
      }
      return (rawSql as any)(query, params, opts);
    };
    Object.assign(sqlProxy, rawSql);
    sqlProxy.query = rawSql.query.bind(rawSql);
    return drizzle(sqlProxy, { schema });
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

