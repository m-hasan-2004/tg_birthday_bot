import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

const DEFAULT_NEON_DB = "postgresql://user:password@ep-sample-pool.neon.tech/neondb?sslmode=require";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  PORT: z.coerce.number().default(3005),
  TELEGRAM_BOT_TOKEN: z.string().default("1234567890:ABCdefGHIjklMNOpqrsTUVwxyz"),
  DATABASE_URL: z.string().default(DEFAULT_NEON_DB),
  WEBHOOK_URL: z.preprocess((v) => (!v ? "" : v), z.string().url().or(z.literal(""))).default(""),
  WEBHOOK_SECRET: z.string().optional().default(""),
  CRON_SECRET: z.string().optional().default(""),
  DEFAULT_TIMEZONE: z.string().default("Asia/Tehran"),
  WEB_APP_URL: z.preprocess((v) => (!v ? "" : v), z.string().url().or(z.literal(""))).default(""),
  SESSION_SECRET: z.string().default("change_this_session_secret_key_1234567890"),
  OWNER_TELEGRAM_ID: z.string().default("123456789"),
  ADMIN_TELEGRAM_IDS: z.string().optional().default(""),
});

export type Env = z.infer<typeof envSchema>;

let parsedEnv: Env;

try {
  parsedEnv = envSchema.parse(process.env);
} catch (error) {
  parsedEnv = envSchema.parse({
    NODE_ENV: process.env.NODE_ENV || "development",
    PORT: process.env.PORT || 3005,
    TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN || "1234567890:ABCdefGHIjklMNOpqrsTUVwxyz",
    DATABASE_URL: process.env.DATABASE_URL || DEFAULT_NEON_DB,
    SESSION_SECRET: process.env.SESSION_SECRET || "change_this_session_secret_key_1234567890",
    OWNER_TELEGRAM_ID: process.env.OWNER_TELEGRAM_ID || "123456789",
    ADMIN_TELEGRAM_IDS: process.env.ADMIN_TELEGRAM_IDS || "",
    WEBHOOK_URL: process.env.WEBHOOK_URL || "",
    WEB_APP_URL: process.env.WEB_APP_URL || "",
    ...process.env,
  });
}

export const env = parsedEnv;
