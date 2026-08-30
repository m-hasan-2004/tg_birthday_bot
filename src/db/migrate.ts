import { migrate as migrateNeon } from "drizzle-orm/neon-http/migrator";
import { migrate as migratePg } from "drizzle-orm/postgres-js/migrator";
import { db } from "./index.js";
import { env } from "../config/env.js";
import { logger } from "../utils/logger.js";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function runMigrations() {
  logger.info("Running database migrations...");
  try {
    const migrationsFolder = path.resolve(__dirname, "./migrations");
    const dbUrl = (env.DATABASE_URL || "").replace(/&?channel_binding=[^&]+/g, "");
    if (dbUrl.includes("neon.tech")) {
      await migrateNeon(db as any, { migrationsFolder });
    } else {
      await migratePg(db as any, { migrationsFolder });
    }
    logger.info("Database migrations applied successfully.");
  } catch (error) {
    logger.error("Failed to apply database migrations", error);
    throw error;
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  runMigrations()
    .then(() => {
      process.exit(0);
    })
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
