import crypto from "crypto";
import jwt from "jsonwebtoken";
import { env } from "../config/env.js";
import type { AuthSessionPayload } from "../types/index.js";
import { logger } from "../utils/logger.js";

export interface TelegramUserData {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
}

export class AuthService {
  /**
   * Validates Telegram Web App initialization data using HMAC-SHA256 according to Telegram specifications.
   */
  validateTelegramInitData(
    initDataRaw: string,
    botToken: string = env.TELEGRAM_BOT_TOKEN
  ): { isValid: boolean; user?: TelegramUserData; error?: string } {
    if (!initDataRaw || typeof initDataRaw !== "string") {
      return { isValid: false, error: "Missing initData." };
    }

    try {
      const urlParams = new URLSearchParams(initDataRaw);
      const hash = urlParams.get("hash");

      if (!hash) {
        return { isValid: false, error: "Missing hash parameter in initData." };
      }

      urlParams.delete("hash");

      // Sort keys alphabetically
      const keys = Array.from(urlParams.keys()).sort();
      const dataCheckString = keys.map((key) => `${key}=${urlParams.get(key)}`).join("\n");

      // Secret key = HMAC_SHA256("WebAppData", botToken)
      const secretKey = crypto.createHmac("sha256", "WebAppData").update(botToken).digest();

      // Calculated hash = HMAC_SHA256(secretKey, dataCheckString)
      const calculatedHash = crypto.createHmac("sha256", secretKey).update(dataCheckString).digest("hex");

      const hashBuffer = Buffer.from(hash, "hex");
      const calculatedBuffer = Buffer.from(calculatedHash, "hex");

      if (hashBuffer.length !== calculatedBuffer.length || !crypto.timingSafeEqual(hashBuffer, calculatedBuffer)) {
        logger.warn("Telegram WebApp initData HMAC verification failed");
        return { isValid: false, error: "Invalid HMAC signature." };
      }

      // Check auth_date expiration (optional check: reject if older than 24 hours)
      const authDate = parseInt(urlParams.get("auth_date") || "0", 10);
      const nowSec = Math.floor(Date.now() / 1000);
      if (authDate && nowSec - authDate > 86400) {
        logger.warn("Telegram WebApp initData is older than 24 hours");
        return { isValid: false, error: "initData has expired." };
      }

      // Parse user JSON
      const userJson = urlParams.get("user");
      let user: TelegramUserData | undefined;
      if (userJson) {
        user = JSON.parse(userJson);
      }

      return { isValid: true, user };
    } catch (err: any) {
      logger.error("Error validating Telegram initData:", err);
      return { isValid: false, error: err.message || "Failed to parse initData." };
    }
  }

  /**
   * Generates a signed JWT session token.
   */
  createSessionToken(payload: AuthSessionPayload, expiresIn: string = "7d"): string {
    return jwt.sign(payload, env.SESSION_SECRET, { expiresIn } as any);
  }

  /**
   * Verifies and decodes a JWT session token.
   */
  verifySessionToken(token: string): AuthSessionPayload | null {
    try {
      const decoded = jwt.verify(token, env.SESSION_SECRET) as AuthSessionPayload;
      return decoded;
    } catch {
      return null;
    }
  }
}

export const authService = new AuthService();
