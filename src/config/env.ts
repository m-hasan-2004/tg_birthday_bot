import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

const DEFAULT_NEON_DB = "postgresql://neondb_owner:npg_GY67EDWONsjg@ep-wispy-wildflower-b1gsxcmj.c-5.eu-central-1.aws.neon.tech/neondb?sslmode=require";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  PORT: z.coerce.number().default(3005),
  TELEGRAM_BOT_TOKEN: z.string().min(1).default("8615690672:AAFlt7llwXiJPVAVQA2qLQ-5XNx_HZRcArI"),
  DATABASE_URL: z.string().default(DEFAULT_NEON_DB),
  WEBHOOK_URL: z.preprocess((v) => (!v ? "" : v), z.string().url().or(z.literal(""))).default("https://tg-birthday-bot.vercel.app"),
  WEBHOOK_SECRET: z.string().optional().default(""),
  CRON_SECRET: z.string().optional().default(""),
  DEFAULT_TIMEZONE: z.string().default("Asia/Tehran"),
  WEB_APP_URL: z.preprocess((v) => (!v ? "" : v), z.string().url().or(z.literal(""))).default("https://tg-birthday-bot.vercel.app"),
  SESSION_SECRET: z.string().default("a28291b6c5330495aaf8113c7a4891ccbc041c67e37f2c806df77fa22818c34c"),
  OWNER_TELEGRAM_ID: z.string().default("5138117035"),
  ADMIN_TELEGRAM_IDS: z.string().optional().default("5138117035"),
});

export type Env = z.infer<typeof envSchema>;

let parsedEnv: Env;

try {
  parsedEnv = envSchema.parse(process.env);
} catch (error) {
  parsedEnv = envSchema.parse({
    NODE_ENV: process.env.NODE_ENV || "production",
    PORT: process.env.PORT || 3005,
    TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN || "8615690672:AAFlt7llwXiJPVAVQA2qLQ-5XNx_HZRcArI",
    DATABASE_URL: process.env.DATABASE_URL || DEFAULT_NEON_DB,
    SESSION_SECRET: process.env.SESSION_SECRET || "a28291b6c5330495aaf8113c7a4891ccbc041c67e37f2c806df77fa22818c34c",
    OWNER_TELEGRAM_ID: process.env.OWNER_TELEGRAM_ID || "5138117035",
    ADMIN_TELEGRAM_IDS: process.env.ADMIN_TELEGRAM_IDS || "5138117035",
    WEBHOOK_URL: process.env.WEBHOOK_URL || "https://tg-birthday-bot.vercel.app",
    WEB_APP_URL: process.env.WEB_APP_URL || "https://tg-birthday-bot.vercel.app",
    ...process.env,
  });
}

export const env = parsedEnv;
