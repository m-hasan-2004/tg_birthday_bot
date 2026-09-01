import { Composer, InlineKeyboard } from "grammy";
import type { BotContext } from "../context.js";
import { userService } from "../../services/user.service.js";
import { adminService } from "../../services/admin.service.js";
import { env } from "../../config/env.js";
import { getMainMenuKeyboard, getMonthPickerKeyboard, getDayPickerKeyboard } from "../keyboards/common.js";
import { formatBirthday } from "../../utils/dates.js";

export const startHandler = new Composer<BotContext>();

// /start command
startHandler.command("start", async (ctx) => {
  const telegramId = ctx.from?.id;
  if (!telegramId) return;

  const existingUser = await userService.findByTelegramId(telegramId);
  if (existingUser) {
    await userService.clearSessionState(existingUser.id);

    // If Administrator or Owner -> Show Admin Panel
    if (existingUser.role === "owner" || existingUser.role === "admin") {
      const stats = await adminService.getSystemStats();
      const adminText =
        `🛡️ <b>Administrator Panel</b>\n\n` +
        `Welcome, <b>${existingUser.name}</b> (${existingUser.role.toUpperCase()})\n\n` +
        `<b>Live Statistics:</b>\n` +
        `• Total Users: <b>${stats.totalUsers}</b> (Active: ${stats.activeUsers}, Disabled: ${stats.disabledUsers})\n` +
        `• Total Contacts: <b>${stats.totalPeople}</b>\n` +
        `• Total Notes: <b>${stats.totalNotes}</b>\n` +
        `• Total Reminders: <b>${stats.totalReminders}</b>\n` +
        `• Audit Logs: <b>${stats.totalAuditLogs}</b>`;

      const adminKeyboard = new InlineKeyboard()
        .text("👥 Manage Users", "admin_users").row()
        .text("📊 Detailed Statistics", "admin_stats")
        .text("📜 Audit Logs", "admin_audits").row()
        .text("🎂 Open Personal App", "open_menu");

      await ctx.reply(adminText, {
        parse_mode: "HTML",
        reply_markup: adminKeyboard,
      });
      return;
    }

    // Normal User -> Show standard menu
    await ctx.reply(`🎂 <b>Birthday Reminder</b>\n\nWelcome back, <b>${existingUser.name}</b>!`, {
      parse_mode: "HTML",
      reply_markup: getMainMenuKeyboard(existingUser),
    });
    return;
  }

  // New user onboarding
  const defaultName = ctx.from?.first_name || "";
  const newUser = await userService.createUser({
    telegramId,
    name: defaultName || "Friend",
  });

  // If newly created user is configured Owner -> Go straight to Admin Panel
  if (newUser.role === "owner" || newUser.role === "admin") {
    const stats = await adminService.getSystemStats();
    await ctx.reply(
      `🛡️ <b>Administrator Panel</b>\n\n` +
        `Welcome, <b>${newUser.name}</b> (OWNER)\n\n` +
        `• Total Users: <b>${stats.totalUsers}</b>\n` +
        `• Total Contacts: <b>${stats.totalPeople}</b>\n` +
        `• Total Reminders: <b>${stats.totalReminders}</b>`,
      {
        parse_mode: "HTML",
        reply_markup: new InlineKeyboard()
          .text("👥 Manage Users", "admin_users").row()
          .text("🎂 Open Personal App", "open_menu"),
      }
    );
    return;
  }

  await userService.setSessionState(newUser.id, {
    currentStep: "SIGNUP_NAME",
  });

  await ctx.reply(
    `🎂 <b>Welcome!</b>\n\nLet's set up your profile.\n\nWhat's your name?`,
    {
      parse_mode: "HTML",
    }
  );
});

// /help command
startHandler.command("help", async (ctx) => {
  await ctx.reply(
    `🎂 <b>Birthday & Reminder Bot</b>\n\n` +
      `This bot helps you remember birthdays, people, personal notes, and reminders.\n\n` +
      `• <b>👥 People:</b> View and manage your contacts, their birthdays, and personal notes.\n` +
      `• <b>➕ Add Person:</b> Quickly add a new person with optional birthday and notes.\n` +
      `• <b>⏰ Reminders:</b> Create birthday and scheduled reminders with custom recurrence.\n` +
      `• <b>👤 My Profile:</b> View and edit your name, birthday, notes, and timezone.\n\n` +
      `Use the buttons below to navigate:`,
    {
      parse_mode: "HTML",
      reply_markup: getMainMenuKeyboard(),
    }
  );
});

