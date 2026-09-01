import { Bot, GrammyError, HttpError, InlineKeyboard } from "grammy";
import type { BotContext } from "./context.js";
import { env } from "../config/env.js";
import { userService } from "../services/user.service.js";
import { adminService } from "../services/admin.service.js";
import { logger } from "../utils/logger.js";
import { startHandler } from "./handlers/start.js";
import { menuHandler } from "./handlers/menu.js";
import { profileHandler } from "./handlers/profile.js";
import { peopleHandler } from "./handlers/people.js";
import { notesHandler } from "./handlers/notes.js";
import { birthdayHandler } from "./handlers/birthday.js";
import { remindersHandler } from "./handlers/reminders.js";
import { textHandler } from "./handlers/text.js";
import { notificationService } from "../services/notification.service.js";

import { adminHandler } from "./handlers/admin.js";

export function createBot(token: string = env.TELEGRAM_BOT_TOKEN): Bot<BotContext> {
  const bot = new Bot<BotContext>(token);

  // 1. Error handling middleware
  bot.catch((err) => {
    const ctx = err.ctx;
    const e = err.error;

    if (e instanceof GrammyError) {
      logger.error(`Grammy error in update ${ctx.update.update_id}:`, e, {
        description: e.description,
        errorCode: e.error_code,
      });
    } else if (e instanceof HttpError) {
      logger.error(`Network HTTP error contacting Telegram API in update ${ctx.update.update_id}:`, e);
    } else {
      logger.error(`Unhandled error while processing update ${ctx.update.update_id}:`, e);
    }

    try {
      if (ctx.chat?.id) {
        ctx.reply("Something went wrong.\n\nPlease try again.").catch(() => {});
      }
    } catch {
      // ignore secondary errors during reply
    }
  });

  // 2. Logging, User Context Injection & Disabled Account Middleware
  bot.use(async (ctx, next) => {
    const startTime = Date.now();
    const updateId = ctx.update.update_id;
    const telegramId = ctx.from?.id;

    if (telegramId) {
      try {
        let user = await userService.findByTelegramId(telegramId);
        if (!user) {
          user = await userService.createUser({
            telegramId,
            name: ctx.from?.first_name || "Friend",
          });
        }
        if (user) {
          if (user.isDisabled) {
            await ctx.reply("⛔ <b>Your account has been disabled by an administrator.</b>", {
              parse_mode: "HTML",
            });
            return;
          }
          ctx.user = user;
        }
      } catch (dbErr) {
        logger.error(`Database error fetching/creating user for telegramId ${telegramId}`, dbErr);
      }
    }

    await next();

    // Self-healing: dispatch any pending notifications in background on user activity
    notificationService.processAllDueNotifications(bot).catch(() => {});

    const elapsedMs = Date.now() - startTime;
    logger.debug(`Processed update ${updateId} in ${elapsedMs}ms`, {
      updateId,
      telegramId,
    });
  });

  // 3. Register Handlers in order
  bot.use(startHandler);
  bot.use(adminHandler);
  bot.use(menuHandler);
  bot.use(profileHandler);
  bot.use(peopleHandler);
  bot.use(notesHandler);
  bot.use(birthdayHandler);
  bot.use(remindersHandler);
  bot.use(textHandler);

  return bot;
}

export const bot = createBot();
