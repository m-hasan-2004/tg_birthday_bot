import { describe, it, expect } from "vitest";
import { app } from "../src/api/server.js";

describe("E2E Integration: Zero to 100 Application Flow", () => {
  let authToken = "";
  let userId = "";
  let personId = "";
  let noteId = "";
  let reminderId = "";

  it("1. POST /api/auth/dev-login logs in and returns valid JWT session token", async () => {
    const res = await app.request("/api/auth/dev-login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        telegramId: `e2e_user_${Date.now()}`,
        name: "E2E Explorer",
      }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.token).toBeDefined();
    expect(body.user.name).toBe("E2E Explorer");

    authToken = body.token;
    userId = body.user.id;
  });

  it("2. GET /api/dashboard returns clean initial state", async () => {
    const res = await app.request("/api/dashboard", {
      headers: { Authorization: `Bearer ${authToken}` },
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.user.name).toBe("E2E Explorer");
    expect(body.stats.peopleCount).toBe(0);
    expect(body.stats.remindersCount).toBe(0);
  });

  it("3. PUT /api/profile updates user timezone and birthday", async () => {
    const res = await app.request("/api/profile", {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${authToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        birthday: "11-20",
        timezone: "Asia/Tokyo",
      }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.user.birthday).toBe("11-20");
    expect(body.user.timezone).toBe("Asia/Tokyo");
  });

  it("4. POST /api/people adds a new contact with birthday and note", async () => {
    const res = await app.request("/api/people", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${authToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: "Samantha Wright",
        birthday: "12-25",
        note: "Favorite color: Emerald green",
      }),
    });

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.person.id).toBeDefined();
    expect(body.person.name).toBe("Samantha Wright");
    personId = body.person.id;
  });

  it("5. POST /api/people/:id/notes adds an additional note", async () => {
    const res = await app.request(`/api/people/${personId}/notes`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${authToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        content: "Drinks matcha latte with oat milk",
      }),
    });

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.note.id).toBeDefined();
    noteId = body.note.id;
  });

  it("6. POST /api/people/:id/birthday-reminders/custom configures custom reminder offset", async () => {
    const res = await app.request(`/api/people/${personId}/birthday-reminders/custom`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${authToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ daysBefore: 10 }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.birthdayReminder.daysBefore).toBe(10);
  });

  it("7. POST /api/reminders creates a recurring weekly reminder for Samantha", async () => {
    const nextWeek = new Date(Date.now() + 7 * 86400000);
    const res = await app.request("/api/reminders", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${authToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        title: "Send project status report",
        scheduledAt: nextWeek.toISOString(),
        personId,
        repeatType: "weekly",
      }),
    });

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.reminder.id).toBeDefined();
    reminderId = body.reminder.id;
  });

  it("8. GET /api/dashboard reflects updated contacts, birthdays, and reminders", async () => {
    const res = await app.request("/api/dashboard", {
      headers: { Authorization: `Bearer ${authToken}` },
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.stats.peopleCount).toBe(1);
    expect(body.stats.remindersCount).toBeGreaterThanOrEqual(1);
    expect(body.upcomingBirthdays.length).toBe(1);
    expect(body.upcomingBirthdays[0].name).toBe("Samantha Wright");
    expect(body.upcomingReminders.length).toBeGreaterThanOrEqual(1);
  });

  it("9. POST /api/reminders/:id/complete advances recurring weekly reminder", async () => {
    const res = await app.request(`/api/reminders/${reminderId}/complete`, {
      method: "POST",
      headers: { Authorization: `Bearer ${authToken}` },
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.reminder.status).toBe("pending");
    expect(body.nextOccurrence).not.toBeNull();
  });

  it("10. DELETE /api/people/:id deletes person with cascading clean up", async () => {
    const res = await app.request(`/api/people/${personId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${authToken}` },
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);

    // Verify 404
    const getRes = await app.request(`/api/people/${personId}`, {
      headers: { Authorization: `Bearer ${authToken}` },
    });
    expect(getRes.status).toBe(404);
  });
});