// /menu command
startHandler.command("menu", async (ctx) => {
  if (!ctx.user) return;
  await userService.clearSessionState(ctx.user.id);
  await ctx.reply(`🎂 <b>Birthday Reminder</b>`, {
    parse_mode: "HTML",
    reply_markup: getMainMenuKeyboard(),
  });
});

// Handling Signup Callback: Month Picker
startHandler.callbackQuery(/^signup_bday_m_(\d{2})$/, async (ctx) => {
  if (!ctx.user) return;
  const month = ctx.match[1];
  await ctx.answerCallbackQuery();

  await ctx.editMessageText(`When is your birthday?\n\nSelect day for month ${month}:`, {
    reply_markup: getDayPickerKeyboard("signup_bday", month),
  });
});

// Handling Signup Callback: Back to Month Picker
startHandler.callbackQuery("signup_bday_back_month", async (ctx) => {
  if (!ctx.user) return;
  await ctx.answerCallbackQuery();
  await ctx.editMessageText("When is your birthday?", {
    reply_markup: getMonthPickerKeyboard("signup_bday", true),
  });
});

// Handling Signup Callback: Day selected
startHandler.callbackQuery(/^signup_bday_d_(\d{2})_(\d{2})$/, async (ctx) => {
  if (!ctx.user) return;
  const month = ctx.match[1];
  const day = ctx.match[2];
  const birthdayStr = `${month}-${day}`;

  await ctx.answerCallbackQuery();
  await userService.updateProfile(ctx.user.id, { birthday: birthdayStr });

  await userService.setSessionState(ctx.user.id, {
    currentStep: "SIGNUP_INFO_PROMPT",
  });

  const keyboard = new InlineKeyboard()
    .text("Add information", "signup_info_add")
    .row()
    .text("Skip", "signup_info_skip");

  await ctx.editMessageText(
    `Birthday set to <b>${formatBirthday(birthdayStr)}</b>.\n\nWould you like to add anything else about yourself?`,
    {
      parse_mode: "HTML",
      reply_markup: keyboard,
    }
  );
});

// Handling Signup Callback: Skip Birthday
startHandler.callbackQuery("signup_bday_skip", async (ctx) => {
  if (!ctx.user) return;
  await ctx.answerCallbackQuery();

  await userService.setSessionState(ctx.user.id, {
    currentStep: "SIGNUP_INFO_PROMPT",
  });

  const keyboard = new InlineKeyboard()
    .text("Add information", "signup_info_add")
    .row()
    .text("Skip", "signup_info_skip");

  await ctx.editMessageText(
    `Would you like to add anything else about yourself?`,
    {
      parse_mode: "HTML",
      reply_markup: keyboard,
    }
  );
});

// Handling Signup Callback: Add Info clicked
startHandler.callbackQuery("signup_info_add", async (ctx) => {
  if (!ctx.user) return;
  await ctx.answerCallbackQuery();

  await userService.setSessionState(ctx.user.id, {
    currentStep: "SIGNUP_INFO_TEXT",
  });

  await ctx.editMessageText(
    `Please type a short note about yourself (e.g. "I live in Frankfurt and I like cycling."):`,
    {
      reply_markup: new InlineKeyboard().text("Skip", "signup_info_skip"),
    }
  );
});

// Handling Signup Callback: Skip Info / Finish Signup
startHandler.callbackQuery("signup_info_skip", async (ctx) => {
  if (!ctx.user) return;
  await ctx.answerCallbackQuery();

  await userService.clearSessionState(ctx.user.id);
  const updatedUser = await userService.findById(ctx.user.id);
  const name = updatedUser?.name || "there";

  await ctx.editMessageText(
    `✅ <b>You're all set!</b>\n\nWelcome, <b>${name}</b> 🎉`,
    {
      parse_mode: "HTML",
    }
  );

  await ctx.reply(`🎂 <b>Birthday Reminder</b>`, {
    parse_mode: "HTML",
    reply_markup: getMainMenuKeyboard(),
  });
});
