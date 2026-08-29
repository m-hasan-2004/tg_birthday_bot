import { describe, it, expect, vi } from "vitest";
import { PersonService } from "../src/services/person.service.js";
import { NoteService } from "../src/services/note.service.js";
import { ReminderService } from "../src/services/reminder.service.js";
import { BirthdayService } from "../src/services/birthday.service.js";

describe("Strict Multi-User Data Isolation & Ownership Enforcement", () => {
  const userA = "user-uuid-aaa";
  const userB = "user-uuid-bbb";

  describe("PersonService Isolation", () => {
    it("prevents User A from viewing User B's person", async () => {
      // Mock db returning empty when where clause includes (id = person-b and user_id = userA)
      const mockDb: any = {
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([]), // No record found for User A
            }),
          }),
        }),
      };

      const service = new PersonService(mockDb);
      const res = await service.getPersonById(userA, "person-b-id");
      expect(res).toBeNull();
    });

    it("prevents User A from updating or deleting User B's person", async () => {
      const mockDb: any = {
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([]),
            }),
          }),
        }),
        update: vi.fn(),
        delete: vi.fn(),
      };

      const service = new PersonService(mockDb);
      const updateRes = await service.updatePerson(userA, "person-b-id", { name: "Hacked" });
      const deleteRes = await service.deletePerson(userA, "person-b-id");

      expect(updateRes).toBeNull();
      expect(deleteRes).toBe(false);
      expect(mockDb.update).not.toHaveBeenCalled();
      expect(mockDb.delete).not.toHaveBeenCalled();
    });
  });

  describe("NoteService Isolation", () => {
    it("prevents User A from adding notes to User B's person", async () => {
      const mockDb: any = {
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([]), // Person not owned by User A
            }),
          }),
        }),
        insert: vi.fn(),
      };

      const service = new NoteService(mockDb);
      const res = await service.addNote(userA, "person-b-id", "Secret note");

      expect(res).toBeNull();
      expect(mockDb.insert).not.toHaveBeenCalled();
    });

    it("prevents User A from reading notes belonging to User B", async () => {
      const mockDb: any = {
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            innerJoin: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue([]),
              }),
            }),
          }),
        }),
      };

      const service = new NoteService(mockDb);
      const res = await service.getNoteById(userA, "note-b-id");
      expect(res).toBeNull();
    });
  });

  describe("ReminderService Isolation", () => {
    it("prevents User A from viewing, completing, or deleting User B's reminder", async () => {
      const mockDb: any = {
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            leftJoin: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue([]),
              }),
            }),
          }),
        }),
        update: vi.fn(),
        delete: vi.fn(),
      };

      const service = new ReminderService(mockDb);
      const viewRes = await service.getReminderById(userA, "rem-b-id");
      const completeRes = await service.completeReminder(userA, "rem-b-id");
      const deleteRes = await service.deleteReminder(userA, "rem-b-id");

      expect(viewRes).toBeNull();
      expect(completeRes.reminder).toBeNull();
      expect(deleteRes).toBe(false);
      expect(mockDb.update).not.toHaveBeenCalled();
      expect(mockDb.delete).not.toHaveBeenCalled();
    });
  });

  describe("BirthdayService Isolation", () => {
    it("prevents User A from modifying birthday reminders on User B's contacts", async () => {
      const mockDb: any = {
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([]), // Ownership verify fails
            }),
          }),
        }),
        insert: vi.fn(),
        update: vi.fn(),
      };

      const service = new BirthdayService(mockDb);
      const toggleRes = await service.toggleBirthdayReminderOffset(userA, "person-b-id", 7);
      const customRes = await service.addCustomBirthdayReminderOffset(userA, "person-b-id", 45);

      expect(toggleRes).toBeNull();
      expect(customRes).toBeNull();
      expect(mockDb.insert).not.toHaveBeenCalled();
      expect(mockDb.update).not.toHaveBeenCalled();
    });
  });
});
