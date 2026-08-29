import { serve } from "@hono/node-server";
import { app } from "./api/server.js";
import { bot } from "./bot/bot.js";
import { env } from "./config/env.js";
import { logger } from "./utils/logger.js";
import { findAvailablePort } from "./utils/port.js";

async function bootstrap() {
  logger.info(`Starting Birthday TG Bot in ${env.NODE_ENV} mode...`);

  // If running in development with polling requested
  if (process.env.USE_POLLING === "true") {
    logger.info("Starting bot using Long Polling (development mode)...");
    try {
      await bot.init();
      bot.start({
        onStart: (botInfo) => {
          logger.info(`Bot @${botInfo.username} started successfully via polling.`);
        },
      });
    } catch (botErr) {
      logger.warn("Could not start Telegram polling (check your TELEGRAM_BOT_TOKEN):", undefined, botErr);
    }
  }

  // Start HTTP Server (for Web App and Webhook/API)
  const initialPort = env.PORT;
  const port = await findAvailablePort(initialPort);

  if (port !== initialPort) {
    logger.warn(`Port ${initialPort} is already in use. Automatically switched to available port ${port}.`);
  }

  logger.info(`Starting Webhook / API server on port ${port}...`);

  serve(
    {
      fetch: app.fetch,
      port,
    },
    (info) => {
      logger.info(`✅ Server is running at http://localhost:${info.port}`);
      logger.info(`📱 Web3 App is accessible at http://localhost:${info.port}/app`);
    }
  );

  // If WEBHOOK_URL is provided and we are not in polling mode or test
  if (env.WEBHOOK_URL && env.NODE_ENV !== "test" && process.env.USE_POLLING !== "true") {
    try {
      const fullWebhookUrl = `${env.WEBHOOK_URL.replace(/\/$/, "")}/api/webhook`;
      logger.info(`Registering Telegram webhook to: ${fullWebhookUrl}`);
      await bot.api.setWebhook(fullWebhookUrl, {
        secret_token: env.WEBHOOK_SECRET || undefined,
      });
      logger.info("Telegram webhook registered successfully.");
    } catch (err) {
      logger.error("Failed to register webhook with Telegram API", err);
    }
  }
}

bootstrap().catch((err) => {
  logger.error("Fatal error during bootstrap:", err);
  process.exit(1);
});
