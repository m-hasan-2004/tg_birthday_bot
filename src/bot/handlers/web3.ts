import { Composer } from "grammy";
import type { BotContext } from "../context.js";
import { getMainMenuKeyboard } from "../keyboards/common.js";

export const web3Handler = new Composer<BotContext>();

// Legacy callback fallback
web3Handler.callbackQuery(/^web3_/, async (ctx) => {
  if (!ctx.user) return;
  await ctx.answerCallbackQuery();
  await ctx.editMessageText("🎂 <b>Birthday Reminder</b>", {
    parse_mode: "HTML",
    reply_markup: getMainMenuKeyboard(),
  });
});
