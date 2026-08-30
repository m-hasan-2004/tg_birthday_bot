import { Composer, InlineKeyboard } from "grammy";
import type { BotContext } from "../context.js";
import { userService } from "../../services/user.service.js";
import {
  getProfileKeyboard,
  getProfileEditKeyboard,
  getMonthPickerKeyboard,
  getDayPickerKeyboard,
} from "../keyboards/common.js";
import { formatBirthday } from "../../utils/dates.js";

export const profileHandler = new Composer<BotContext>();

// View Profile Handler (Shared logic for callback and command)
async function renderProfile(ctx: BotContext) {
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

  const freshUser = (await userService.findById(user.id)) || user;
  const birthdayStr = freshUser.birthday ? formatBirthday(freshUser.birthday) : "Not set";
  const infoStr = freshUser.additionalInfo ? freshUser.additionalInfo : "None";
  const timezoneStr = freshUser.timezone || "Asia/Tehran";

  const text =
    `👤 <b>My Profile</b>\n\n` +
    `<b>Name:</b>\n${escapeHtml(freshUser.name)}\n\n` +
    `<b>Birthday:</b>\n${escapeHtml(birthdayStr)}\n\n` +
    `<b>Information:</b>\n${escapeHtml(infoStr)}\n\n` +
    `<b>Timezone:</b>\n${escapeHtml(timezoneStr)}`;

  try {
    await ctx.editMessageText(text, {
      parse_mode: "HTML",
      reply_markup: getProfileKeyboard(),
    });
  } catch {
    await ctx.reply(text, {
      parse_mode: "HTML",
      reply_markup: getProfileKeyboard(),
    });
  }
}

profileHandler.callbackQuery("menu_profile", async (ctx) => {
  await ctx.answerCallbackQuery().catch(() => {});
  await renderProfile(ctx);
});

profileHandler.command("profile", async (ctx) => {
  await renderProfile(ctx);
});

// Edit Profile Menu
profileHandler.callbackQuery("profile_edit_menu", async (ctx) => {
  if (!ctx.user) return;
  await ctx.answerCallbackQuery();

  await ctx.editMessageText("✏️ <b>Edit Profile</b>\n\nWhat would you like to edit?", {
    parse_mode: "HTML",
    reply_markup: getProfileEditKeyboard(),
  });
});

// Edit Name Prompt
profileHandler.callbackQuery("profile_edit_name", async (ctx) => {
  if (!ctx.user) return;
  await ctx.answerCallbackQuery();

  await userService.setSessionState(ctx.user.id, {
    currentStep: "EDIT_PROFILE_NAME",
  });

  const keyboard = new InlineKeyboard().text("← Back", "profile_edit_menu");
  await ctx.editMessageText("👤 <b>Edit Name</b>\n\nPlease enter your new name:", {
    parse_mode: "HTML",
    reply_markup: keyboard,
  });
});

// Edit Birthday Prompt (Month Picker)
profileHandler.callbackQuery("profile_edit_birthday", async (ctx) => {
  if (!ctx.user) return;
  await ctx.answerCallbackQuery();

  await userService.setSessionState(ctx.user.id, {
    currentStep: "EDIT_PROFILE_BIRTHDAY",
  });

  const keyboard = getMonthPickerKeyboard("edit_profile_bday", false);
  // Add clear birthday button
  keyboard.row().text("🗑 Clear Birthday", "profile_clear_bday");
  keyboard.row().text("← Back", "profile_edit_menu");

  await ctx.editMessageText("🎂 <b>Edit Birthday</b>\n\nSelect your birth month:", {
    parse_mode: "HTML",
    reply_markup: keyboard,
  });
});

profileHandler.callbackQuery(/^edit_profile_bday_m_(\d{2})$/, async (ctx) => {
  if (!ctx.user) return;
  const month = ctx.match[1];
  await ctx.answerCallbackQuery();

  await ctx.editMessageText(`🎂 <b>Edit Birthday</b>\n\nSelect day for month ${month}:`, {
    parse_mode: "HTML",
    reply_markup: getDayPickerKeyboard("edit_profile_bday", month),
  });
});

profileHandler.callbackQuery("edit_profile_bday_back_month", async (ctx) => {
  if (!ctx.user) return;
  await ctx.answerCallbackQuery();
  const keyboard = getMonthPickerKeyboard("edit_profile_bday", false);
  keyboard.row().text("🗑 Clear Birthday", "profile_clear_bday");
  keyboard.row().text("← Back", "profile_edit_menu");

  await ctx.editMessageText("🎂 <b>Edit Birthday</b>\n\nSelect your birth month:", {
    parse_mode: "HTML",
    reply_markup: keyboard,
  });
});

