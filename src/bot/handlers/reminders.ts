import { Composer, InlineKeyboard } from "grammy";
import { DateTime } from "luxon";
import type { BotContext } from "../context.js";
import { reminderService } from "../../services/reminder.service.js";
import { personService } from "../../services/person.service.js";
import { birthdayService } from "../../services/birthday.service.js";
import { userService } from "../../services/user.service.js";
import {
  getRecurrenceKeyboard,
  getTimePresetKeyboard,
  getMonthPickerKeyboard,
  getDayPickerKeyboard,
} from "../keyboards/common.js";
import { formatReminderDate, formatBirthday, isValidTimezone, RecurrenceType } from "../../utils/dates.js";

export const remindersHandler = new Composer<BotContext>();

// 1. Reminders List (Shared logic for callback and command)
async function renderReminders(ctx: BotContext) {
  const telegramId = ctx.from?.id;
  if (!telegramId) return;

  let user = ctx.user;
  if (!user) {
    user = (await userService.findByTelegramId(telegramId)) || (await userService.createUser({
      telegramId,
      name: ctx.from?.first_name || "Friend",
    }));
    ctx.user = user;
  }

  await userService.clearSessionState(user.id);

  const remindersList = await reminderService.listUpcomingRemindersByUser(user.id);
  const userZone = isValidTimezone(user.timezone) ? user.timezone : "Asia/Tehran";

  if (remindersList.length === 0) {
    const emptyText =
      `⏰ <b>No reminders yet.</b>\n\n` +
      `Create a reminder for a person's birthday or another important date.`;
    const keyboard = new InlineKeyboard()
      .text("➕ Create Reminder", "rem_wizard_start")
      .row()
      .text("← Back", "open_menu");

    try {
      await ctx.editMessageText(emptyText, {
        parse_mode: "HTML",
        reply_markup: keyboard,
      });
    } catch {
      await ctx.reply(emptyText, {
        parse_mode: "HTML",
        reply_markup: keyboard,
      });
    }
    return;
  }

  let text = `⏰ <b>Reminders</b>\n\n`;
  const keyboard = new InlineKeyboard();

  let currentDateHeading = "";
  for (const rem of remindersList) {
    const { dateStr, timeStr } = formatReminderDate(rem.scheduledAt, userZone);
    if (dateStr !== currentDateHeading) {
      currentDateHeading = dateStr;
      text += `<b>${escapeHtml(dateStr)}</b>\n────────────\n`;
    }
    const personTag = rem.personName ? ` (👤 ${rem.personName})` : "";
    text += `• ${escapeHtml(rem.title)}${escapeHtml(personTag)} — ${timeStr}\n\n`;

    const btnTitle = `${rem.title.length > 25 ? rem.title.slice(0, 25) + "..." : rem.title}`;
    keyboard.text(`⏰ ${btnTitle}`, `view_rem_${rem.id}`).row();
  }

  keyboard.text("➕ Create Reminder", "rem_wizard_start").row();
  keyboard.text("← Back", "open_menu");

  try {
    await ctx.editMessageText(text, {
      parse_mode: "HTML",
      reply_markup: keyboard,
    });
  } catch {
    await ctx.reply(text, {
      parse_mode: "HTML",
      reply_markup: keyboard,
    });
  }
}

remindersHandler.callbackQuery("menu_reminders", async (ctx) => {
  await ctx.answerCallbackQuery().catch(() => {});
  await renderReminders(ctx);
});

remindersHandler.command("reminders", async (ctx) => {
  await renderReminders(ctx);
});

