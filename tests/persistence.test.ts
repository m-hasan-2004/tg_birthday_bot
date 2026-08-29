import { describe, it, expect } from "vitest";
import { userService } from "../src/services/user.service.js";
import { personService } from "../src/services/person.service.js";
import { noteService } from "../src/services/note.service.js";
import { reminderService } from "../src/services/reminder.service.js";
import { birthdayService } from "../src/services/birthday.service.js";
import { adminService } from "../src/services/admin.service.js";

describe("Database Persistence Matrix: CREATE -> READ -> UPDATE -> READ -> DELETE -> READ", () => {
  const testTgId = `persist_${Date.now()}`;
  let userId = "";
  let personId = "";
  let noteId = "";
  let reminderId = "";

  // 1. User & Profile Persistence
  describe("1. User & Profile Entity", () => {
    it("CREATE: creates user and persists to database", async () => {
      const user = await userService.createUser({
        telegramId: testTgId,
        name: "Initial Name",
        birthday: "01-15",
        timezone: "America/New_York",
      });

      expect(user.id).toBeDefined();
      expect(user.name).toBe("Initial Name");
      expect(user.timezone).toBe("America/New_York");
      userId = user.id;
    });

    it("READ: re-reads user from database by ID and telegram ID", async () => {
      const userById = await userService.findById(userId);
      const userByTg = await userService.findByTelegramId(testTgId);

      expect(userById).not.toBeNull();
      expect(userById?.id).toBe(userId);
      expect(userById?.name).toBe("Initial Name");
      expect(userByTg?.id).toBe(userId);
    });

    it("UPDATE: modifies name, birthday, and timezone and verifies persistence", async () => {
      const updated = await userService.updateProfile(userId, {
        name: "Updated Name",
        birthday: "02-20",
        timezone: "Europe/London",
        additionalInfo: "Personal bio note",
      });

      expect(updated?.name).toBe("Updated Name");
      expect(updated?.birthday).toBe("02-20");
      expect(updated?.timezone).toBe("Europe/London");

      // RE-READ
      const fresh = await userService.findById(userId);
      expect(fresh?.name).toBe("Updated Name");
      expect(fresh?.birthday).toBe("02-20");
      expect(fresh?.timezone).toBe("Europe/London");
      expect(fresh?.additionalInfo).toBe("Personal bio note");
    });
  });

  // 2. Person (Contact) Persistence
  describe("2. Person Entity", () => {
    it("CREATE: creates person associated with user", async () => {
      const person = await personService.createPerson(userId, {
        name: "Contact One",
        birthday: "07-04",
        note: "First contact note",
      });

      expect(person.id).toBeDefined();
      expect(person.name).toBe("Contact One");
      expect(person.birthday).toBe("07-04");
      personId = person.id;
    });

    it("READ: retrieves person and lists by user", async () => {
      const p = await personService.getPersonById(userId, personId);
      expect(p).not.toBeNull();
      expect(p?.name).toBe("Contact One");
      expect(p?.birthday).toBe("07-04");

      const list = await personService.listPeopleByUser(userId);
      expect(list.some((item) => item.id === personId)).toBe(true);
    });

    it("UPDATE: updates person name and birthday", async () => {
      const updated = await personService.updatePerson(userId, personId, {
        name: "Contact One Renamed",
        birthday: "07-05",
      });

      expect(updated?.name).toBe("Contact One Renamed");
      expect(updated?.birthday).toBe("07-05");

      // RE-READ
      const fresh = await personService.getPersonById(userId, personId);
      expect(fresh?.name).toBe("Contact One Renamed");
      expect(fresh?.birthday).toBe("07-05");
    });
  });

  // 3. Notes Entity Persistence
  describe("3. Note Entity", () => {
    it("CREATE: creates additional note on person", async () => {
      const note = await noteService.addNote(userId, personId, "Loves dark chocolate");
      expect(note.id).toBeDefined();
      expect(note.content).toBe("Loves dark chocolate");
      noteId = note.id;
    });

    it("READ: lists notes for person", async () => {
      const notes = await noteService.listNotesByPerson(userId, personId);
      expect(notes.length).toBeGreaterThanOrEqual(2); // initial note + new note
      expect(notes.some((n) => n.id === noteId)).toBe(true);
    });

    it("UPDATE: modifies note content", async () => {
      const updated = await noteService.updateNote(userId, noteId, "Prefers 85% dark chocolate");
      expect(updated?.content).toBe("Prefers 85% dark chocolate");

      // RE-READ
      const notes = await noteService.listNotesByPerson(userId, personId);
      const targetNote = notes.find((n) => n.id === noteId);
      expect(targetNote?.content).toBe("Prefers 85% dark chocolate");
    });

    it("DELETE: removes specific note", async () => {
      const deleted = await noteService.deleteNote(userId, noteId);
      expect(deleted).toBe(true);

      // RE-READ: verify note no longer exists
      const notes = await noteService.listNotesByPerson(userId, personId);
      expect(notes.some((n) => n.id === noteId)).toBe(false);
    });
  });

  // 4. Reminders Entity Persistence
  describe("4. Reminder Entity", () => {
    const scheduledTime = new Date(Date.now() + 10000000);

    it("CREATE: creates reminder for user and person", async () => {
      const rem = await reminderService.createReminder(userId, {
        title: "Buy birthday gift",
        scheduledAt: scheduledTime,
        personId,
        repeatType: "yearly",
      });

      expect(rem.id).toBeDefined();
      expect(rem.title).toBe("Buy birthday gift");
      expect(rem.personId).toBe(personId);
      reminderId = rem.id;
    });

    it("READ: retrieves reminder and lists upcoming", async () => {
      const rem = await reminderService.getReminderById(userId, reminderId);
      expect(rem).not.toBeNull();
      expect(rem?.title).toBe("Buy birthday gift");
      expect(rem?.personName).toBe("Contact One Renamed");

      const upcoming = await reminderService.listUpcomingRemindersByUser(userId);
      expect(upcoming.some((r) => r.id === reminderId)).toBe(true);
    });

    it("UPDATE: updates title and scheduled time", async () => {
      const newTime = new Date(Date.now() + 20000000);
      const updated = await reminderService.updateReminder(userId, reminderId, {
        title: "Buy customized birthday gift",
        scheduledAt: newTime,
      });

      expect(updated?.title).toBe("Buy customized birthday gift");

      // RE-READ
      const fresh = await reminderService.getReminderById(userId, reminderId);
      expect(fresh?.title).toBe("Buy customized birthday gift");
    });

    it("COMPLETE: marks recurring reminder completed and calculates next occurrence", async () => {
      const result = await reminderService.completeReminder(userId, reminderId, "Europe/London");
      expect(result.reminder).not.toBeNull();
      expect(result.nextOccurrence).not.toBeNull();

      // RE-READ
      const fresh = await reminderService.getReminderById(userId, reminderId);
      expect(fresh?.status).toBe("pending");
      expect(fresh?.scheduledAt.getTime()).toBeGreaterThan(scheduledTime.getTime());
    });

    it("DELETE: removes reminder", async () => {
      const deleted = await reminderService.deleteReminder(userId, reminderId);
      expect(deleted).toBe(true);

      // RE-READ
      const fresh = await reminderService.getReminderById(userId, reminderId);
      expect(fresh).toBeNull();
    });
  });

  // 5. Birthday Reminder Offset Persistence
  describe("5. Birthday Reminder Offsets Entity", () => {
    it("CREATE / TOGGLE & CUSTOM: creates standard offsets and custom offsets", async () => {
      // Toggle 14 days before off
      const toggled = await birthdayService.toggleBirthdayReminderOffset(userId, personId, 14);
      expect(toggled.enabled).toBe(false);

      // Add custom 60 days before
      const custom = await birthdayService.addCustomBirthdayReminderOffset(userId, personId, 60);
      expect(custom.daysBefore).toBe(60);
      expect(custom.enabled).toBe(true);

      // RE-READ
      const offsets = await birthdayService.getBirthdayRemindersForPerson(userId, personId);
      const fourteen = offsets.find((o) => o.daysBefore === 14);
      const sixty = offsets.find((o) => o.daysBefore === 60);

      expect(fourteen?.enabled).toBe(false);
      expect(sixty?.enabled).toBe(true);
    });
  });

  // 6. Admin Entity & User Management
  describe("6. Admin Entity & User Enable/Disable", () => {
    it("DISABLE & AUDIT: admin disables user, logs audit entry, verifies in DB", async () => {
      const disabledUser = await adminService.setUserStatus(userId, userId, true);
      expect(disabledUser?.isDisabled).toBe(true);

      // RE-READ
      const userInDb = await userService.findById(userId);
      expect(userInDb?.isDisabled).toBe(true);

      // Check audit log
      const logs = await adminService.getAuditLogs(10);
      const userDisableLog = logs.find((l) => l.action === "USER_DISABLED" && l.targetId === userId);
      expect(userDisableLog).toBeDefined();
    });

    it("ENABLE: admin enables user again", async () => {
      const enabledUser = await adminService.setUserStatus(userId, userId, false);
      expect(enabledUser?.isDisabled).toBe(false);

      const userInDb = await userService.findById(userId);
      expect(userInDb?.isDisabled).toBe(false);
    });
  });

  // 7. Person Cascading Deletion
  describe("7. Cascading Deletion of Person", () => {
    it("DELETE: deletes person and cascades deletion of notes & birthday reminders", async () => {
      const deleted = await personService.deletePerson(userId, personId);
      expect(deleted).toBe(true);

      // Verify Person gone
      const person = await personService.getPersonById(userId, personId);
      expect(person).toBeNull();

      // Verify Notes gone
      const notes = await noteService.listNotesByPerson(userId, personId);
      expect(notes.length).toBe(0);

      // Verify Birthday Reminders gone
      const bdays = await birthdayService.getBirthdayRemindersForPerson(userId, personId);
      expect(bdays.length).toBe(0);
    });
  });
});