profileHandler.callbackQuery(/^edit_profile_bday_d_(\d{2})_(\d{2})$/, async (ctx) => {
  if (!ctx.user) return;
  const month = ctx.match[1];
  const day = ctx.match[2];
  const bdayStr = `${month}-${day}`;
  await ctx.answerCallbackQuery();

  await userService.updateProfile(ctx.user.id, { birthday: bdayStr });
  await userService.clearSessionState(ctx.user.id);

  await ctx.editMessageText(`✅ Birthday updated to <b>${formatBirthday(bdayStr)}</b>!`, {
    parse_mode: "HTML",
    reply_markup: new InlineKeyboard().text("👤 My Profile", "menu_profile"),
  });
});

profileHandler.callbackQuery("profile_clear_bday", async (ctx) => {
  if (!ctx.user) return;
  await ctx.answerCallbackQuery();
  await userService.updateProfile(ctx.user.id, { birthday: null });
  await userService.clearSessionState(ctx.user.id);

  await ctx.editMessageText("✅ Birthday cleared.", {
    reply_markup: new InlineKeyboard().text("👤 My Profile", "menu_profile"),
  });
});

// Edit Additional Info Prompt
profileHandler.callbackQuery("profile_edit_info", async (ctx) => {
  if (!ctx.user) return;
  await ctx.answerCallbackQuery();

  await userService.setSessionState(ctx.user.id, {
    currentStep: "EDIT_PROFILE_INFO",
  });

  const keyboard = new InlineKeyboard()
    .text("🗑 Clear Information", "profile_clear_info")
    .row()
    .text("← Back", "profile_edit_menu");

  await ctx.editMessageText(
    "ℹ️ <b>Edit Information</b>\n\nEnter any personal notes or details about yourself:",
    {
      parse_mode: "HTML",
      reply_markup: keyboard,
    }
  );
});

profileHandler.callbackQuery("profile_clear_info", async (ctx) => {
  if (!ctx.user) return;
  await ctx.answerCallbackQuery();
  await userService.updateProfile(ctx.user.id, { additionalInfo: null });
  await userService.clearSessionState(ctx.user.id);

  await ctx.editMessageText("✅ Additional information cleared.", {
    reply_markup: new InlineKeyboard().text("👤 My Profile", "menu_profile"),
  });
});

// Edit Timezone Prompt
profileHandler.callbackQuery("profile_edit_tz", async (ctx) => {
  if (!ctx.user) return;
  await ctx.answerCallbackQuery();

  await userService.setSessionState(ctx.user.id, {
    currentStep: "EDIT_PROFILE_TZ_CUSTOM",
  });

  const keyboard = new InlineKeyboard()
    .text("Europe/Berlin", "set_tz_Europe/Berlin")
    .text("Europe/London", "set_tz_Europe/London")
    .row()
    .text("Europe/Paris", "set_tz_Europe/Paris")
    .text("America/New_York", "set_tz_America/New_York")
    .row()
    .text("America/Los_Angeles", "set_tz_America/Los_Angeles")
    .text("America/Chicago", "set_tz_America/Chicago")
    .row()
    .text("Asia/Tokyo", "set_tz_Asia/Tokyo")
    .text("Asia/Dubai", "set_tz_Asia/Dubai")
    .row()
    .text("UTC", "set_tz_UTC")
    .row()
    .text("← Back", "profile_edit_menu");

  await ctx.editMessageText(
    "🌍 <b>Edit Timezone</b>\n\nChoose from common timezones or type any standard IANA timezone name (e.g. <code>America/Toronto</code>, <code>Europe/Rome</code>):",
    {
      parse_mode: "HTML",
      reply_markup: keyboard,
    }
  );
});

profileHandler.callbackQuery(/^set_tz_(.+)$/, async (ctx) => {
  if (!ctx.user) return;
  const tz = ctx.match[1];
  await ctx.answerCallbackQuery();

  await userService.updateProfile(ctx.user.id, { timezone: tz });
  await userService.clearSessionState(ctx.user.id);

  await ctx.editMessageText(`✅ Timezone updated to <b>${escapeHtml(tz)}</b>!`, {
    parse_mode: "HTML",
    reply_markup: new InlineKeyboard().text("👤 My Profile", "menu_profile"),
  });
});

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