// 2. View Reminder Details
remindersHandler.callbackQuery(/^view_rem_(.+)$/, async (ctx) => {
  if (!ctx.user) return;
  const reminderId = ctx.match[1];
  await ctx.answerCallbackQuery();
  await userService.clearSessionState(ctx.user.id);

  const reminder = await reminderService.getReminderById(ctx.user.id, reminderId);
  if (!reminder) {
    await ctx.reply("Reminder not found.", {
      reply_markup: new InlineKeyboard().text("⏰ Reminders", "menu_reminders"),
    });
    return;
  }

  const userZone = isValidTimezone(ctx.user.timezone) ? ctx.user.timezone : "Europe/Berlin";
  const { dateStr, timeStr } = formatReminderDate(reminder.scheduledAt, userZone);

  let text = `⏰ <b>${escapeHtml(reminder.title)}</b>\n\n`;
  text += `<b>Date:</b>\n${escapeHtml(dateStr)}\n\n`;
  text += `<b>Time:</b>\n${escapeHtml(timeStr)}\n\n`;

  if (reminder.personName) {
    text += `<b>Person:</b>\n${escapeHtml(reminder.personName)}\n\n`;
  }

  if (reminder.repeatType && reminder.repeatType !== "none") {
    text += `<b>Repeats:</b>\n${escapeHtml(reminder.repeatType)}\n\n`;
  }

  const keyboard = new InlineKeyboard()
    .text("✓ Complete", `complete_rem_${reminder.id}`)
    .text("✏️ Edit", `edit_rem_${reminder.id}`)
    .text("🗑 Delete", `delete_rem_${reminder.id}`)
    .row();

  if (reminder.personId) {
    keyboard.text(`👤 Open ${reminder.personName}`, `view_person_${reminder.personId}`).row();
  }
  keyboard.text("← Back", "menu_reminders");

  try {
    await ctx.editMessageText(text, {
      parse_mode: "HTML",
      reply_markup: keyboard,
    });
  } catch {
    await ctx.reply(text, {
      parse_mode: "HTML",
      reply_markup: keyboard,
    });
  }
});

// 3. Complete Reminder Action
remindersHandler.callbackQuery(/^complete_rem_(.+)$/, async (ctx) => {
  if (!ctx.user) return;
  const reminderId = ctx.match[1];
  await ctx.answerCallbackQuery();

  const userZone = isValidTimezone(ctx.user.timezone) ? ctx.user.timezone : "Europe/Berlin";
  const result = await reminderService.completeReminder(ctx.user.id, reminderId, userZone);

  if (!result.reminder) {
    await ctx.reply("Reminder not found.");
    return;
  }

  if (result.nextOccurrence) {
    const { dateStr, timeStr } = formatReminderDate(result.nextOccurrence, userZone);
    await ctx.editMessageText(
      `✓ <b>Completed for this occurrence!</b>\n\nNext occurrence scheduled for <b>${escapeHtml(
        dateStr
      )}</b> at <b>${timeStr}</b>.`,
      {
        parse_mode: "HTML",
        reply_markup: new InlineKeyboard().text("⏰ Reminders", "menu_reminders"),
      }
    );
  } else {
    await ctx.editMessageText("✓ <b>Reminder completed!</b>", {
      parse_mode: "HTML",
      reply_markup: new InlineKeyboard().text("⏰ Reminders", "menu_reminders"),
    });
  }
});

// 4. NEW STEP-BY-STEP REMINDER WIZARD FLOW

// Step 1: Who is this reminder for?
remindersHandler.callbackQuery("rem_wizard_start", async (ctx) => {
  if (!ctx.user) return;
  await ctx.answerCallbackQuery();

  const peopleList = await personService.listPeopleByUser(ctx.user.id);
  const keyboard = new InlineKeyboard();

  if (peopleList.length > 0) {
    for (const p of peopleList) {
      keyboard.text(`👤 ${p.name}`, `rem_wiz_sel_person_${p.id}`).row();
    }
  }

  keyboard.text("➕ Add Person", "menu_add_person").row();
  keyboard.text("⏰ One-time (No Person)", "rem_wiz_onetime").row();
  keyboard.text("← Cancel", "menu_reminders");

  const text =
    `⏰ <b>New Reminder</b>\n\n` +
    `Who should I remind you about?`;

  try {
    await ctx.editMessageText(text, {
      parse_mode: "HTML",
      reply_markup: keyboard,
    });
  } catch {
    await ctx.reply(text, {
      parse_mode: "HTML",
      reply_markup: keyboard,
    });
  }
});

