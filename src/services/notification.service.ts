import { and, eq, lte, sql } from "drizzle-orm";
import { Bot, InlineKeyboard } from "grammy";
import { DateTime } from "luxon";
import { db, DB } from "../db/index.js";
import { users, people, reminders, birthdayReminders, notificationLogs, notes } from "../db/schema.js";
import { formatBirthday, getBirthdayReminderTarget, getNextBirthday, getNextReminderOccurrence, isValidTimezone } from "../utils/dates.js";
import { logger } from "../utils/logger.js";
import { env } from "../config/env.js";

export class NotificationService {
  constructor(private readonly database: DB = db) {}

  /**
   * Checks if a notification log already exists (idempotency).
   */
  async isNotificationLogged(notificationKey: string): Promise<boolean> {
    const [existing] = await this.database
      .select({ id: notificationLogs.id })
      .from(notificationLogs)
      .where(eq(notificationLogs.notificationKey, notificationKey))
      .limit(1);

    return Boolean(existing);
  }

  /**
   * Records a notification dispatch into logs.
   */
  async recordNotification(
    userId: string,
    reminderType: "birthday" | "general",
    referenceId: string,
    notificationKey: string
  ): Promise<void> {
    try {
      await this.database.insert(notificationLogs).values({
        userId,
        reminderType,
        referenceId,
        notificationKey,
      });
    } catch (err) {
      // In case of unique constraint collision from concurrent executions, safely ignore
      logger.warn(`Notification log insert collision for key ${notificationKey}`);
    }
  }

  /**
   * Processes all due general reminders.
   */
  async processDueGeneralReminders(bot: Bot<any>, asOfDate: Date = new Date()): Promise<number> {
    let dispatchedCount = 0;

    const dueReminders = await this.database
      .select({
        reminderId: reminders.id,
        userId: reminders.userId,
        personId: reminders.personId,
        title: reminders.title,
        scheduledAt: reminders.scheduledAt,
        repeatType: reminders.repeatType,
        userTelegramId: users.telegramId,
        userTimezone: users.timezone,
        personName: people.name,
      })
      .from(reminders)
      .innerJoin(users, eq(reminders.userId, users.id))
      .leftJoin(people, eq(reminders.personId, people.id))
      .where(and(eq(reminders.status, "pending"), lte(reminders.scheduledAt, asOfDate)));

    for (const item of dueReminders) {
      const scheduledTimeMs = item.scheduledAt.getTime();
      const notificationKey = `gen_${item.reminderId}_${scheduledTimeMs}`;

      const alreadyLogged = await this.isNotificationLogged(notificationKey);
      if (alreadyLogged) {
        // Advance recurring or mark complete if not already updated
        continue;
      }

      // Build Telegram message
      const messageText = `⏰ <b>Reminder</b>\n\n${escapeHtml(item.title)}`;
      const keyboard = new InlineKeyboard();
      keyboard.text("✓ Done", `complete_rem_${item.reminderId}`);
      if (item.personId && item.personName) {
        keyboard.row().text(`👤 Open ${item.personName}`, `view_person_${item.personId}`);
      }

      try {
        await bot.api.sendMessage(item.userTelegramId, messageText, {
          parse_mode: "HTML",
          reply_markup: keyboard,
        });
        dispatchedCount++;

        // Record log
        await this.recordNotification(item.userId, "general", item.reminderId, notificationKey);

        // Update reminder state: if recurring advance date, otherwise mark complete
        if (item.repeatType && item.repeatType !== "none") {
          const nextDate = getNextReminderOccurrence(
            item.scheduledAt,
            item.repeatType as any,
            item.userTimezone
          );
          if (nextDate) {
            await this.database
              .update(reminders)
              .set({ scheduledAt: nextDate, status: "pending", updatedAt: new Date() })
              .where(eq(reminders.id, item.reminderId));
          } else {
            await this.database
              .update(reminders)
              .set({ status: "completed", updatedAt: new Date() })
              .where(eq(reminders.id, item.reminderId));
          }
        } else {
          await this.database
            .update(reminders)
            .set({ status: "completed", updatedAt: new Date() })
            .where(eq(reminders.id, item.reminderId));
        }
      } catch (err) {
        logger.error(`Failed to send general reminder notification ${item.reminderId}`, err);
      }
    }

    return dispatchedCount;
  }

