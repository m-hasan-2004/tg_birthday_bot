import { Composer, InlineKeyboard } from "grammy";
import type { BotContext } from "../context.js";
import { birthdayService } from "../../services/birthday.service.js";
import { personService } from "../../services/person.service.js";
import { userService } from "../../services/user.service.js";
import { getBirthdayRemindersKeyboard, getTimePresetKeyboard } from "../keyboards/common.js";
import { formatBirthday } from "../../utils/dates.js";

export const birthdayHandler = new Composer<BotContext>();

// 1. View / Configure Birthday Reminders
birthdayHandler.callbackQuery(/^person_bday_rem_(.+)$/, async (ctx) => {
  if (!ctx.user) return;
  const personId = ctx.match[1];
  await ctx.answerCallbackQuery();
  await userService.clearSessionState(ctx.user.id);

  const person = await personService.getPersonById(ctx.user.id, personId);
  if (!person || !person.birthday) {
    await ctx.reply("Person does not have a birthday set.", {
      reply_markup: new InlineKeyboard().text("← Back", `view_person_${personId}`),
    });
    return;
  }

  const reminders = await birthdayService.getBirthdayRemindersForPerson(ctx.user.id, personId);
  const formattedDate = formatBirthday(person.birthday);

  const text =
    `🎂 <b>Birthday Reminder</b>\n\n` +
    `<b>${escapeHtml(person.name)}'s birthday:</b>\n${escapeHtml(formattedDate)}\n\n` +
    `<b>Remind me:</b>`;

  const keyboard = getBirthdayRemindersKeyboard(personId, reminders);

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

// 2. Toggle an offset (e.g. 30, 14, 7, 3, 1, 0, or custom)
birthdayHandler.callbackQuery(/^bday_toggle_(.+)_(.+)$/, async (ctx) => {
  if (!ctx.user) return;
  const personId = ctx.match[1];
  const daysBefore = parseInt(ctx.match[2], 10);
  await ctx.answerCallbackQuery();

  await birthdayService.toggleBirthdayReminderOffset(ctx.user.id, personId, daysBefore);

  const person = await personService.getPersonById(ctx.user.id, personId);
  if (!person) return;

  const reminders = await birthdayService.getBirthdayRemindersForPerson(ctx.user.id, personId);
  const formattedDate = formatBirthday(person.birthday);

  const text =
    `🎂 <b>Birthday Reminder</b>\n\n` +
    `<b>${escapeHtml(person.name)}'s birthday:</b>\n${escapeHtml(formattedDate)}\n\n` +
    `<b>Remind me:</b>`;

  const keyboard = getBirthdayRemindersKeyboard(personId, reminders);

  await ctx.editMessageText(text, {
    parse_mode: "HTML",
    reply_markup: keyboard,
  });
});

// 3. Delete a custom offset
birthdayHandler.callbackQuery(/^bday_del_(.+)_(.+)$/, async (ctx) => {
  if (!ctx.user) return;
  const personId = ctx.match[1];
  const daysBefore = parseInt(ctx.match[2], 10);
  await ctx.answerCallbackQuery();

  await birthdayService.deleteBirthdayReminderOffset(ctx.user.id, personId, daysBefore);

  const person = await personService.getPersonById(ctx.user.id, personId);
  if (!person) return;

  const reminders = await birthdayService.getBirthdayRemindersForPerson(ctx.user.id, personId);
  const formattedDate = formatBirthday(person.birthday);

  const text =
    `🎂 <b>Birthday Reminder</b>\n\n` +
    `<b>${escapeHtml(person.name)}'s birthday:</b>\n${escapeHtml(formattedDate)}\n\n` +
    `<b>Remind me:</b>`;

  const keyboard = getBirthdayRemindersKeyboard(personId, reminders);

  await ctx.editMessageText(text, {
    parse_mode: "HTML",
    reply_markup: keyboard,
  });
});

// 4. Add Custom Offset Prompt
birthdayHandler.callbackQuery(/^bday_custom_(.+)$/, async (ctx) => {
  if (!ctx.user) return;
  const personId = ctx.match[1];
  await ctx.answerCallbackQuery();

  await userService.setSessionState(ctx.user.id, {
    currentStep: "CUSTOM_BDAY_OFFSET",
    tempData: { personId },
  });

  const keyboard = new InlineKeyboard()
    .text("45 days", `bday_preset_custom_${personId}_45`)
    .text("60 days", `bday_preset_custom_${personId}_60`)
    .row()
    .text("90 days", `bday_preset_custom_${personId}_90`)
    .text("100 days", `bday_preset_custom_${personId}_100`)
    .row()
    .text("← Back", `person_bday_rem_${personId}`);

  await ctx.editMessageText(
    "How many days before the birthday would you like to be reminded?\n\nType a number (e.g. <code>45</code>) or pick a preset:",
    {
      parse_mode: "HTML",
      reply_markup: keyboard,
    }
  );
});

// Preset custom offset selected
birthdayHandler.callbackQuery(/^bday_preset_custom_(.+)_(.+)$/, async (ctx) => {
  if (!ctx.user) return;
  const personId = ctx.match[1];
  const days = parseInt(ctx.match[2], 10);
  await ctx.answerCallbackQuery();

  await birthdayService.addCustomBirthdayReminderOffset(ctx.user.id, personId, days);
  await userService.clearSessionState(ctx.user.id);

  const person = await personService.getPersonById(ctx.user.id, personId);
  if (!person) return;

  const reminders = await birthdayService.getBirthdayRemindersForPerson(ctx.user.id, personId);
  const formattedDate = formatBirthday(person.birthday);

  const text =
    `🎂 <b>Birthday Reminder</b>\n\n` +
    `<b>${escapeHtml(person.name)}'s birthday:</b>\n${escapeHtml(formattedDate)}\n\n` +
    `<b>Remind me:</b>`;

  const keyboard = getBirthdayRemindersKeyboard(personId, reminders);

  await ctx.editMessageText(text, {
    parse_mode: "HTML",
    reply_markup: keyboard,
  });
});

// 5. Change Reminder Time Prompt
birthdayHandler.callbackQuery(/^bday_time_(.+)$/, async (ctx) => {
  if (!ctx.user) return;
  const personId = ctx.match[1];
  await ctx.answerCallbackQuery();

  await userService.setSessionState(ctx.user.id, {
    currentStep: "CUSTOM_BDAY_TIME",
    tempData: { personId },
  });

  const keyboard = getTimePresetKeyboard(`bday_set_time_${personId}`);

  await ctx.editMessageText(
    "🕘 <b>Reminder Time</b>\n\nSelect the time when birthday reminders should be sent in your timezone, or type a custom time (HH:mm, e.g. <code>09:30</code>):",
    {
      parse_mode: "HTML",
      reply_markup: keyboard,
    }
  );
});

// Preset time selected
birthdayHandler.callbackQuery(/^bday_set_time_(.+)_(.+)$/, async (ctx) => {
  if (!ctx.user) return;
  const personId = ctx.match[1];
  const timeStr = ctx.match[2];
  await ctx.answerCallbackQuery();

  await birthdayService.setPersonBirthdayReminderTime(ctx.user.id, personId, timeStr);
  await userService.clearSessionState(ctx.user.id);

  const person = await personService.getPersonById(ctx.user.id, personId);
  if (!person) return;

  const reminders = await birthdayService.getBirthdayRemindersForPerson(ctx.user.id, personId);
  const formattedDate = formatBirthday(person.birthday);

  const text =
    `🎂 <b>Birthday Reminder</b>\n\n` +
    `<b>${escapeHtml(person.name)}'s birthday:</b>\n${escapeHtml(formattedDate)}\n\n` +
    `<b>Remind me:</b>`;

  const keyboard = getBirthdayRemindersKeyboard(personId, reminders);

  await ctx.editMessageText(text, {
    parse_mode: "HTML",
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
