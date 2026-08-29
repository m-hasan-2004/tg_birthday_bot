import { describe, it, expect } from "vitest";
import { app } from "../src/api/server.js";
import { authService } from "../src/services/auth.service.js";
import { userService } from "../src/services/user.service.js";
import { personService } from "../src/services/person.service.js";
import { birthdayService } from "../src/services/birthday.service.js";
import { getNextBirthday } from "../src/utils/dates.js";

describe("Mandatory Reminder E2E Flow (Section 58)", () => {
  let userId = "";
  let authToken = "";
  let personId = "";

  it("1. Creates test user and person 'John' with birthday September 14", async () => {
    const user = await userService.createUser({
      telegramId: `flow_user_${Date.now()}`,
      name: "Reminder Tester",
      timezone: "Europe/Berlin",
    });
    userId = user.id;
    authToken = authService.createSessionToken({ userId: user.id });

    const person = await personService.createPerson(userId, {
      name: "John",
      birthday: "09-14",
      note: "Colleague at the office",
    });
    personId = person.id;

    expect(person.id).toBeDefined();
    expect(person.name).toBe("John");
    expect(person.birthday).toBe("09-14");
  });

  it("2. Configures birthday reminders with 4 offsets (1 month, 1 week, 1 day, on the day) at 09:00", async () => {
    // 30 days (1 month), 7 days (1 week), 1 day (1 day before), 0 days (on the day)
    const offsets = [30, 7, 1, 0];
    for (const off of offsets) {
      await birthdayService.addCustomBirthdayReminderOffset(userId, personId, off);
    }
    await birthdayService.setPersonBirthdayReminderTime(userId, personId, "09:00");

    // Verify in database
    const dbReminders = await birthdayService.getBirthdayRemindersForPerson(userId, personId);
    expect(dbReminders.length).toBeGreaterThanOrEqual(4);

    const savedOffsets = dbReminders.filter((r) => r.enabled).map((r) => r.daysBefore);
    expect(savedOffsets).toContain(30);
    expect(savedOffsets).toContain(7);
    expect(savedOffsets).toContain(1);
    expect(savedOffsets).toContain(0);
  });

  it("3. Refresh simulation: fetches from API and confirms configuration persists", async () => {
    const res = await app.request(`/api/people/${personId}`, {
      headers: { Authorization: `Bearer ${authToken}` },
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.person.name).toBe("John");
    expect(body.person.birthday).toBe("09-14");

    const enabled = body.birthdayReminders.filter((r: any) => r.enabled).map((r: any) => r.daysBefore);
    expect(enabled).toContain(30);
    expect(enabled).toContain(7);
    expect(enabled).toContain(1);
    expect(enabled).toContain(0);
  });

  it("4. Edits John's birthday from 09-14 to 09-21 and verifies reminder calculations change dynamically", async () => {
    // Check initial next birthday
    const initialNext = getNextBirthday("09-14", "Europe/Berlin");
    expect(initialNext).not.toBeNull();
    expect(initialNext?.nextBirthday.month).toBe(9);
    expect(initialNext?.nextBirthday.day).toBe(14);

    // Update birthday to 09-21
    const updateRes = await app.request(`/api/people/${personId}`, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${authToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: "John",
        birthday: "09-21",
      }),
    });
    expect(updateRes.status).toBe(200);
    const updateBody = await updateRes.json();
    expect(updateBody.person.birthday).toBe("09-21");

    // Verify updated dynamic calculation
    const updatedNext = getNextBirthday("09-21", "Europe/Berlin");
    expect(updatedNext).not.toBeNull();
    expect(updatedNext?.nextBirthday.month).toBe(9);
    expect(updatedNext?.nextBirthday.day).toBe(21);
  });

  it("5. Removes 1-week (7 days) reminder offset, refreshes, and verifies only remaining offsets exist", async () => {
    // Toggle 7 days off
    await birthdayService.toggleBirthdayReminderOffset(userId, personId, 7);

    // Re-fetch from API
    const res = await app.request(`/api/people/${personId}`, {
      headers: { Authorization: `Bearer ${authToken}` },
    });
    expect(res.status).toBe(200);
    const body = await res.json();

    const sevenDay = body.birthdayReminders.find((r: any) => r.daysBefore === 7);
    expect(sevenDay?.enabled).toBe(false);

    const activeOffsets = body.birthdayReminders.filter((r: any) => r.enabled).map((r: any) => r.daysBefore);
    expect(activeOffsets).toContain(30);
    expect(activeOffsets).toContain(1);
    expect(activeOffsets).toContain(0);
    expect(activeOffsets).not.toContain(7);
  });
});