// Step 2: Person Selected -> Show Birthday or Prompt to Add Birthday
remindersHandler.callbackQuery(/^rem_wiz_sel_person_(.+)$/, async (ctx) => {
  if (!ctx.user) return;
  const personId = ctx.match[1];
  await ctx.answerCallbackQuery();

  const person = await personService.getPersonById(ctx.user.id, personId);
  if (!person) return;

  if (!person.birthday) {
    const text =
      `👤 <b>${escapeHtml(person.name)}</b>\n\n` +
      `This person doesn't have a birthday set yet.`;

    const keyboard = new InlineKeyboard()
      .text("🎂 Add Birthday", `person_edit_bday_${person.id}`)
      .row()
      .text("✏️ Edit Person", `person_edit_${person.id}`)
      .row()
      .text("← Cancel", "rem_wizard_start");

    await ctx.editMessageText(text, {
      parse_mode: "HTML",
      reply_markup: keyboard,
    });
    return;
  }

  // Person has birthday -> Initialize multi-select offsets
  // Default selected: 30, 7, 1, 0
  const selectedOffsets = [30, 7, 1, 0];
  await userService.setSessionState(ctx.user.id, {
    currentStep: "REM_WIZ_OFFSETS",
    tempData: {
      personId: person.id,
      personName: person.name,
      birthday: person.birthday,
      selectedOffsets,
      reminderTime: "09:00",
    },
  });

  await renderBirthdayOffsetsScreen(ctx, person.name, person.birthday, selectedOffsets);
});

function renderBirthdayOffsetsScreen(ctx: any, personName: string, birthday: string, selected: number[]) {
  const bdayDisplay = formatBirthday(birthday);
  const text =
    `🎂 <b>${escapeHtml(personName)}'s Birthday</b>\n` +
    `Birthday: <b>${escapeHtml(bdayDisplay)}</b>\n\n` +
    `When should I remind you?\n<i>(Tap to toggle occasions)</i>`;

  const is30 = selected.includes(30);
  const is7 = selected.includes(7);
  const is1 = selected.includes(1);
  const is0 = selected.includes(0);

  const keyboard = new InlineKeyboard()
    .text(`${is30 ? "☑" : "☐"} 1 month before`, "rem_wiz_tog_30").row()
    .text(`${is7 ? "☑" : "☐"} 1 week before`, "rem_wiz_tog_7").row()
    .text(`${is1 ? "☑" : "☐"} 1 day before`, "rem_wiz_tog_1").row()
    .text(`${is0 ? "☑" : "☐"} On the day`, "rem_wiz_tog_0").row()
    .text("➡️ Continue", "rem_wiz_to_time").row()
    .text("← Cancel", "menu_reminders");

  return ctx.editMessageText(text, {
    parse_mode: "HTML",
    reply_markup: keyboard,
  });
}

// Toggle Offset Checkboxes
remindersHandler.callbackQuery(/^rem_wiz_tog_(\d+)$/, async (ctx) => {
  if (!ctx.user) return;
  const offset = parseInt(ctx.match[1], 10);
  await ctx.answerCallbackQuery();

  const state = await userService.getSessionState(ctx.user.id);
  const tempData = state?.tempData || {};
  let selected: number[] = (tempData.selectedOffsets as number[]) || [30, 7, 1, 0];

  if (selected.includes(offset)) {
    selected = selected.filter((o) => o !== offset);
  } else {
    selected.push(offset);
  }
  selected.sort((a, b) => b - a);

  tempData.selectedOffsets = selected;
  await userService.setSessionState(ctx.user.id, {
    currentStep: "REM_WIZ_OFFSETS",
    tempData,
  });

  await renderBirthdayOffsetsScreen(
    ctx,
    String(tempData.personName || "Friend"),
    String(tempData.birthday || "01-01"),
    selected
  );
});

