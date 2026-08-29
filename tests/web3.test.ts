import { describe, it, expect } from "vitest";
import crypto from "crypto";
import { AuthService } from "../src/services/auth.service.js";

describe("Telegram WebApp HMAC Validation & Authentication Security", () => {
  const mockBotToken = "123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11";
  const authService = new AuthService();

  it("validates genuine Telegram initData HMAC string", () => {
    const user = { id: 987654321, first_name: "Alex", username: "alex_tg" };
    const authDate = Math.floor(Date.now() / 1000);
    const userString = JSON.stringify(user);

    const params = new Map<string, string>();
    params.set("auth_date", String(authDate));
    params.set("query_id", "AAG_TEST_QUERY");
    params.set("user", userString);

    const keys = Array.from(params.keys()).sort();
    const dataCheckString = keys.map((k) => `${k}=${params.get(k)}`).join("\n");

    const secretKey = crypto.createHmac("sha256", "WebAppData").update(mockBotToken).digest();
    const hash = crypto.createHmac("sha256", secretKey).update(dataCheckString).digest("hex");

    const rawInitData = `auth_date=${authDate}&query_id=AAG_TEST_QUERY&user=${encodeURIComponent(
      userString
    )}&hash=${hash}`;

    const res = authService.validateTelegramInitData(rawInitData, mockBotToken);

    expect(res.isValid).toBe(true);
    expect(res.user?.id).toBe(987654321);
    expect(res.user?.first_name).toBe("Alex");
  });

  it("rejects tampered Telegram initData", () => {
    const rawInitData = "auth_date=1600000000&query_id=TAMPERED&user={}&hash=deadbeef";
    const res = authService.validateTelegramInitData(rawInitData, mockBotToken);
    expect(res.isValid).toBe(false);
  });

  it("creates and verifies signed JWT session tokens", () => {
    const payload = { userId: "user-1", telegramId: "123", role: "user" as const };
    const token = authService.createSessionToken(payload);

    expect(typeof token).toBe("string");

    const decoded = authService.verifySessionToken(token);
    expect(decoded?.userId).toBe("user-1");
    expect(decoded?.telegramId).toBe("123");
    expect(decoded?.role).toBe("user");
  });
});
