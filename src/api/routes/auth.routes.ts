import { Hono } from "hono";
import { authService } from "../../services/auth.service.js";
import { userService } from "../../services/user.service.js";
import { env } from "../../config/env.js";
import { logger } from "../../utils/logger.js";

type AuthEnv = {
  Variables: {
    userId: string;
  };
};

export const authRoutes = new Hono<AuthEnv>();

// Authenticate Telegram Web App User via initData
authRoutes.post("/telegram", async (c) => {
  try {
    let body: any = {};
    try {
      body = await c.req.json();
    } catch {
      try {
        const text = await c.req.text();
        body = text ? JSON.parse(text) : {};
      } catch {
        body = {};
      }
    }
    const initDataRaw = body.initData;

    if (!initDataRaw) {
      return c.json({ error: "Missing initData" }, 400);
    }

    const validation = authService.validateTelegramInitData(initDataRaw);
    if (!validation.isValid || !validation.user) {
      return c.json({ error: validation.error || "Invalid Telegram credentials" }, 401);
    }

    const tgUser = validation.user;
    let user = await userService.findByTelegramId(tgUser.id);

    if (!user) {
      const fullName = [tgUser.first_name, tgUser.last_name].filter(Boolean).join(" ");
      user = await userService.createUser({
        telegramId: tgUser.id,
        name: fullName || tgUser.username || "Friend",
      });
    }

    if (user.isDisabled) {
      return c.json({ error: "Your account has been disabled by an administrator." }, 403);
    }

    const token = authService.createSessionToken({
      userId: user.id,
      telegramId: String(tgUser.id),
      role: user.role,
    });

    return c.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        birthday: user.birthday,
        additionalInfo: user.additionalInfo,
        timezone: user.timezone,
        role: user.role,
      },
    });
  } catch (error: any) {
    logger.error("Error in /api/auth/telegram", error);
    return c.json({ error: error?.message || "Authentication failed", details: String(error) }, 500);
  }
});

// Browser Dev Login (Restricted exclusively to automated unit tests)
authRoutes.post("/dev-login", async (c) => {
  if (env.NODE_ENV === "production") {
    return c.json({ error: "Unauthorized: Telegram authentication required." }, 401);
  }

  try {
    let body: any = {};
    try {
      body = await c.req.json();
    } catch {
      body = {};
    }

    const telegramId = body.telegramId ? String(body.telegramId) : "dev_test_user";
    const name = body.name || "Test User";
    const role = body.role || "user";

    let user = await userService.findByTelegramId(telegramId);
    if (!user) {
      user = await userService.createUser({
        telegramId,
        name,
        role: role as any,
      });
    }

    if (user.isDisabled) {
      return c.json({ error: "Account is disabled." }, 403);
    }

    const token = authService.createSessionToken({
      userId: user.id,
      telegramId: user.telegramId,
      role: user.role as any,
    });

    return c.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        birthday: user.birthday,
        additionalInfo: user.additionalInfo,
        timezone: user.timezone,
        role: user.role,
      },
    });
  } catch (error: any) {
    logger.error("Error in /api/auth/dev-login:", error);
    return c.json({ error: error?.message || "Dev login failed" }, 500);
  }
});