// Step 3: Select Reminder Time
remindersHandler.callbackQuery("rem_wiz_to_time", async (ctx) => {
  if (!ctx.user) return;
  await ctx.answerCallbackQuery();

  const state = await userService.getSessionState(ctx.user.id);
  const tempData = state?.tempData || {};
  const userZone = isValidTimezone(ctx.user.timezone) ? ctx.user.timezone : "Europe/Berlin";

  const keyboard = new InlineKeyboard()
    .text("09:00", "rem_wiz_time_09:00")
    .text("10:00", "rem_wiz_time_10:00")
    .row()
    .text("12:00", "rem_wiz_time_12:00")
    .text("18:00", "rem_wiz_time_18:00")
    .row()
    .text("← Back", "rem_wiz_back_to_offsets");

  const text =
    `⏰ <b>Reminder Time</b>\n\n` +
    `What time should I remind you?\n\n` +
    `Timezone: <code>${escapeHtml(userZone)}</code>`;

  await ctx.editMessageText(text, {
    parse_mode: "HTML",
    reply_markup: keyboard,
  });
});

remindersHandler.callbackQuery("rem_wiz_back_to_offsets", async (ctx) => {
  if (!ctx.user) return;
  await ctx.answerCallbackQuery();

  const state = await userService.getSessionState(ctx.user.id);
  const tempData = state?.tempData || {};
  await renderBirthdayOffsetsScreen(
    ctx,
    String(tempData.personName || "Friend"),
    String(tempData.birthday || "01-01"),
    (tempData.selectedOffsets as number[]) || [30, 7, 1, 0]
  );
});

// Step 4: Time Chosen -> Review Screen
remindersHandler.callbackQuery(/^rem_wiz_time_(.+)$/, async (ctx) => {
  if (!ctx.user) return;
  const timeStr = ctx.match[1];
  await ctx.answerCallbackQuery();

  const state = await userService.getSessionState(ctx.user.id);
  const tempData = state?.tempData || {};
  tempData.reminderTime = timeStr;

  await userService.setSessionState(ctx.user.id, {
    currentStep: "REM_WIZ_REVIEW",
    tempData,
  });

  const personName = String(tempData.personName || "Friend");
  const bdayDisplay = formatBirthday(String(tempData.birthday || "01-01"));
  const selected = (tempData.selectedOffsets as number[]) || [];
  const userZone = isValidTimezone(ctx.user.timezone) ? ctx.user.timezone : "Europe/Berlin";

  let occasionsText = "";
  if (selected.includes(30)) occasionsText += "✓ 1 month before\n";
  if (selected.includes(7)) occasionsText += "✓ 1 week before\n";
  if (selected.includes(1)) occasionsText += "✓ 1 day before\n";
  if (selected.includes(0)) occasionsText += "✓ On the day\n";
  if (!occasionsText) occasionsText = "None selected\n";

  const reviewText =
    `🎂 <b>Birthday Reminders Review</b>\n\n` +
    `<b>Person:</b> ${escapeHtml(personName)}\n` +
    `<b>Birthday:</b> ${escapeHtml(bdayDisplay)}\n\n` +
    `<b>Remind me:</b>\n${occasionsText}\n` +
    `<b>Time:</b> ${timeStr}\n` +
    `<b>Timezone:</b> ${escapeHtml(userZone)}`;

  const keyboard = new InlineKeyboard()
    .text("💾 Save Reminders", "rem_wiz_save")
    .row()
    .text("✏️ Edit Occasions", "rem_wiz_back_to_offsets")
    .row()
    .text("Cancel", "menu_reminders");

  await ctx.editMessageText(reviewText, {
    parse_mode: "HTML",
    reply_markup: keyboard,
  });
});

