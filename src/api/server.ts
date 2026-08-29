import { Hono } from "hono";
import { webhookCallback } from "grammy";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { bot } from "../bot/bot.js";
import { notificationService } from "../services/notification.service.js";
import { authRoutes } from "./routes/auth.routes.js";
import { appRoutes } from "./routes/app.routes.js";
import { adminRoutes } from "./routes/admin.routes.js";
import { env } from "../config/env.js";
import { logger } from "../utils/logger.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function createServer() {
  const app = new Hono();

  // Health check endpoint
  app.get("/health", (c) => {
    return c.json({
      status: "ok",
      timestamp: new Date().toISOString(),
      service: "birthday-tg-bot-web3",
    });
  });

  // Telegram webhook endpoint
  app.post(
    "/api/webhook",
    webhookCallback(bot, "hono", {
      secretToken: env.WEBHOOK_SECRET || undefined,
    })
  );

  // Scheduled reminder trigger endpoint (before appRoutes so it uses CRON_SECRET)
  const handleCron = async (c: any) => {
    const authHeader = c.req.header("Authorization");
    const querySecret = c.req.query("secret");

    if (env.CRON_SECRET) {
      const isAuthorized =
        authHeader === `Bearer ${env.CRON_SECRET}` || querySecret === env.CRON_SECRET;

      if (!isAuthorized) {
        logger.warn("Unauthorized request to /api/cron");
        return c.json({ error: "Unauthorized" }, 401);
      }
    }

    try {
      const results = await notificationService.processAllDueNotifications(bot);
      return c.json({
        success: true,
        dispatched: results,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error("Error executing /api/cron notification job", error);
      return c.json({ success: false, error: "Internal server error" }, 500);
    }
  };

  app.get("/api/cron", handleCron);
  app.post("/api/cron", handleCron);

  // Mount Auth REST API
  app.route("/api/auth", authRoutes);

  // Mount Admin REST API
  app.route("/api/admin", adminRoutes);

  // Mount Application REST API (Protected routes)
  app.route("/api", appRoutes);

  // Serve Web3 Web App HTML Frontend
  const clientHtmlPath = path.resolve(__dirname, "../client/index.html");
  let cachedHtml: string | null = null;

  const serveApp = (c: any) => {
    try {
      if (!cachedHtml || env.NODE_ENV === "development") {
        cachedHtml = fs.readFileSync(clientHtmlPath, "utf-8");
      }
      return c.html(cachedHtml);
    } catch (e) {
      logger.error("Failed to load Web3 frontend HTML:", e);
      return c.text("Web3 App Frontend loading error", 500);
    }
  };

  app.get("/app", serveApp);
  app.get("/", serveApp);

  return app;
}

export const app = createServer();
