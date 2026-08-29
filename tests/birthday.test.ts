import { describe, it, expect, vi } from "vitest";
import { BirthdayService } from "../src/services/birthday.service.js";

describe("BirthdayService Details & Offset Management", () => {
  const userId = "user-123";
  const personId = "person-456";

  it("seeds default offsets (30, 14, 7, 3, 1, 0) when fetching for the first time", async () => {
    let insertedRows: any[] = [];
    const mockDb: any = {
      select: vi.fn().mockImplementation(() => ({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockImplementation((clause: any) => ({
            limit: vi.fn().mockResolvedValue([{ id: personId }]), // person ownership
            orderBy: vi.fn().mockImplementation(() => {
              if (insertedRows.length === 0) {
                return Promise.resolve([]);
              }
              return Promise.resolve(insertedRows);
            }),
          })),
        }),
      })),
      insert: vi.fn().mockReturnValue({
        values: vi.fn().mockImplementation((rows) => {
          insertedRows = rows.map((r: any, idx: number) => ({ id: `rem-${idx}`, ...r }));
          return Promise.resolve();
        }),
      }),
    };

    const service = new BirthdayService(mockDb);
    const reminders = await service.getBirthdayRemindersForPerson(userId, personId);

    expect(reminders.length).toBe(6);
    expect(reminders.map((r) => r.daysBefore)).toEqual([30, 14, 7, 3, 1, 0]);
  });

  it("toggles offset from enabled to disabled", async () => {
    const existingRow = {
      id: "rem-7",
      personId,
      daysBefore: 7,
      reminderTime: "09:00",
      enabled: true,
    };

    const mockDb: any = {
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockImplementation(() => Promise.resolve([{ id: personId }])),
          }),
        }),
      }),
      update: vi.fn().mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([{ ...existingRow, enabled: false }]),
          }),
        }),
      }),
    };

    // Override the second select call for the existing reminder row
    mockDb.select.mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([{ id: personId }]),
        }),
      }),
    }).mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([existingRow]),
        }),
      }),
    });

    const service = new BirthdayService(mockDb);
    const updated = await service.toggleBirthdayReminderOffset(userId, personId, 7);

    expect(updated).not.toBeNull();
    expect(updated?.enabled).toBe(false);
  });

  it("adds custom offset and validates positive integer", async () => {
    const mockDb: any = {
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([{ id: personId }]),
          }),
        }),
      }),
      insert: vi.fn().mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([
            {
              id: "custom-45",
              personId,
              daysBefore: 45,
              reminderTime: "09:00",
              enabled: true,
            },
          ]),
        }),
      }),
    };

    // Override for verifyPersonOwnership and existing check
    mockDb.select
      .mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([{ id: personId }]),
          }),
        }),
      })
      .mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]), // not existing yet
          }),
        }),
      })
      .mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([{ reminderTime: "09:00" }]),
          }),
        }),
      });

    const service = new BirthdayService(mockDb);
    const added = await service.addCustomBirthdayReminderOffset(userId, personId, 45);

    expect(added?.daysBefore).toBe(45);
    expect(added?.enabled).toBe(true);

    // Negative offset should throw
    await expect(service.addCustomBirthdayReminderOffset(userId, personId, -1)).rejects.toThrow();
  });
});
