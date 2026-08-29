import { Context } from "grammy";
import type { User } from "../types/index.js";

export interface BotContext extends Context {
  user?: User;
}
