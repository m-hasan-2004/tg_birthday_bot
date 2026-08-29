import { describe, it, expect, vi } from "vitest";
import { UserService } from "../src/services/user.service.js";
import { PersonService } from "../src/services/person.service.js";
import { NoteService } from "../src/services/note.service.js";
import { ReminderService } from "../src/services/reminder.service.js";
import { BirthdayService } from "../src/services/birthday.service.js";

describe("Services Logic & User Data Isolation", () => {
  describe("UserService", () => {
    it("creates user with normalized values", async () => {
      const mockDb: any = {
        insert: vi.fn().mockReturnValue({
          values: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([
              {
                id: "user-1",
                telegramId: "123456",
                name: "Alex",
                birthday: "09-14",
                additionalInfo: "Likes cycling",
                timezone: "Europe/Berlin",
                sessionState: null,
                createdAt: new Date(),
                updatedAt: new Date(),
              },
            ]),
          }),
        }),
      };

      const service = new UserService(mockDb);
      const user = await service.createUser({
        telegramId: 123456,
        name: " Alex ",
        birthday: "09-14",
        additionalInfo: "Likes cycling",
        timezone: "Europe/Berlin",
      });

      expect(user.id).toBe("user-1");
      expect(user.name).toBe("Alex");
      expect(user.timezone).toBe("Europe/Berlin");
    });
  });

  describe("PersonService", () => {
    it("creates person and initializes default birthday reminders if birthday is provided", async () => {
      const mockPerson = {
        id: "person-1",
        userId: "user-1",
        name: "John",
        birthday: "09-14",
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const mockDb: any = {
        insert: vi.fn().mockImplementation(() => ({
          values: vi.fn().mockImplementation((val) => {
            if (Array.isArray(val)) {
              // birthdayReminders insert
              return Promise.resolve();
            }
            return {
              returning: vi.fn().mockResolvedValue([mockPerson]),
            };
          }),
        })),
      };

      const service = new PersonService(mockDb);
      const created = await service.createPerson("user-1", {
        name: "John",
        birthday: "09-14",
        note: "Initial note",
      });

      expect(created.id).toBe("person-1");
      expect(created.name).toBe("John");
      expect(mockDb.insert).toHaveBeenCalledTimes(3); // person, note, birthdayReminders
    });
  });

  describe("ReminderService & Recurrence", () => {
    it("creates reminder with valid parameters", async () => {
      const mockReminder = {
        id: "rem-1",
        userId: "user-1",
        personId: "person-1",
        title: "Ask John about his job",
        scheduledAt: new Date("2026-09-20T09:00:00Z"),
        repeatType: "none",
        status: "pending",
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const mockDb: any = {
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([{ id: "person-1" }]),
            }),
          }),
        }),
        insert: vi.fn().mockReturnValue({
          values: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([mockReminder]),
          }),
        }),
      };

      const service = new ReminderService(mockDb);
      const created = await service.createReminder("user-1", {
        title: "Ask John about his job",
        scheduledAt: new Date("2026-09-20T09:00:00Z"),
        personId: "person-1",
        repeatType: "none",
      });

      expect(created.id).toBe("rem-1");
      expect(created.title).toBe("Ask John about his job");
    });

    it("completes non-recurring reminder by setting status to completed", async () => {
      const existingReminder = {
        id: "rem-1",
        userId: "user-1",
        title: "Renew passport",
        scheduledAt: new Date("2026-09-20T09:00:00Z"),
        repeatType: "none",
        status: "pending",
      };

      const mockDb: any = {
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            leftJoin: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue([existingReminder]),
              }),
            }),
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([{ timezone: "Europe/Berlin" }]),
            }),
          }),
        }),
        update: vi.fn().mockReturnValue({
          set: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              returning: vi.fn().mockResolvedValue([{ ...existingReminder, status: "completed" }]),
            }),
          }),
        }),
      };

      const service = new ReminderService(mockDb);
      const result = await service.completeReminder("user-1", "rem-1");

      expect(result.nextOccurrence).toBeNull();
      expect(result.reminder?.status).toBe("completed");
    });

    it("advances recurring reminder to next occurrence when completed", async () => {
      const scheduledAt = new Date("2026-09-20T09:00:00.000Z");
      const existingReminder = {
        id: "rem-weekly",
        userId: "user-1",
        title: "Team Standup",
        scheduledAt,
        repeatType: "weekly",
        status: "pending",
      };

      let updatedValues: any = {};
      const mockDb: any = {
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            leftJoin: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue([existingReminder]),
              }),
            }),
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([{ timezone: "Europe/Berlin" }]),
            }),
          }),
        }),
        update: vi.fn().mockReturnValue({
          set: vi.fn().mockImplementation((val) => {
            updatedValues = val;
            return {
              where: vi.fn().mockReturnValue({
                returning: vi.fn().mockResolvedValue([
                  { ...existingReminder, ...updatedValues },
                ]),
              }),
            };
          }),
        }),
      };

      const service = new ReminderService(mockDb);
      const result = await service.completeReminder("user-1", "rem-weekly", "UTC");

      expect(result.nextOccurrence).not.toBeNull();
      expect(result.reminder?.status).toBe("pending");
      expect(result.nextOccurrence?.toISOString()).toBe("2026-09-27T09:00:00.000Z");
    });
  });
});
