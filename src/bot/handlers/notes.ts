import { Composer, InlineKeyboard } from "grammy";
import type { BotContext } from "../context.js";
import { noteService } from "../../services/note.service.js";
import { personService } from "../../services/person.service.js";
import { userService } from "../../services/user.service.js";

export const notesHandler = new Composer<BotContext>();

// 1. List notes for a person
notesHandler.callbackQuery(/^person_notes_(.+)$/, async (ctx) => {
  if (!ctx.user) return;
  const personId = ctx.match[1];
  await ctx.answerCallbackQuery();
  await userService.clearSessionState(ctx.user.id);

  const person = await personService.getPersonById(ctx.user.id, personId);
  if (!person) return;

  const notesList = await noteService.listNotesByPerson(ctx.user.id, personId);

  let text = `📝 <b>${escapeHtml(person.name)} — Notes</b>\n\n`;

  const keyboard = new InlineKeyboard();

  if (notesList.length === 0) {
    text += `No notes added yet.`;
  } else {
    for (let i = 0; i < notesList.length; i++) {
      const n = notesList[i];
      const preview = n.content.length > 30 ? n.content.slice(0, 30) + "..." : n.content;
      text += `• ${escapeHtml(n.content)}\n\n`;
      keyboard.text(`📝 ${preview}`, `view_note_${n.id}`).row();
    }
  }

  keyboard.text("➕ Add Note", `person_add_note_${personId}`).row();
  keyboard.text("← Back", `view_person_${personId}`);

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

// 2. Add Note Prompt
notesHandler.callbackQuery(/^person_add_note_(.+)$/, async (ctx) => {
  if (!ctx.user) return;
  const personId = ctx.match[1];
  await ctx.answerCallbackQuery();

  const person = await personService.getPersonById(ctx.user.id, personId);
  if (!person) return;

  await userService.setSessionState(ctx.user.id, {
    currentStep: "ADD_NOTE_TEXT",
    tempData: { personId },
  });

  const keyboard = new InlineKeyboard().text("← Back", `person_notes_${personId}`);
  await ctx.editMessageText(`Write your note for <b>${escapeHtml(person.name)}</b>:`, {
    parse_mode: "HTML",
    reply_markup: keyboard,
  });
});

// 3. View Note Details
notesHandler.callbackQuery(/^view_note_(.+)$/, async (ctx) => {
  if (!ctx.user) return;
  const noteId = ctx.match[1];
  await ctx.answerCallbackQuery();
  await userService.clearSessionState(ctx.user.id);

  const note = await noteService.getNoteById(ctx.user.id, noteId);
  if (!note) return;

  const text = `📝 <b>Note</b>\n\n${escapeHtml(note.content)}`;
  const keyboard = new InlineKeyboard()
    .text("✏️ Edit", `note_edit_${note.id}`)
    .text("🗑 Delete", `note_del_${note.id}`)
    .row()
    .text("← Back", `person_notes_${note.personId}`);

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

// 4. Edit Note Prompt
notesHandler.callbackQuery(/^note_edit_(.+)$/, async (ctx) => {
  if (!ctx.user) return;
  const noteId = ctx.match[1];
  await ctx.answerCallbackQuery();

  const note = await noteService.getNoteById(ctx.user.id, noteId);
  if (!note) return;

  await userService.setSessionState(ctx.user.id, {
    currentStep: "EDIT_NOTE_TEXT",
    tempData: { noteId, personId: note.personId },
  });

  const keyboard = new InlineKeyboard().text("← Back", `view_note_${noteId}`);
  await ctx.editMessageText(`Enter updated note text:\n\n<i>Current: ${escapeHtml(note.content)}</i>`, {
    parse_mode: "HTML",
    reply_markup: keyboard,
  });
});

// 5. Delete Note Confirmation
notesHandler.callbackQuery(/^note_del_(.+)$/, async (ctx) => {
  if (!ctx.user) return;
  const noteId = ctx.match[1];
  await ctx.answerCallbackQuery();

  const note = await noteService.getNoteById(ctx.user.id, noteId);
  if (!note) return;

  const keyboard = new InlineKeyboard()
    .text("🗑 Yes, Delete", `note_confirm_del_${note.id}`)
    .text("Cancel", `view_note_${note.id}`);

  await ctx.editMessageText("Are you sure you want to delete this note?", {
    reply_markup: keyboard,
  });
});

notesHandler.callbackQuery(/^note_confirm_del_(.+)$/, async (ctx) => {
  if (!ctx.user) return;
  const noteId = ctx.match[1];
  await ctx.answerCallbackQuery();

  const note = await noteService.getNoteById(ctx.user.id, noteId);
  const personId = note?.personId;

  await noteService.deleteNote(ctx.user.id, noteId);

  if (personId) {
    await ctx.editMessageText("✅ Note deleted.", {
      reply_markup: new InlineKeyboard().text("📝 Back to Notes", `person_notes_${personId}`),
    });
  } else {
    await ctx.editMessageText("✅ Note deleted.", {
      reply_markup: new InlineKeyboard().text("👥 People", "menu_people"),
    });
  }
});

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
