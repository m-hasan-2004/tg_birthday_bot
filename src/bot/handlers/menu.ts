import { Composer } from "grammy";
import type { BotContext } from "../context.js";
import { userService } from "../../services/user.service.js";
import { getMainMenuKeyboard } from "../keyboards/common.js";

export const menuHandler = new Composer<BotContext>();

menuHandler.callbackQuery("open_menu", async (ctx) => {
  if (!ctx.user) return;
  await ctx.answerCallbackQuery();
  await userService.clearSessionState(ctx.user.id);

  const text = `🎂 <b>Birthday Reminder</b>\n\nWhat would you like to do?`;
  try {
    await ctx.editMessageText(text, {
      parse_mode: "HTML",
      reply_markup: getMainMenuKeyboard(),
    });
  } catch {
    await ctx.reply(text, {
      parse_mode: "HTML",
      reply_markup: getMainMenuKeyboard(),
    });
  }
});
