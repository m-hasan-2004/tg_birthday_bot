import { describe, it, expect, vi } from "vitest";
import { NotificationService } from "../src/services/notification.service.js";

describe("NotificationService & Scheduler Idempotency", () => {
  it("detects existing notification log entries to prevent duplicate alerts", async () => {
    const mockDb: any = {
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([{ id: "log-1" }]),
          }),
        }),
      }),
    };

    const service = new NotificationService(mockDb);
    const isLogged = await service.isNotificationLogged("gen_rem1_12345678");
    expect(isLogged).toBe(true);
  });

  it("returns false when notification has not been logged yet", async () => {
    const mockDb: any = {
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      }),
    };

    const service = new NotificationService(mockDb);
    const isLogged = await service.isNotificationLogged("gen_rem_new");
    expect(isLogged).toBe(false);
  });

  it("dispatches due general reminders and marks completed", async () => {
    const mockReminder = {
      reminderId: "rem-100",
      userId: "user-1",
      personId: "person-1",
      title: "Renew passport",
      scheduledAt: new Date("2026-09-14T09:00:00Z"),
      repeatType: "none",
      userTelegramId: "987654",
      userTimezone: "Europe/Berlin",
      personName: "John",
    };

    const mockBot: any = {
      api: {
        sendMessage: vi.fn().mockResolvedValue({ message_id: 123 }),
      },
    };

    const mockDb: any = {
      select: vi.fn().mockImplementation(() => ({
        from: vi.fn().mockReturnValue({
          innerJoin: vi.fn().mockReturnValue({
            leftJoin: vi.fn().mockReturnValue({
              where: vi.fn().mockResolvedValue([mockReminder]),
            }),
          }),
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]), // not logged yet
          }),
        }),
      })),
      insert: vi.fn().mockReturnValue({
        values: vi.fn().mockResolvedValue({}),
      }),
      update: vi.fn().mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue({}),
        }),
      }),
    };

    const service = new NotificationService(mockDb);
    const dispatched = await service.processDueGeneralReminders(
      mockBot,
      new Date("2026-09-14T10:00:00Z")
    );

    expect(dispatched).toBe(1);
    expect(mockBot.api.sendMessage).toHaveBeenCalledWith(
      "987654",
      expect.stringContaining("Renew passport"),
      expect.any(Object)
    );
    expect(mockDb.insert).toHaveBeenCalled();
    expect(mockDb.update).toHaveBeenCalled();
  });
});
