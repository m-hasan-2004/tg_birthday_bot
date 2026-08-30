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
import { HTML_CONTENT } from "../client/html.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function createServer() {
  const app = new Hono();

  // Global verbose error handler
  app.onError((err, c) => {
    logger.error(`Unhandled Error on ${c.req.method} ${c.req.path}:`, err);
    return c.json({
      error: err.message || "Internal server error",
      stack: err.stack,
      path: c.req.path,
      method: c.req.method,
    }, 500);
  });

  // Health check endpoint
  app.get("/health", (c) => {
    return c.json({
      status: "ok",
      timestamp: new Date().toISOString(),
      service: "birthday-tg-bot",
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

  // Serve Web App HTML Frontend
  const serveApp = (c: any) => {
    return c.html(HTML_CONTENT);
  };

  app.get("/app", serveApp);
  app.get("/", serveApp);

  return app;
}

export const app = createServer();
