import { describe, it, expect } from "vitest";
import { app } from "../src/api/server.js";
import { authService } from "../src/services/auth.service.js";
import { userService } from "../src/services/user.service.js";
import { personService } from "../src/services/person.service.js";
import { reminderService } from "../src/services/reminder.service.js";
import { adminService } from "../src/services/admin.service.js";

describe("Admin Panel, Authorization, Live Metrics & Audit Logs", () => {
  let regularUserId = "";
  let regularToken = "";
  let adminUserId = "";
  let adminToken = "";

  it("1. Sets up regular user and admin user", async () => {
    // Regular User
    const regUser = await userService.createUser({
      telegramId: `reg_${Date.now()}`,
      name: "Normal User",
      role: "user",
    });
    regularUserId = regUser.id;
    regularToken = authService.createSessionToken({
      userId: regUser.id,
      role: "user",
    });

    // Admin User
    const admUser = await userService.createUser({
      telegramId: `adm_${Date.now()}`,
      name: "Admin User",
      role: "admin",
    });
    adminUserId = admUser.id;
    adminToken = authService.createSessionToken({
      userId: admUser.id,
      role: "admin",
    });

    expect(regularUserId).toBeDefined();
    expect(adminUserId).toBeDefined();
  });

  it("2. Security: Regular user receives 403 Forbidden on admin endpoints", async () => {
    const statsRes = await app.request("/api/admin/stats", {
      headers: { Authorization: `Bearer ${regularToken}` },
    });
    expect(statsRes.status).toBe(403);
    const statsBody = await statsRes.json();
    expect(statsBody.error).toContain("Administrator privileges required");

    const usersRes = await app.request("/api/admin/users", {
      headers: { Authorization: `Bearer ${regularToken}` },
    });
    expect(usersRes.status).toBe(403);
  });

  it("3. Unauthenticated request receives 401 Unauthorized", async () => {
    const res = await app.request("/api/admin/stats");
    expect(res.status).toBe(401);
  });

  it("4. Admin user successfully fetches accurate live statistics from PostgreSQL", async () => {
    const initialStats = await adminService.getSystemStats();

    // Create a person and reminder to verify dynamic stat increments
    await personService.createPerson(adminUserId, { name: "Test Contact" });
    await reminderService.createReminder(adminUserId, {
      title: "Test Stat Reminder",
      scheduledAt: new Date(Date.now() + 1000000),
    });

    const res = await app.request("/api/admin/stats", {
      headers: { Authorization: `Bearer ${adminToken}` },
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.stats.totalUsers).toBeGreaterThanOrEqual(2);
    expect(body.stats.totalPeople).toBeGreaterThanOrEqual(initialStats.totalPeople + 1);
    expect(body.stats.totalReminders).toBeGreaterThanOrEqual(initialStats.totalReminders + 1);
  });

  it("5. Admin lists and searches users", async () => {
    const res = await app.request(`/api/admin/users?search=Normal`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.users.length).toBeGreaterThanOrEqual(1);
    expect(body.users.some((u: any) => u.name.includes("Normal"))).toBe(true);
  });

  it("6. Admin disables regular user and verifies access is revoked", async () => {
    const disableRes = await app.request(`/api/admin/users/${regularUserId}/disable`, {
      method: "POST",
      headers: { Authorization: `Bearer ${adminToken}` },
    });

    expect(disableRes.status).toBe(200);
    const disableBody = await disableRes.json();
    expect(disableBody.user.isDisabled).toBe(true);

    // Regular user should now be blocked from /api/dashboard and /api/profile
    const dashRes = await app.request("/api/dashboard", {
      headers: { Authorization: `Bearer ${regularToken}` },
    });
    expect(dashRes.status).toBe(403);
  });

  it("7. Admin re-enables regular user and verifies access is restored", async () => {
    const enableRes = await app.request(`/api/admin/users/${regularUserId}/enable`, {
      method: "POST",
      headers: { Authorization: `Bearer ${adminToken}` },
    });

    expect(enableRes.status).toBe(200);
    const enableBody = await enableRes.json();
    expect(enableBody.user.isDisabled).toBe(false);

    // Regular user can access dashboard again
    const dashRes = await app.request("/api/dashboard", {
      headers: { Authorization: `Bearer ${regularToken}` },
    });
    expect(dashRes.status).toBe(200);
  });

  it("8. Audit logs are persisted and readable by admin", async () => {
    const res = await app.request("/api/admin/audit-logs?limit=10", {
      headers: { Authorization: `Bearer ${adminToken}` },
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.auditLogs.length).toBeGreaterThanOrEqual(2); // USER_DISABLED, USER_ENABLED
  });

  it("9. Broadcast preview returns recipient count safely", async () => {
    const res = await app.request("/api/admin/broadcast", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${adminToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message: "Important maintenance announcement",
        isPreview: true,
      }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.preview).toBe(true);
    expect(body.recipientCount).toBeGreaterThanOrEqual(2);
  });
});
