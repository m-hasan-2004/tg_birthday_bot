import { describe, it, expect } from "vitest";
import {
  validateName,
  validateBirthday,
  validateOffsetDays,
  validateTimeStr,
  validateTimezone,
} from "../src/utils/validation.js";

describe("Validation Helpers", () => {
  describe("validateName", () => {
    it("accepts valid names", () => {
      expect(validateName("Alex").isValid).toBe(true);
      expect(validateName("  John Doe  ").cleanName).toBe("John Doe");
    });

    it("rejects empty or whitespace-only names", () => {
      expect(validateName("").isValid).toBe(false);
      expect(validateName("   ").isValid).toBe(false);
    });

    it("truncates names exceeding 100 characters", () => {
      const longName = "A".repeat(150);
      const res = validateName(longName);
      expect(res.isValid).toBe(false);
      expect(res.cleanName.length).toBe(100);
    });
  });

  describe("validateBirthday", () => {
    it("accepts valid birthday formats", () => {
      expect(validateBirthday("09-14").isValid).toBe(true);
      expect(validateBirthday("09-14").formatted).toBe("09-14");
      expect(validateBirthday("1990-09-14").isValid).toBe(true);
      expect(validateBirthday("1990-09-14").formatted).toBe("09-14");
    });

    it("rejects invalid date strings", () => {
      expect(validateBirthday("not-a-date").isValid).toBe(false);
      expect(validateBirthday("").isValid).toBe(false);
    });
  });

  describe("validateOffsetDays", () => {
    it("accepts valid positive integer offsets", () => {
      expect(validateOffsetDays("45").isValid).toBe(true);
      expect(validateOffsetDays("45").offsetDays).toBe(45);
      expect(validateOffsetDays(0).isValid).toBe(true);
      expect(validateOffsetDays("100").offsetDays).toBe(100);
    });

    it("rejects negative numbers and decimals", () => {
      expect(validateOffsetDays("-5").isValid).toBe(false);
      expect(validateOffsetDays("3.5").isValid).toBe(false);
      expect(validateOffsetDays("abc").isValid).toBe(false);
    });

    it("rejects offsets greater than 365 days", () => {
      expect(validateOffsetDays("400").isValid).toBe(false);
    });
  });

  describe("validateTimeStr", () => {
    it("accepts valid 24-hour time strings", () => {
      expect(validateTimeStr("09:00").isValid).toBe(true);
      expect(validateTimeStr("09:00").timeStr).toBe("09:00");
      expect(validateTimeStr("23:59").isValid).toBe(true);
      expect(validateTimeStr("00:00").isValid).toBe(true);
      expect(validateTimeStr("9:30").timeStr).toBe("09:30");
    });

    it("rejects invalid time strings", () => {
      expect(validateTimeStr("25:00").isValid).toBe(false);
      expect(validateTimeStr("12:60").isValid).toBe(false);
      expect(validateTimeStr("abc").isValid).toBe(false);
    });
  });

  describe("validateTimezone", () => {
    it("validates valid IANA timezones", () => {
      expect(validateTimezone("Europe/Berlin").isValid).toBe(true);
      expect(validateTimezone("America/New_York").isValid).toBe(true);
    });

    it("rejects invalid timezones", () => {
      expect(validateTimezone("Invalid/Zone").isValid).toBe(false);
    });
  });
});
