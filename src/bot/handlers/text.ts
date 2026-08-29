import { Composer, InlineKeyboard } from "grammy";
import { DateTime } from "luxon";
import type { BotContext } from "../context.js";
import { userService } from "../../services/user.service.js";
import { personService } from "../../services/person.service.js";
import { noteService } from "../../services/note.service.js";
import { birthdayService } from "../../services/birthday.service.js";
import { reminderService } from "../../services/reminder.service.js";
import {
  getMonthPickerKeyboard,
  getMainMenuKeyboard,
  getBirthdayRemindersKeyboard,
  getTimePresetKeyboard,
  getRecurrenceKeyboard,
} from "../keyboards/common.js";
import {
  validateName,
  validateOffsetDays,
  validateTimeStr,
  validateTimezone,
} from "../../utils/validation.js";
import { formatBirthday, isValidTimezone, parseBirthday } from "../../utils/dates.js";

export const textHandler = new Composer<BotContext>();

textHandler.on("message:text", async (ctx) => {
  if (!ctx.user) return;
  const text = ctx.message.text.trim();
  const state = await userService.getSessionState(ctx.user.id);
  const step = state?.currentStep;
  const tempData = state?.tempData || {};

  if (!step) {
    // If no active flow, provide main menu guidance
    await ctx.reply("Please use the menu buttons to navigate:", {
      reply_markup: getMainMenuKeyboard(),
    });
    return;
  }

  // 1. SIGNUP_NAME
  if (step === "SIGNUP_NAME") {
    const valid = validateName(text);
    if (!valid.isValid) {
      await ctx.reply(valid.error || "Please enter a valid name.");
      return;
    }

    await userService.updateProfile(ctx.user.id, { name: valid.cleanName });
    await userService.setSessionState(ctx.user.id, {
      currentStep: "SIGNUP_BIRTHDAY_PROMPT",
    });

    const keyboard = getMonthPickerKeyboard("signup_bday", true);
    await ctx.reply("When is your birthday?", {
      reply_markup: keyboard,
    });
    return;
  }

  // 2. SIGNUP_INFO_TEXT
  if (step === "SIGNUP_INFO_TEXT") {
    await userService.updateProfile(ctx.user.id, { additionalInfo: text });
    await userService.clearSessionState(ctx.user.id);

    const user = (await userService.findById(ctx.user.id)) || ctx.user;
    await ctx.reply(`✅ <b>You're all set!</b>\n\nWelcome, <b>${escapeHtml(user.name)}</b> 🎉`, {
      parse_mode: "HTML",
    });

    await ctx.reply(`🎂 <b>Birthday Reminder</b>`, {
      parse_mode: "HTML",
      reply_markup: getMainMenuKeyboard(),
    });
    return;
  }

  // 3. EDIT_PROFILE_NAME
  if (step === "EDIT_PROFILE_NAME") {
    const valid = validateName(text);
    if (!valid.isValid) {
      await ctx.reply(valid.error || "Please enter a valid name.");
      return;
    }

    await userService.updateProfile(ctx.user.id, { name: valid.cleanName });
    await userService.clearSessionState(ctx.user.id);

    await ctx.reply(`✅ Name updated to <b>${escapeHtml(valid.cleanName)}</b>!`, {
      parse_mode: "HTML",
      reply_markup: new InlineKeyboard().text("👤 My Profile", "menu_profile"),
    });
    return;
  }

  // 4. EDIT_PROFILE_INFO
  if (step === "EDIT_PROFILE_INFO") {
    await userService.updateProfile(ctx.user.id, { additionalInfo: text });
    await userService.clearSessionState(ctx.user.id);

    await ctx.reply("✅ Profile information updated!", {
      reply_markup: new InlineKeyboard().text("👤 My Profile", "menu_profile"),
    });
    return;
  }

  // 5. EDIT_PROFILE_TZ_CUSTOM
  if (step === "EDIT_PROFILE_TZ_CUSTOM") {
    const valid = validateTimezone(text);
    if (!valid.isValid || !valid.timezone) {
      await ctx.reply(
        "Invalid IANA timezone identifier (e.g. <code>Europe/Berlin</code>, <code>America/New_York</code>). Please try again:",
        { parse_mode: "HTML" }
      );
      return;
    }

    await userService.updateProfile(ctx.user.id, { timezone: valid.timezone });
    await userService.clearSessionState(ctx.user.id);

    await ctx.reply(`✅ Timezone updated to <b>${escapeHtml(valid.timezone)}</b>!`, {
      parse_mode: "HTML",
      reply_markup: new InlineKeyboard().text("👤 My Profile", "menu_profile"),
    });
    return;
  }

  // 6. ADD_PERSON_NAME
  if (step === "ADD_PERSON_NAME") {
    const valid = validateName(text);
    if (!valid.isValid) {
      await ctx.reply(valid.error || "Please enter a valid name.");
      return;
    }

    await userService.setSessionState(ctx.user.id, {
      currentStep: "ADD_PERSON_BIRTHDAY",
      tempData: { name: valid.cleanName },
    });

    const keyboard = getMonthPickerKeyboard("add_person_bday", true);
    await ctx.reply(`When is ${escapeHtml(valid.cleanName)}'s birthday?`, {
      parse_mode: "HTML",
      reply_markup: keyboard,
    });
    return;
  }

  // 7. ADD_PERSON_NOTE_TEXT
  if (step === "ADD_PERSON_NOTE_TEXT") {
    const name = String(tempData.name || "Friend");
    const birthday = (tempData.birthday as string) || null;

    const person = await personService.createPerson(ctx.user.id, {
      name,
      birthday,
      note: text,
    });

    await userService.clearSessionState(ctx.user.id);

    await ctx.reply(`✅ <b>${escapeHtml(person.name)}</b> added.`, {
      parse_mode: "HTML",
      reply_markup: new InlineKeyboard()
        .text(`👤 View ${person.name}`, `view_person_${person.id}`)
        .row()
        .text("👥 People", "menu_people"),
    });
    return;
  }

  // 8. EDIT_PERSON_NAME
  if (step === "EDIT_PERSON_NAME") {
    const personId = String(tempData.personId);
    const valid = validateName(text);
    if (!valid.isValid) {
      await ctx.reply(valid.error || "Please enter a valid name.");
      return;
    }

    await personService.updatePerson(ctx.user.id, personId, { name: valid.cleanName });
    await userService.clearSessionState(ctx.user.id);

    await ctx.reply(`✅ Name updated to <b>${escapeHtml(valid.cleanName)}</b>!`, {
      parse_mode: "HTML",
      reply_markup: new InlineKeyboard().text("👤 Open Person", `view_person_${personId}`),
    });
    return;
  }

  // 9. ADD_NOTE_TEXT
  if (step === "ADD_NOTE_TEXT") {
    const personId = String(tempData.personId);
    await noteService.addNote(ctx.user.id, personId, text);
    await userService.clearSessionState(ctx.user.id);

    await ctx.reply("✅ Note added!", {
      reply_markup: new InlineKeyboard().text("📝 View Notes", `person_notes_${personId}`),
    });
    return;
  }

  // 10. EDIT_NOTE_TEXT
  if (step === "EDIT_NOTE_TEXT") {
    const noteId = String(tempData.noteId);
    const personId = String(tempData.personId);
    await noteService.updateNote(ctx.user.id, noteId, text);
    await userService.clearSessionState(ctx.user.id);

    await ctx.reply("✅ Note updated!", {
      reply_markup: new InlineKeyboard().text("📝 View Notes", `person_notes_${personId}`),
    });
    return;
  }

  // 11. CUSTOM_BDAY_OFFSET
  if (step === "CUSTOM_BDAY_OFFSET") {
    const personId = String(tempData.personId);
    const valid = validateOffsetDays(text);
    if (!valid.isValid || valid.offsetDays === undefined) {
      await ctx.reply(valid.error || "Please enter a positive whole number of days (e.g. 45).");
      return;
    }

    await birthdayService.addCustomBirthdayReminderOffset(ctx.user.id, personId, valid.offsetDays);
    await userService.clearSessionState(ctx.user.id);

    const person = await personService.getPersonById(ctx.user.id, personId);
    const reminders = await birthdayService.getBirthdayRemindersForPerson(ctx.user.id, personId);
    const formattedDate = person?.birthday ? formatBirthday(person.birthday) : "";

    const msg =
      `🎂 <b>Birthday Reminder</b>\n\n` +
      `<b>${escapeHtml(person?.name || "")}'s birthday:</b>\n${escapeHtml(formattedDate)}\n\n` +
      `<b>Remind me:</b>`;

    await ctx.reply(`✅ Added reminder <b>${valid.offsetDays} days before</b>.`, {
      parse_mode: "HTML",
    });

    await ctx.reply(msg, {
      parse_mode: "HTML",
      reply_markup: getBirthdayRemindersKeyboard(personId, reminders),
    });
    return;
  }

  // 12. CUSTOM_BDAY_TIME
  if (step === "CUSTOM_BDAY_TIME") {
    const personId = String(tempData.personId);
    const valid = validateTimeStr(text);
    if (!valid.isValid || !valid.timeStr) {
      await ctx.reply(valid.error || "Please enter time in HH:mm format (e.g. 09:30).");
      return;
    }

    await birthdayService.setPersonBirthdayReminderTime(ctx.user.id, personId, valid.timeStr);
    await userService.clearSessionState(ctx.user.id);

    const person = await personService.getPersonById(ctx.user.id, personId);
    const reminders = await birthdayService.getBirthdayRemindersForPerson(ctx.user.id, personId);
    const formattedDate = person?.birthday ? formatBirthday(person.birthday) : "";

    const msg =
      `🎂 <b>Birthday Reminder</b>\n\n` +
      `<b>${escapeHtml(person?.name || "")}'s birthday:</b>\n${escapeHtml(formattedDate)}\n\n` +
      `<b>Remind me:</b>`;

    await ctx.reply(`✅ Reminder time updated to <b>${valid.timeStr}</b>.`, {
      parse_mode: "HTML",
    });

    await ctx.reply(msg, {
      parse_mode: "HTML",
      reply_markup: getBirthdayRemindersKeyboard(personId, reminders),
    });
    return;
  }

  // 13. ADD_REM_TITLE
  if (step === "ADD_REM_TITLE") {
    if (!text || text.length > 255) {
      await ctx.reply("Please enter a title between 1 and 255 characters.");
      return;
    }

    tempData.title = text;
    await userService.setSessionState(ctx.user.id, {
      currentStep: "ADD_REM_DATE",
      tempData,
    });

    const keyboard = new InlineKeyboard()
      .text("Today", "rem_date_preset_today")
      .text("Tomorrow", "rem_date_preset_tomorrow")
      .row()
      .text("In 2 days", "rem_date_preset_in2days")
      .text("In 1 week", "rem_date_preset_in1week")
      .row()
      .text("📅 Choose Date", "rem_date_picker")
      .row()
      .text("← Back", "menu_reminders");

    await ctx.reply("When?", {
      reply_markup: keyboard,
    });
    return;
  }

  // 14. ADD_REM_DATE (if entered as text)
  if (step === "ADD_REM_DATE") {
    const parsed = parseBirthday(text);
    if (!parsed) {
      await ctx.reply("Please select a date using the buttons above, or enter date format (e.g. 2026-09-20 or 09-20).");
      return;
    }

    const userZone = isValidTimezone(ctx.user.timezone) ? ctx.user.timezone : "Europe/Berlin";
    const now = DateTime.now().setZone(userZone);
    const year = parsed.year || now.year;
    const month = String(parsed.month).padStart(2, "0");
    const day = String(parsed.day).padStart(2, "0");
    const dateStr = `${year}-${month}-${day}`;

    tempData.dateStr = dateStr;
    await userService.setSessionState(ctx.user.id, {
      currentStep: "ADD_REM_TIME",
      tempData,
    });

    const keyboard = getTimePresetKeyboard("rem_time_preset");
    await ctx.reply(`Date: <b>${escapeHtml(dateStr)}</b>\n\nWhat time?`, {
      parse_mode: "HTML",
      reply_markup: keyboard,
    });
    return;
  }

  // 15. ADD_REM_TIME (if entered as text)
  if (step === "ADD_REM_TIME") {
    const valid = validateTimeStr(text);
    if (!valid.isValid || !valid.timeStr) {
      await ctx.reply(valid.error || "Please enter time in HH:mm format (e.g. 09:00).");
      return;
    }

    tempData.timeStr = valid.timeStr;

    if (tempData.personId) {
      await userService.setSessionState(ctx.user.id, {
        currentStep: "ADD_REM_REPEAT",
        tempData,
      });

      await ctx.reply("Does this repeat?", {
        reply_markup: getRecurrenceKeyboard("rem_recur"),
      });
    } else {
      const peopleList = await personService.listPeopleByUser(ctx.user.id);
      const keyboard = new InlineKeyboard();
      for (const p of peopleList) {
        keyboard.text(p.name, `rem_set_person_${p.id}`).row();
      }
      keyboard.text("Nobody", "rem_set_person_none").row();
      keyboard.text("← Back", "menu_reminders");

      await userService.setSessionState(ctx.user.id, {
        currentStep: "ADD_REM_PERSON",
        tempData,
      });

      await ctx.reply("Who is this reminder for?", {
        reply_markup: keyboard,
      });
    }
    return;
  }

  // 16. EDIT_REM_TITLE
  if (step === "EDIT_REM_TITLE") {
    const reminderId = String(tempData.reminderId);
    await reminderService.updateReminder(ctx.user.id, reminderId, { title: text });
    await userService.clearSessionState(ctx.user.id);

    await ctx.reply("✅ Reminder updated!", {
      reply_markup: new InlineKeyboard().text("⏰ View Reminder", `view_rem_${reminderId}`),
    });
    return;
  }
});

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
