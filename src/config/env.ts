import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  PORT: z.coerce.number().default(3005),
  TELEGRAM_BOT_TOKEN: z.string().min(1, "TELEGRAM_BOT_TOKEN is required"),
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  WEBHOOK_URL: z.string().url().optional().or(z.literal("")),
  WEBHOOK_SECRET: z.string().optional().default(""),
  CRON_SECRET: z.string().optional().default(""),
  DEFAULT_TIMEZONE: z.string().default("Europe/Berlin"),
  WEB_APP_URL: z.string().url().optional().or(z.literal("")),
  SESSION_SECRET: z.string().default("default_dev_session_secret_change_in_production_12345"),
  OWNER_TELEGRAM_ID: z.string().default("5138117035"),
  ADMIN_TELEGRAM_IDS: z.string().optional().default(""),
});

export type Env = z.infer<typeof envSchema>;

let parsedEnv: Env;

try {
  parsedEnv = envSchema.parse(process.env);
} catch (error) {
  if (process.env.NODE_ENV === "test") {
    parsedEnv = envSchema.parse({
      NODE_ENV: "test",
      PORT: 3005,
      TELEGRAM_BOT_TOKEN: "mock_token_for_tests",
      DATABASE_URL: "postgresql://postgres:postgres@localhost:5432/birthday_test",
      SESSION_SECRET: "test_secret_for_unit_tests",
      OWNER_TELEGRAM_ID: "5138117035",
      ADMIN_TELEGRAM_IDS: "12345678,99999999",
      ...process.env,
    });
  } else {
    parsedEnv = envSchema.parse({
      NODE_ENV: "development",
      PORT: 3005,
      TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN || "mock_dev_token_please_set_in_env",
      DATABASE_URL: process.env.DATABASE_URL || "postgresql://postgres:postgres@localhost:5432/birthday_tg",
      SESSION_SECRET: process.env.SESSION_SECRET || "dev_secret_session_key_32_characters",
      OWNER_TELEGRAM_ID: process.env.OWNER_TELEGRAM_ID || "5138117035",
      ADMIN_TELEGRAM_IDS: process.env.ADMIN_TELEGRAM_IDS || "",
      ...process.env,
    });
  }
}

export const env = parsedEnv;
