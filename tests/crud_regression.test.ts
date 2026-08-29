import { describe, it, expect } from "vitest";
import { app } from "../src/api/server.js";
import { authService } from "../src/services/auth.service.js";
import { userService } from "../src/services/user.service.js";

describe("Mandatory Full CRUD Regression Scenario (Section 59)", () => {
  let userId = "";
  let authToken = "";
  let personId = "";
  let noteId = "";
  let reminderId = "";

  it("1. Create Person with Name, Birthday, and Note -> Save -> Refresh -> Verify", async () => {
    const user = await userService.createUser({
      telegramId: `crud_reg_${Date.now()}`,
      name: "Regression Tester",
      timezone: "Europe/Berlin",
    });
    userId = user.id;
    authToken = authService.createSessionToken({ userId: user.id });

    // Create Person with initial note
    const createRes = await app.request("/api/people", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${authToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: "Alice Wonderland",
        birthday: "04-12",
        note: "Met at the tea party",
      }),
    });
    expect(createRes.status).toBe(201);
    const createBody = await createRes.json();
    personId = createBody.person.id;

    // Refresh simulation: Read person details
    const getRes = await app.request(`/api/people/${personId}`, {
      headers: { Authorization: `Bearer ${authToken}` },
    });
    expect(getRes.status).toBe(200);
    const getBody = await getRes.json();
    expect(getBody.person.name).toBe("Alice Wonderland");
    expect(getBody.person.birthday).toBe("04-12");
    expect(getBody.notes.length).toBe(1);
    expect(getBody.notes[0].content).toBe("Met at the tea party");
    noteId = getBody.notes[0].id;
  });

  it("2. Edit Name, Birthday, and Note -> Save -> Refresh -> Verify all changes", async () => {
    // Edit Name & Birthday
    const editPersonRes = await app.request(`/api/people/${personId}`, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${authToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: "Alice Kingsleigh",
        birthday: "04-15",
      }),
    });
    expect(editPersonRes.status).toBe(200);

    // Edit Note
    const editNoteRes = await app.request(`/api/notes/${noteId}`, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${authToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        content: "Captain of the Wonder ship",
      }),
    });
    expect(editNoteRes.status).toBe(200);

    // Refresh simulation: Read and verify all 3 changes persisted in PostgreSQL
    const freshRes = await app.request(`/api/people/${personId}`, {
      headers: { Authorization: `Bearer ${authToken}` },
    });
    expect(freshRes.status).toBe(200);
    const freshBody = await freshRes.json();
    expect(freshBody.person.name).toBe("Alice Kingsleigh");
    expect(freshBody.person.birthday).toBe("04-15");
    expect(freshBody.notes[0].content).toBe("Captain of the Wonder ship");
  });

  it("3. Create Reminder with multiple offsets -> Save -> Refresh -> Verify", async () => {
    // Add custom birthday offsets
    await app.request(`/api/people/${personId}/birthday-reminders/custom`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${authToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ daysBefore: 30 }),
    });

    await app.request(`/api/people/${personId}/birthday-reminders/custom`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${authToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ daysBefore: 1 }),
    });

    // Create standalone reminder
    const remRes = await app.request("/api/reminders", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${authToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        title: "Send tea gift to Alice",
        scheduledAt: new Date(Date.now() + 86400000).toISOString(),
        personId,
      }),
    });
    expect(remRes.status).toBe(201);
    const remBody = await remRes.json();
    reminderId = remBody.reminder.id;

    // Refresh simulation
    const getRemRes = await app.request("/api/reminders", {
      headers: { Authorization: `Bearer ${authToken}` },
    });
    expect(getRemRes.status).toBe(200);
    const getRemBody = await getRemRes.json();
    expect(getRemBody.reminders.some((r: any) => r.id === reminderId)).toBe(true);
  });

  it("4. Delete Reminder -> Delete Person -> Refresh -> Verify both deleted cleanly", async () => {
    // Delete Reminder
    const delRemRes = await app.request(`/api/reminders/${reminderId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${authToken}` },
    });
    expect(delRemRes.status).toBe(200);

    // Delete Person
    const delPersonRes = await app.request(`/api/people/${personId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${authToken}` },
    });
    expect(delPersonRes.status).toBe(200);

    // Refresh simulation: Verify 404
    const checkPersonRes = await app.request(`/api/people/${personId}`, {
      headers: { Authorization: `Bearer ${authToken}` },
    });
    expect(checkPersonRes.status).toBe(404);

    const checkRemListRes = await app.request("/api/reminders", {
      headers: { Authorization: `Bearer ${authToken}` },
    });
    const remList = await checkRemListRes.json();
    expect(remList.reminders.some((r: any) => r.id === reminderId)).toBe(false);
  });
});
