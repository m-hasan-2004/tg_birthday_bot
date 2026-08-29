import { describe, it, expect } from "vitest";
import { DateTime } from "luxon";
import {
  isValidTimezone,
  parseBirthday,
  formatBirthday,
  getNextBirthday,
  getBirthdayReminderTarget,
  getNextReminderOccurrence,
  formatReminderDate,
} from "../src/utils/dates.js";

describe("Date & Timezone Utilities", () => {
  describe("isValidTimezone", () => {
    it("validates standard IANA timezones", () => {
      expect(isValidTimezone("Europe/Berlin")).toBe(true);
      expect(isValidTimezone("America/New_York")).toBe(true);
      expect(isValidTimezone("UTC")).toBe(true);
      expect(isValidTimezone("Asia/Tokyo")).toBe(true);
    });

    it("rejects invalid timezones", () => {
      expect(isValidTimezone("Invalid/Timezone")).toBe(false);
      expect(isValidTimezone("")).toBe(false);
      expect(isValidTimezone("Mars/Base")).toBe(false);
    });
  });

  describe("parseBirthday & formatBirthday", () => {
    it("parses MM-dd formats", () => {
      expect(parseBirthday("09-14")).toEqual({ month: 9, day: 14 });
      expect(parseBirthday("9-14")).toEqual({ month: 9, day: 14 });
    });

    it("parses yyyy-MM-dd formats", () => {
      expect(parseBirthday("1995-09-14")).toEqual({ month: 9, day: 14, year: 1995 });
    });

    it("formats birthdays to human readable string", () => {
      expect(formatBirthday("09-14")).toBe("September 14");
      expect(formatBirthday("12-25")).toBe("December 25");
      expect(formatBirthday("01-01")).toBe("January 1");
    });
  });

  describe("getNextBirthday", () => {
    it("calculates birthday in current year if date has not passed", () => {
      const refDate = DateTime.fromISO("2026-05-01T10:00:00", { zone: "Europe/Berlin" });
      const res = getNextBirthday("09-14", "Europe/Berlin", refDate);
      expect(res).not.toBeNull();
      expect(res?.year).toBe(2026);
      expect(res?.daysUntil).toBe(136);
    });

    it("calculates birthday in next year if date has already passed", () => {
      const refDate = DateTime.fromISO("2026-10-01T10:00:00", { zone: "Europe/Berlin" });
      const res = getNextBirthday("09-14", "Europe/Berlin", refDate);
      expect(res).not.toBeNull();
      expect(res?.year).toBe(2027);
      expect(res?.daysUntil).toBe(348);
    });

    it("handles birthday on the current day (daysUntil = 0)", () => {
      const refDate = DateTime.fromISO("2026-09-14T08:00:00", { zone: "Europe/Berlin" });
      const res = getNextBirthday("09-14", "Europe/Berlin", refDate);
      expect(res).not.toBeNull();
      expect(res?.year).toBe(2026);
      expect(res?.daysUntil).toBe(0);
    });

    it("handles February 29 leap year birthdays in non-leap years", () => {
      // 2026 is not a leap year
      const refDate = DateTime.fromISO("2026-01-01T10:00:00", { zone: "Europe/Berlin" });
      const res = getNextBirthday("02-29", "Europe/Berlin", refDate);
      expect(res).not.toBeNull();
      expect(res?.nextBirthday.day).toBe(28);
      expect(res?.nextBirthday.month).toBe(2);
    });
  });

  describe("getBirthdayReminderTarget", () => {
    it("calculates target timestamp for 7 days before birthday", () => {
      const target = getBirthdayReminderTarget("09-14", 7, "09:00", "Europe/Berlin", 2026);
      expect(target).not.toBeNull();
      expect(target?.year).toBe(2026);
      expect(target?.month).toBe(9);
      expect(target?.day).toBe(7);
      expect(target?.hour).toBe(9);
      expect(target?.minute).toBe(0);
    });

    it("calculates target timestamp for 0 days before (on the day)", () => {
      const target = getBirthdayReminderTarget("09-14", 0, "10:30", "Europe/Berlin", 2026);
      expect(target).not.toBeNull();
      expect(target?.day).toBe(14);
      expect(target?.hour).toBe(10);
      expect(target?.minute).toBe(30);
    });

    it("calculates target timestamp crossing month boundary (30 days before)", () => {
      const target = getBirthdayReminderTarget("09-14", 30, "09:00", "Europe/Berlin", 2026);
      expect(target).not.toBeNull();
      expect(target?.month).toBe(8);
      expect(target?.day).toBe(15);
    });
  });

  describe("getNextReminderOccurrence", () => {
    const baseDate = new Date("2026-09-20T09:00:00Z");

    it("returns null for repeatType none", () => {
      expect(getNextReminderOccurrence(baseDate, "none", "Europe/Berlin")).toBeNull();
    });

    it("calculates next daily occurrence (+1 day)", () => {
      const next = getNextReminderOccurrence(baseDate, "daily", "Europe/Berlin");
      expect(next).not.toBeNull();
      const dt = DateTime.fromJSDate(next!).setZone("Europe/Berlin");
      expect(dt.day).toBe(21);
      expect(dt.month).toBe(9);
    });

    it("calculates next weekly occurrence (+7 days)", () => {
      const next = getNextReminderOccurrence(baseDate, "weekly", "Europe/Berlin");
      expect(next).not.toBeNull();
      const dt = DateTime.fromJSDate(next!).setZone("Europe/Berlin");
      expect(dt.day).toBe(27);
      expect(dt.month).toBe(9);
    });

    it("calculates next monthly occurrence (+1 month)", () => {
      const next = getNextReminderOccurrence(baseDate, "monthly", "Europe/Berlin");
      expect(next).not.toBeNull();
      const dt = DateTime.fromJSDate(next!).setZone("Europe/Berlin");
      expect(dt.month).toBe(10);
      expect(dt.day).toBe(20);
    });

    it("calculates next yearly occurrence (+1 year)", () => {
      const next = getNextReminderOccurrence(baseDate, "yearly", "Europe/Berlin");
      expect(next).not.toBeNull();
      const dt = DateTime.fromJSDate(next!).setZone("Europe/Berlin");
      expect(dt.year).toBe(2027);
      expect(dt.month).toBe(9);
      expect(dt.day).toBe(20);
    });
  });

  describe("formatReminderDate", () => {
    it("formats reminder date correctly", () => {
      const date = new Date("2026-09-20T09:00:00.000Z");
      const { timeStr } = formatReminderDate(date, "UTC");
      expect(timeStr).toBe("09:00");
    });
  });
});
