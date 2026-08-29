import { describe, it, expect } from "vitest";
import { app } from "../src/api/server.js";
import { authService } from "../src/services/auth.service.js";
import { userService } from "../src/services/user.service.js";

describe("Deterministic Admin & Owner Identification (Section 31 - 43)", () => {
  it("1. Resolves Telegram ID 5138117035 as OWNER deterministically", async () => {
    let owner = await userService.findByTelegramId("5138117035");
    if (!owner) {
      owner = await userService.createUser({
        telegramId: "5138117035",
        name: "App Owner",
      });
    }

    expect(owner.role).toBe("owner");
    expect(owner.telegramId).toBe("5138117035");

    const found = await userService.findByTelegramId("5138117035");
    expect(found?.role).toBe("owner");
  });

  it("2. Resolves arbitrary Telegram ID as USER", async () => {
    const randomTid = `user_${Date.now()}`;
    const regular = await userService.createUser({
      telegramId: randomTid,
      name: "Regular Citizen",
    });

    expect(regular.role).toBe("user");
  });

  it("3. Owner CANNOT be demoted by another administrator", async () => {
    const owner = await userService.findByTelegramId("5138117035");
    const admin = await userService.createUser({
      telegramId: `admin_${Date.now()}`,
      name: "Sub Admin",
      role: "admin",
    });

    const demoteAttempt = await userService.setUserRole(admin.id, owner!.id, "user");
    expect(demoteAttempt.success).toBe(false);
    expect(demoteAttempt.error).toContain("cannot be demoted");

    // Verify owner still has owner role
    const freshOwner = await userService.findById(owner!.id);
    expect(freshOwner?.role).toBe("owner");
  });

  it("4. Normal user cannot access Admin endpoints (403 Forbidden)", async () => {
    const user = await userService.createUser({
      telegramId: `test_norm_${Date.now()}`,
      name: "Normal Tester",
      role: "user",
    });
    const userToken = authService.createSessionToken({
      userId: user.id,
      role: "user",
    });

    const res = await app.request("/api/admin/stats", {
      headers: { Authorization: `Bearer ${userToken}` },
    });
    expect(res.status).toBe(403);
  });

  it("5. Owner has full access to Admin endpoints", async () => {
    const owner = await userService.findByTelegramId("5138117035");
    const ownerToken = authService.createSessionToken({
      userId: owner!.id,
      role: "owner",
    });

    const res = await app.request("/api/admin/stats", {
      headers: { Authorization: `Bearer ${ownerToken}` },
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.stats).toBeDefined();
    expect(body.stats.totalUsers).toBeGreaterThanOrEqual(1);
  });
});