// Step 5: Save Birthday Reminders Configuration to Database
remindersHandler.callbackQuery("rem_wiz_save", async (ctx) => {
  if (!ctx.user) return;
  await ctx.answerCallbackQuery();

  const state = await userService.getSessionState(ctx.user.id);
  const tempData = state?.tempData || {};
  const personId = String(tempData.personId);
  const selected = (tempData.selectedOffsets as number[]) || [];
  const reminderTime = String(tempData.reminderTime || "09:00");

  // Save selected offsets to birthday_reminders table
  const allPossibleOffsets = [30, 14, 7, 3, 1, 0];
  for (const offset of allPossibleOffsets) {
    const isEnabled = selected.includes(offset);
    const existing = await birthdayService.getBirthdayRemindersForPerson(ctx.user.id, personId);
    const found = existing.find((e) => e.daysBefore === offset);

    if (found) {
      if (found.enabled !== isEnabled) {
        await birthdayService.toggleBirthdayReminderOffset(ctx.user.id, personId, offset);
      }
    } else if (isEnabled) {
      await birthdayService.addCustomBirthdayReminderOffset(ctx.user.id, personId, offset);
    }
  }

  // Set default reminder time
  await birthdayService.setPersonBirthdayReminderTime(ctx.user.id, personId, reminderTime);

  await userService.clearSessionState(ctx.user.id);

  const successText = `✅ <b>Birthday reminders saved for ${escapeHtml(String(tempData.personName || "Person"))}!</b>`;
  const keyboard = new InlineKeyboard()
    .text(`👤 View ${escapeHtml(String(tempData.personName || "Person"))}`, `view_person_${personId}`)
    .row()
    .text("⏰ Reminders List", "menu_reminders");

  await ctx.editMessageText(successText, {
    parse_mode: "HTML",
    reply_markup: keyboard,
  });
});

// One-time Reminder Flow
remindersHandler.callbackQuery("rem_wiz_onetime", async (ctx) => {
  if (!ctx.user) return;
  await ctx.answerCallbackQuery();

  await userService.setSessionState(ctx.user.id, {
    currentStep: "ADD_REM_TITLE",
    tempData: {},
  });

  const keyboard = new InlineKeyboard().text("← Back", "rem_wizard_start");
  await ctx.editMessageText("⏰ <b>One-Time Reminder</b>\n\nWhat should I remind you about?", {
    parse_mode: "HTML",
    reply_markup: keyboard,
  });
});

// Delete Reminder
remindersHandler.callbackQuery(/^delete_rem_(.+)$/, async (ctx) => {
  if (!ctx.user) return;
  const reminderId = ctx.match[1];
  await ctx.answerCallbackQuery();

  const keyboard = new InlineKeyboard()
    .text("🗑 Yes, Delete", `confirm_del_rem_${reminderId}`)
    .text("Cancel", `view_rem_${reminderId}`);

  await ctx.editMessageText("Are you sure you want to delete this reminder?", {
    reply_markup: keyboard,
  });
});

remindersHandler.callbackQuery(/^confirm_del_rem_(.+)$/, async (ctx) => {
  if (!ctx.user) return;
  const reminderId = ctx.match[1];
  await ctx.answerCallbackQuery();

  await reminderService.deleteReminder(ctx.user.id, reminderId);

  await ctx.editMessageText("✅ Reminder deleted.", {
    reply_markup: new InlineKeyboard().text("⏰ Reminders", "menu_reminders"),
  });
});

// Edit Reminder Title
remindersHandler.callbackQuery(/^edit_rem_(.+)$/, async (ctx) => {
  if (!ctx.user) return;
  const reminderId = ctx.match[1];
  await ctx.answerCallbackQuery();

  await userService.setSessionState(ctx.user.id, {
    currentStep: "EDIT_REM_TITLE",
    tempData: { reminderId },
  });

  const keyboard = new InlineKeyboard().text("← Back", `view_rem_${reminderId}`);
  await ctx.editMessageText("Enter updated reminder title:", {
    reply_markup: keyboard,
  });
});

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
