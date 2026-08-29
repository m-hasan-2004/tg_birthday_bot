import { Composer, InlineKeyboard } from "grammy";
import type { BotContext } from "../context.js";
import { personService } from "../../services/person.service.js";
import { userService } from "../../services/user.service.js";
import {
  getPeopleListKeyboard,
  getPersonDetailsKeyboard,
  getMonthPickerKeyboard,
  getDayPickerKeyboard,
  getBackToMenuKeyboard,
} from "../keyboards/common.js";
import { formatBirthday } from "../../utils/dates.js";

export const peopleHandler = new Composer<BotContext>();

// 1. People List
peopleHandler.callbackQuery("menu_people", async (ctx) => {
  if (!ctx.user) return;
  await ctx.answerCallbackQuery();
  await userService.clearSessionState(ctx.user.id);

  const peopleList = await personService.listPeopleByUser(ctx.user.id);

  if (peopleList.length === 0) {
    const emptyText =
      `👥 <b>No people yet.</b>\n\n` +
      `Add someone to start remembering their birthdays and important notes.`;

    const emptyKeyboard = new InlineKeyboard()
      .text("➕ Add Person", "menu_add_person")
      .row()
      .text("← Back", "open_menu");

    try {
      await ctx.editMessageText(emptyText, {
        parse_mode: "HTML",
        reply_markup: emptyKeyboard,
      });
    } catch {
      await ctx.reply(emptyText, {
        parse_mode: "HTML",
        reply_markup: emptyKeyboard,
      });
    }
    return;
  }

  const text = `👥 <b>People</b>\n\nSelect a person to view details:`;
  const keyboard = getPeopleListKeyboard(peopleList);

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

// 2. View Person Details
peopleHandler.callbackQuery(/^view_person_(.+)$/, async (ctx) => {
  if (!ctx.user) return;
  const personId = ctx.match[1];
  await ctx.answerCallbackQuery();
  await userService.clearSessionState(ctx.user.id);

  const person = await personService.getPersonById(ctx.user.id, personId);
  if (!person) {
    await ctx.reply("Person not found.", {
      reply_markup: new InlineKeyboard().text("← Back", "menu_people"),
    });
    return;
  }

  const birthdayStr = person.birthday ? formatBirthday(person.birthday) : "Not set";
  const noteSnippet = person.firstNote ? person.firstNote : "No notes yet";

  let text = `👤 <b>${escapeHtml(person.name)}</b>\n\n`;
  if (person.birthday) {
    text += `🎂 <b>Birthday:</b>\n${escapeHtml(birthdayStr)}\n\n`;
  }
  text += `📝 <b>Note:</b>\n${escapeHtml(noteSnippet)}\n\n`;
  text += `⏰ <b>Reminders:</b>\n${person.remindersCount}`;

  const keyboard = getPersonDetailsKeyboard(person);

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

// 3. Add Person Flow - Step 1: Ask Name
peopleHandler.callbackQuery("menu_add_person", async (ctx) => {
  if (!ctx.user) return;
  await ctx.answerCallbackQuery();

  await userService.setSessionState(ctx.user.id, {
    currentStep: "ADD_PERSON_NAME",
    tempData: {},
  });

  const keyboard = new InlineKeyboard().text("← Back", "menu_people");
  const text = "➕ <b>Add Person</b>\n\nWhat's their name?";

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

// Add Person - Step 2: Birthday Month Picker
peopleHandler.callbackQuery(/^add_person_bday_m_(\d{2})$/, async (ctx) => {
  if (!ctx.user) return;
  const month = ctx.match[1];
  await ctx.answerCallbackQuery();

  await ctx.editMessageText(`When is their birthday?\n\nSelect day for month ${month}:`, {
    reply_markup: getDayPickerKeyboard("add_person_bday", month),
  });
});

peopleHandler.callbackQuery("add_person_bday_back_month", async (ctx) => {
  if (!ctx.user) return;
  await ctx.answerCallbackQuery();

  await ctx.editMessageText("When is their birthday?", {
    reply_markup: getMonthPickerKeyboard("add_person_bday", true),
  });
});

// Add Person - Step 2: Day selected
peopleHandler.callbackQuery(/^add_person_bday_d_(\d{2})_(\d{2})$/, async (ctx) => {
  if (!ctx.user) return;
  const month = ctx.match[1];
  const day = ctx.match[2];
  const birthdayStr = `${month}-${day}`;
  await ctx.answerCallbackQuery();

  const state = await userService.getSessionState(ctx.user.id);
  const tempData = state?.tempData || {};
  tempData.birthday = birthdayStr;

  await userService.setSessionState(ctx.user.id, {
    currentStep: "ADD_PERSON_NOTE_PROMPT",
    tempData,
  });

  const keyboard = new InlineKeyboard()
    .text("Add note", "add_person_note_add")
    .row()
    .text("Skip", "add_person_note_skip");

  await ctx.editMessageText(
    `Birthday set to <b>${formatBirthday(birthdayStr)}</b>.\n\nWould you like to add a note?`,
    {
      parse_mode: "HTML",
      reply_markup: keyboard,
    }
  );
});

// Add Person - Step 2: Birthday Skipped
peopleHandler.callbackQuery("add_person_bday_skip", async (ctx) => {
  if (!ctx.user) return;
  await ctx.answerCallbackQuery();

  const state = await userService.getSessionState(ctx.user.id);
  const tempData = state?.tempData || {};
  tempData.birthday = null;

  await userService.setSessionState(ctx.user.id, {
    currentStep: "ADD_PERSON_NOTE_PROMPT",
    tempData,
  });

  const keyboard = new InlineKeyboard()
    .text("Add note", "add_person_note_add")
    .row()
    .text("Skip", "add_person_note_skip");

  await ctx.editMessageText("Would you like to add a note?", {
    reply_markup: keyboard,
  });
});

// Add Person - Step 3: Add note button clicked
peopleHandler.callbackQuery("add_person_note_add", async (ctx) => {
  if (!ctx.user) return;
  await ctx.answerCallbackQuery();

  await userService.setSessionState(ctx.user.id, {
    currentStep: "ADD_PERSON_NOTE_TEXT",
    tempData: (await userService.getSessionState(ctx.user.id))?.tempData || {},
  });

  const keyboard = new InlineKeyboard().text("Skip", "add_person_note_skip");
  await ctx.editMessageText("Write your note:", {
    reply_markup: keyboard,
  });
});

// Add Person - Step 3: Skip note & finalize person creation
peopleHandler.callbackQuery("add_person_note_skip", async (ctx) => {
  if (!ctx.user) return;
  await ctx.answerCallbackQuery();

  const state = await userService.getSessionState(ctx.user.id);
  const tempData = state?.tempData || {};
  const name = String(tempData.name || "Friend");
  const birthday = (tempData.birthday as string) || null;

  const createdPerson = await personService.createPerson(ctx.user.id, {
    name,
    birthday,
    note: null,
  });

  await userService.clearSessionState(ctx.user.id);

  await ctx.editMessageText(`✅ <b>${escapeHtml(createdPerson.name)}</b> added.`, {
    parse_mode: "HTML",
    reply_markup: new InlineKeyboard()
      .text(`👤 View ${createdPerson.name}`, `view_person_${createdPerson.id}`)
      .row()
      .text("👥 People", "menu_people"),
  });
});

// 4. Edit Person Menu
peopleHandler.callbackQuery(/^person_edit_(.+)$/, async (ctx) => {
  if (!ctx.user) return;
  const personId = ctx.match[1];
  await ctx.answerCallbackQuery();

  const person = await personService.getPersonById(ctx.user.id, personId);
  if (!person) return;

  const keyboard = new InlineKeyboard()
    .text("👤 Change Name", `person_edit_name_${personId}`)
    .text("🎂 Change Birthday", `person_edit_bday_${personId}`)
    .row()
    .text("← Back", `view_person_${personId}`);

  await ctx.editMessageText(
    `✏️ <b>Edit ${escapeHtml(person.name)}</b>\n\nWhat would you like to update?`,
    {
      parse_mode: "HTML",
      reply_markup: keyboard,
    }
  );
});

peopleHandler.callbackQuery(/^person_edit_name_(.+)$/, async (ctx) => {
  if (!ctx.user) return;
  const personId = ctx.match[1];
  await ctx.answerCallbackQuery();

  await userService.setSessionState(ctx.user.id, {
    currentStep: "EDIT_PERSON_NAME",
    tempData: { personId },
  });

  await ctx.editMessageText("Enter the new name:", {
    reply_markup: new InlineKeyboard().text("← Back", `person_edit_${personId}`),
  });
});

peopleHandler.callbackQuery(/^person_edit_bday_(.+)$/, async (ctx) => {
  if (!ctx.user) return;
  const personId = ctx.match[1];
  await ctx.answerCallbackQuery();

  const keyboard = getMonthPickerKeyboard(`edit_p_bday_${personId}`, false);
  keyboard.row().text("🗑 Remove Birthday", `edit_p_clear_bday_${personId}`);
  keyboard.row().text("← Back", `person_edit_${personId}`);

  await ctx.editMessageText("Select birth month:", {
    reply_markup: keyboard,
  });
});

peopleHandler.callbackQuery(/^edit_p_bday_(.+)_m_(\d{2})$/, async (ctx) => {
  if (!ctx.user) return;
  const personId = ctx.match[1];
  const month = ctx.match[2];
  await ctx.answerCallbackQuery();

  await ctx.editMessageText(`Select day for month ${month}:`, {
    reply_markup: getDayPickerKeyboard(`edit_p_bday_${personId}`, month),
  });
});

peopleHandler.callbackQuery(/^edit_p_bday_(.+)_back_month$/, async (ctx) => {
  if (!ctx.user) return;
  const personId = ctx.match[1];
  await ctx.answerCallbackQuery();

  const keyboard = getMonthPickerKeyboard(`edit_p_bday_${personId}`, false);
  keyboard.row().text("🗑 Remove Birthday", `edit_p_clear_bday_${personId}`);
  keyboard.row().text("← Back", `person_edit_${personId}`);

  await ctx.editMessageText("Select birth month:", {
    reply_markup: keyboard,
  });
});

peopleHandler.callbackQuery(/^edit_p_bday_(.+)_d_(\d{2})_(\d{2})$/, async (ctx) => {
  if (!ctx.user) return;
  const personId = ctx.match[1];
  const month = ctx.match[2];
  const day = ctx.match[3];
  const bdayStr = `${month}-${day}`;
  await ctx.answerCallbackQuery();

  await personService.updatePerson(ctx.user.id, personId, { birthday: bdayStr });

  await ctx.editMessageText(`✅ Birthday updated to <b>${formatBirthday(bdayStr)}</b>!`, {
    parse_mode: "HTML",
    reply_markup: new InlineKeyboard().text("👤 Open Person", `view_person_${personId}`),
  });
});

peopleHandler.callbackQuery(/^edit_p_clear_bday_(.+)$/, async (ctx) => {
  if (!ctx.user) return;
  const personId = ctx.match[1];
  await ctx.answerCallbackQuery();

  await personService.updatePerson(ctx.user.id, personId, { birthday: null });

  await ctx.editMessageText("✅ Birthday removed.", {
    reply_markup: new InlineKeyboard().text("👤 Open Person", `view_person_${personId}`),
  });
});

// 5. Delete Person Confirmation
peopleHandler.callbackQuery(/^person_delete_(.+)$/, async (ctx) => {
  if (!ctx.user) return;
  const personId = ctx.match[1];
  await ctx.answerCallbackQuery();

  const person = await personService.getPersonById(ctx.user.id, personId);
  if (!person) return;

  const keyboard = new InlineKeyboard()
    .text("🗑 Yes, Delete", `person_confirm_del_${personId}`)
    .text("Cancel", `view_person_${personId}`);

  await ctx.editMessageText(
    `Are you sure you want to delete <b>${escapeHtml(person.name)}</b>? This will also remove all their notes and reminders.`,
    {
      parse_mode: "HTML",
      reply_markup: keyboard,
    }
  );
});

peopleHandler.callbackQuery(/^person_confirm_del_(.+)$/, async (ctx) => {
  if (!ctx.user) return;
  const personId = ctx.match[1];
  await ctx.answerCallbackQuery();

  await personService.deletePerson(ctx.user.id, personId);

  await ctx.editMessageText("✅ Person deleted.", {
    reply_markup: new InlineKeyboard().text("👥 People", "menu_people"),
  });
});

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
