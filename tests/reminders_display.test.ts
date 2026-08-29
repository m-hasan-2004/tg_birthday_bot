import { describe, it, expect } from "vitest";
import { app } from "../src/api/server.js";
import { authService } from "../src/services/auth.service.js";
import { userService } from "../src/services/user.service.js";
import { personService } from "../src/services/person.service.js";
import { reminderService } from "../src/services/reminder.service.js";
import { birthdayService } from "../src/services/birthday.service.js";

describe("Reminders Display & Aggregation (Birthday + General Reminders)", () => {
  let userId = "";
  let authToken = "";
  let personId = "";

  it("1. Creates test user, person with birthday, and sets birthday reminders", async () => {
    const user = await userService.createUser({
      telegramId: `disp_user_${Date.now()}`,
      name: "Display Tester",
      timezone: "Europe/Berlin",
    });
    userId = user.id;
    authToken = authService.createSessionToken({ userId: user.id });

    const person = await personService.createPerson(userId, {
      name: "Bob Dylan",
      birthday: "05-24",
      note: "Musician",
    });
    personId = person.id;

    // Set offsets: 30 days before, 1 day before, and on the day
    await birthdayService.addCustomBirthdayReminderOffset(userId, personId, 30);
    await birthdayService.addCustomBirthdayReminderOffset(userId, personId, 1);
    await birthdayService.addCustomBirthdayReminderOffset(userId, personId, 0);
  });

  it("2. Creates a general scheduled reminder", async () => {
    await reminderService.createReminder(userId, {
      title: "Buy concert tickets",
      scheduledAt: new Date(Date.now() + 86400000),
      personId,
    });
  });

  it("3. Verifies reminderService.listUpcomingRemindersByUser returns BOTH general and birthday reminders", async () => {
    const allReminders = await reminderService.listUpcomingRemindersByUser(userId);
    expect(allReminders.length).toBeGreaterThanOrEqual(4);

    const general = allReminders.find((r) => r.title === "Buy concert tickets");
    expect(general).toBeDefined();
    expect(general?.isBirthdayReminder).toBe(false);

    const bdayRem = allReminders.filter((r) => r.isBirthdayReminder);
    expect(bdayRem.length).toBeGreaterThanOrEqual(3);
    expect(bdayRem.some((r) => r.title.includes("Bob Dylan"))).toBe(true);
    expect(bdayRem.some((r) => r.title.includes("1 month before"))).toBe(true);
    expect(bdayRem.some((r) => r.title.includes("1 day before"))).toBe(true);
    expect(bdayRem.some((r) => r.title.includes("On the day"))).toBe(true);
  });

  it("4. Verifies GET /api/reminders returns formatted reminders with dateStr and timeStr", async () => {
    const res = await app.request("/api/reminders", {
      headers: { Authorization: `Bearer ${authToken}` },
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.reminders.length).toBeGreaterThanOrEqual(4);

    for (const rem of body.reminders) {
      expect(rem.dateStr).toBeDefined();
      expect(rem.timeStr).toBeDefined();
      expect(rem.title).toBeDefined();
    }
  });

  it("5. Verifies GET /api/dashboard returns upcoming reminders in dashboard stats", async () => {
    const res = await app.request("/api/dashboard", {
      headers: { Authorization: `Bearer ${authToken}` },
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.stats.remindersCount).toBeGreaterThanOrEqual(4);
    expect(body.upcomingReminders.length).toBeGreaterThanOrEqual(1);
  });
});
