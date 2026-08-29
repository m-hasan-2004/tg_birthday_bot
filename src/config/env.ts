import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  PORT: z.coerce.number().default(3005),
  TELEGRAM_BOT_TOKEN: z.string().min(1, "TELEGRAM_BOT_TOKEN is required").default("mock_token_for_tests"),
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  WEBHOOK_URL: z.preprocess((v) => (!v ? "" : v), z.string().url().or(z.literal(""))).default(""),
  WEBHOOK_SECRET: z.string().optional().default(""),
  CRON_SECRET: z.string().optional().default(""),
  DEFAULT_TIMEZONE: z.string().default("Europe/Berlin"),
  WEB_APP_URL: z.preprocess((v) => (!v ? "" : v), z.string().url().or(z.literal(""))).default(""),
  SESSION_SECRET: z.string().default("default_dev_session_secret_change_in_production_12345"),
  OWNER_TELEGRAM_ID: z.string().default("5138117035"),
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
    TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN || "mock_token_for_tests",
    DATABASE_URL: process.env.DATABASE_URL || "postgresql://hasan:Welcome@localhost:5432/dating_app",
    SESSION_SECRET: process.env.SESSION_SECRET || "dev_secret_session_key_32_characters",
    OWNER_TELEGRAM_ID: process.env.OWNER_TELEGRAM_ID || "5138117035",
    ADMIN_TELEGRAM_IDS: process.env.ADMIN_TELEGRAM_IDS || "",
    WEBHOOK_URL: process.env.WEBHOOK_URL || "",
    WEB_APP_URL: process.env.WEB_APP_URL || "",
    ...process.env,
  });
}

export const env = parsedEnv;
