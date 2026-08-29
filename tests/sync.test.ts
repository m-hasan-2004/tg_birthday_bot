import { describe, it, expect } from "vitest";
import { app } from "../src/api/server.js";
import { authService } from "../src/services/auth.service.js";
import { userService } from "../src/services/user.service.js";
import { personService } from "../src/services/person.service.js";
import { noteService } from "../src/services/note.service.js";
import { reminderService } from "../src/services/reminder.service.js";

describe("Telegram ↔ Web App Synchronization Tests", () => {
  let userId = "";
  let authToken = "";

  it("Initializes shared user identity", async () => {
    const user = await userService.createUser({
      telegramId: `sync_${Date.now()}`,
      name: "Sam Synchronized",
      birthday: "10-25",
      timezone: "Europe/London",
    });

    userId = user.id;
    authToken = authService.createSessionToken({
      userId: user.id,
      telegramId: user.telegramId,
    });

    expect(userId).toBeDefined();
    expect(authToken).toBeDefined();
  });

  describe("1. Telegram -> Web App Synchronization", () => {
    let createdPersonId = "";

    it("Creates person and note in Telegram domain layer", async () => {
      const person = await personService.createPerson(userId, {
        name: "Diana Prince",
        birthday: "03-22",
        note: "Met at Tech Summit",
      });

      expect(person.id).toBeDefined();
      createdPersonId = person.id;

      await reminderService.createReminder(userId, {
        title: "Send event photos to Diana",
        scheduledAt: new Date(Date.now() + 86400000),
        personId: createdPersonId,
      });
    });

    it("Fetches via Web App REST API and verifies identical data", async () => {
      // 1. Dashboard
      const dashRes = await app.request("/api/dashboard", {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      expect(dashRes.status).toBe(200);
      const dashBody = await dashRes.json();
      expect(dashBody.user.name).toBe("Sam Synchronized");
      expect(dashBody.stats.peopleCount).toBeGreaterThanOrEqual(1);
      expect(dashBody.upcomingBirthdays.some((b: any) => b.name === "Diana Prince")).toBe(true);

      // 2. People endpoint
      const peopleRes = await app.request("/api/people", {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      expect(peopleRes.status).toBe(200);
      const peopleBody = await peopleRes.json();
      const diana = peopleBody.people.find((p: any) => p.name === "Diana Prince");
      expect(diana).toBeDefined();
      expect(diana.birthday).toBe("03-22");

      // 3. Person Detail & Notes
      const detailRes = await app.request(`/api/people/${createdPersonId}`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      expect(detailRes.status).toBe(200);
      const detailBody = await detailRes.json();
      expect(detailBody.notes.length).toBe(1);
      expect(detailBody.notes[0].content).toBe("Met at Tech Summit");

      // 4. Reminders endpoint
      const remRes = await app.request("/api/reminders", {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      expect(remRes.status).toBe(200);
      const remBody = await remRes.json();
      expect(remBody.reminders.some((r: any) => r.title === "Send event photos to Diana")).toBe(true);
    });
  });

  describe("2. Web App -> Telegram Synchronization", () => {
    let apiPersonId = "";

    it("Creates person, note, and reminder via Web App REST API", async () => {
      // Create Person
      const pRes = await app.request("/api/people", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${authToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: "Bruce Wayne",
          birthday: "02-19",
          note: "Wayne Enterprises CEO",
        }),
      });
      expect(pRes.status).toBe(201);
      const pBody = await pRes.json();
      apiPersonId = pBody.person.id;

      // Add second note
      const nRes = await app.request(`/api/people/${apiPersonId}/notes`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${authToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          content: "Prefers communication by encrypted email",
        }),
      });
      expect(nRes.status).toBe(201);

      // Create reminder
      const rRes = await app.request("/api/reminders", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${authToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: "Quarterly charity gala planning",
          scheduledAt: new Date(Date.now() + 172800000).toISOString(),
          personId: apiPersonId,
        }),
      });
      expect(rRes.status).toBe(201);
    });

    it("Reads via Telegram bot service functions and confirms full persistence", async () => {
      // Query people list used by Telegram bot
      const peopleList = await personService.listPeopleByUser(userId);
      const bruce = peopleList.find((p) => p.name === "Bruce Wayne");
      expect(bruce).toBeDefined();
      expect(bruce?.birthday).toBe("02-19");

      // Query notes list used by Telegram bot
      const notesList = await noteService.listNotesByPerson(userId, apiPersonId);
      expect(notesList.length).toBe(2);
      expect(notesList.some((n) => n.content === "Wayne Enterprises CEO")).toBe(true);
      expect(notesList.some((n) => n.content === "Prefers communication by encrypted email")).toBe(true);

      // Query reminders list used by Telegram bot
      const remindersList = await reminderService.listUpcomingRemindersByUser(userId);
      const gala = remindersList.find((r) => r.title === "Quarterly charity gala planning");
      expect(gala).toBeDefined();
      expect(gala?.personName).toBe("Bruce Wayne");
    });
  });
});