  /**
   * Processes all due birthday reminders.
   */
  async processDueBirthdayReminders(bot: Bot<any>, asOfDate: Date = new Date()): Promise<number> {
    let dispatchedCount = 0;

    // Fetch all active birthday reminders joined with person and user
    const bdayRemindersList = await this.database
      .select({
        bdayReminderId: birthdayReminders.id,
        personId: birthdayReminders.personId,
        daysBefore: birthdayReminders.daysBefore,
        reminderTime: birthdayReminders.reminderTime,
        enabled: birthdayReminders.enabled,
        personName: people.name,
        birthday: people.birthday,
        userId: people.userId,
        userTelegramId: users.telegramId,
        userTimezone: users.timezone,
      })
      .from(birthdayReminders)
      .innerJoin(people, eq(birthdayReminders.personId, people.id))
      .innerJoin(users, eq(people.userId, users.id))
      .where(eq(birthdayReminders.enabled, true));

    for (const item of bdayRemindersList) {
      if (!item.birthday) continue;

      const userZone = isValidTimezone(item.userTimezone) ? item.userTimezone : (env.DEFAULT_TIMEZONE || "Asia/Tehran");
      const nowInUserZone = DateTime.fromJSDate(asOfDate).setZone(userZone);

      // Determine next birthday occurrence
      const nextBdayInfo = getNextBirthday(item.birthday, userZone, nowInUserZone);
      if (!nextBdayInfo) continue;

      const targetYear = nextBdayInfo.year;

      // Calculate scheduled time for this offset in user's timezone
      const scheduledTarget = getBirthdayReminderTarget(
        item.birthday,
        item.daysBefore,
        item.reminderTime,
        userZone,
        targetYear
      );

      if (!scheduledTarget) continue;

      // Check if scheduled time is due (<= now) and was scheduled for today/past in this window
      // (within the last 48 hours to prevent firing stale reminders from ancient dates)
      const isDue = nowInUserZone >= scheduledTarget;
      const isRecent = nowInUserZone.diff(scheduledTarget, "hours").hours < 48;

      if (isDue && isRecent) {
        const notificationKey = `bday_${item.personId}_${item.daysBefore}_${targetYear}`;

        const alreadyLogged = await this.isNotificationLogged(notificationKey);
        if (alreadyLogged) continue;

        // Fetch person notes
        const personNotesList = await this.database
          .select({ content: notes.content })
          .from(notes)
          .where(eq(notes.personId, item.personId));
        const notesStr = personNotesList.map((n: { content: string }) => n.content.trim()).filter(Boolean).join("\n• ");

        // Build notification text
        let messageText = "";
        if (item.daysBefore === 0) {
          messageText = `🎂 <b>Birthday Reminder</b>\n\nToday is <b>${escapeHtml(
            item.personName
          )}</b>'s birthday (${escapeHtml(formatBirthday(item.birthday))})! Don't forget! 🎉`;
        } else if (item.daysBefore === 1) {
          messageText = `🎂 <b>Birthday Reminder</b>\n\nBirthday of <b>${escapeHtml(
            item.personName
          )}</b> is tomorrow at <b>${escapeHtml(formatBirthday(item.birthday))}</b>! Don't forget!`;
        } else {
          messageText = `🎂 <b>Birthday Reminder</b>\n\nBirthday of <b>${escapeHtml(
            item.personName
          )}</b> is at <b>${escapeHtml(formatBirthday(item.birthday))}</b> (${item.daysBefore} days before)! Don't forget!`;
        }

        if (notesStr) {
          messageText += `\n\n📝 <b>Note:</b>\n• ${escapeHtml(notesStr)}`;
        }

        const keyboard = new InlineKeyboard().text(
          `👤 Open ${item.personName}`,
          `view_person_${item.personId}`
        );

        try {
          await bot.api.sendMessage(item.userTelegramId, messageText, {
            parse_mode: "HTML",
            reply_markup: keyboard,
          });
          dispatchedCount++;

          await this.recordNotification(
            item.userId,
            "birthday",
            item.bdayReminderId,
            notificationKey
          );
        } catch (err) {
          logger.error(`Failed to send birthday reminder to user ${item.userTelegramId}`, err);
        }
      }
    }

    return dispatchedCount;
  }

  /**
   * Main cron entry point to process both general and birthday notifications.
   */
  async processAllDueNotifications(bot: Bot<any>, asOfDate: Date = new Date()): Promise<{
    generalCount: number;
    birthdayCount: number;
  }> {
    logger.info(`Starting notification dispatch run at ${asOfDate.toISOString()}`);
    const generalCount = await this.processDueGeneralReminders(bot, asOfDate);
    const birthdayCount = await this.processDueBirthdayReminders(bot, asOfDate);
    logger.info(`Notification dispatch complete: ${generalCount} general, ${birthdayCount} birthday notifications sent.`);
    return { generalCount, birthdayCount };
  }
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export const notificationService = new NotificationService();
