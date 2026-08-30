import { DateTime, IANAZone } from "luxon";

export type RecurrenceType = "none" | "daily" | "weekly" | "monthly" | "yearly";

/**
 * Validates whether a timezone identifier is a valid IANA timezone.
 */
export function isValidTimezone(timezone: string): boolean {
  if (!timezone || typeof timezone !== "string") return false;
  return IANAZone.isValidZone(timezone);
}

/**
 * Normalizes and parses a birthday string into month and day.
 * Supports formats: "MM-dd", "yyyy-MM-dd", "M/d", "d.M.", etc.
 */
export function parseBirthday(birthdayStr: string): { month: number; day: number; year?: number } | null {
  if (!birthdayStr) return null;
  const trimmed = birthdayStr.trim();

  // Try standard YYYY-MM-DD
  let dt = DateTime.fromFormat(trimmed, "yyyy-MM-dd");
  if (dt.isValid) {
    return { month: dt.month, day: dt.day, year: dt.year };
  }

  // Try MM-dd
  dt = DateTime.fromFormat(trimmed, "MM-dd");
  if (dt.isValid) {
    return { month: dt.month, day: dt.day };
  }

  // Try M-d
  dt = DateTime.fromFormat(trimmed, "M-d");
  if (dt.isValid) {
    return { month: dt.month, day: dt.day };
  }

  // Try standard regex for month and day: "09-14" or "9/14" or "14.9."
  const parts = trimmed.split(/[-/.]/).filter(Boolean);
  if (parts.length === 2) {
    const num1 = parseInt(parts[0], 10);
    const num2 = parseInt(parts[1], 10);
    // Determine which is month and which is day
    if (num1 >= 1 && num1 <= 12 && num2 >= 1 && num2 <= 31) {
      return { month: num1, day: num2 };
    }
  } else if (parts.length === 3) {
    // If year is first or last
    if (parts[0].length === 4) {
      const year = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10);
      const day = parseInt(parts[2], 10);
      if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
        return { month, day, year };
      }
    } else if (parts[2].length === 4) {
      const day = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10);
      const year = parseInt(parts[2], 10);
      if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
        return { month, day, year };
      }
    }
  }

  return null;
}

/**
 * Formats a birthday object or string into a human-readable format like "September 14".
 */
export function formatBirthday(birthdayStr: string | null | undefined): string {
  if (!birthdayStr) return "Not set";
  const parsed = parseBirthday(birthdayStr);
  if (!parsed) return birthdayStr;

  const dt = DateTime.fromObject({ month: parsed.month, day: parsed.day, year: 2024 });
  return dt.toFormat("LLLL d");
}

/**
 * Calculates the next occurrence of a birthday in the user's timezone.
 * Handles Feb 29 for non-leap years by falling back to Feb 28.
 */
export function getNextBirthday(
  birthdayStr: string,
  userTimezone: string = "Asia/Tehran",
  referenceDate?: DateTime
): { nextBirthday: DateTime; daysUntil: number; year: number } | null {
  const parsed = parseBirthday(birthdayStr);
  if (!parsed) return null;

  const zone = isValidTimezone(userTimezone) ? userTimezone : "Asia/Tehran";
  const now = (referenceDate || DateTime.now()).setZone(zone);
  const currentYear = now.year;

  // Function to create birthday DateTime in a specific year safely handling Feb 29
  const createBirthdayInYear = (year: number) => {
    let day = parsed.day;
    if (parsed.month === 2 && day === 29) {
      const isLeap = DateTime.fromObject({ year, month: 1, day: 1 }).isInLeapYear;
      if (!isLeap) {
        day = 28;
      }
    }
    return DateTime.fromObject(
      { year, month: parsed.month, day, hour: 0, minute: 0, second: 0, millisecond: 0 },
      { zone }
    );
  };

  let bdayThisYear = createBirthdayInYear(currentYear);
  const startOfToday = now.startOf("day");

  let nextBday: DateTime;
  let targetYear: number;

  if (bdayThisYear >= startOfToday) {
    nextBday = bdayThisYear;
    targetYear = currentYear;
  } else {
    nextBday = createBirthdayInYear(currentYear + 1);
    targetYear = currentYear + 1;
  }

  // Calculate whole days difference
  const diffDays = Math.round(nextBday.startOf("day").diff(startOfToday, "days").days);

  return {
    nextBirthday: nextBday,
    daysUntil: diffDays,
    year: targetYear,
  };
}

/**
 * Calculates the exact scheduled timestamp for a birthday reminder offset.
 * Example: offsetDays = 7, reminderTime = "09:00", timezone = "Asia/Tehran".
 */
export function getBirthdayReminderTarget(
  birthdayStr: string,
  offsetDays: number,
  reminderTimeStr: string,
  userTimezone: string = "Asia/Tehran",
  targetYear?: number
): DateTime | null {
  const parsed = parseBirthday(birthdayStr);
  if (!parsed) return null;

  const zone = isValidTimezone(userTimezone) ? userTimezone : "Asia/Tehran";
  const year = targetYear || DateTime.now().setZone(zone).year;

  let day = parsed.day;
  if (parsed.month === 2 && day === 29) {
    const isLeap = DateTime.fromObject({ year, month: 1, day: 1 }).isInLeapYear;
    if (!isLeap) day = 28;
  }

  const [hourStr, minStr] = (reminderTimeStr || "09:00").split(":");
  const hour = parseInt(hourStr, 10) || 9;
  const minute = parseInt(minStr, 10) || 0;

  const bdayDateTime = DateTime.fromObject(
    { year, month: parsed.month, day, hour, minute, second: 0, millisecond: 0 },
    { zone }
  );

  return bdayDateTime.minus({ days: offsetDays });
}

/**
 * Calculates the next occurrence for a recurring reminder.
 */
export function getNextReminderOccurrence(
  currentScheduledAt: Date,
  repeatType: RecurrenceType,
  userTimezone: string = "Asia/Tehran"
): Date | null {
  if (repeatType === "none") return null;

  const zone = isValidTimezone(userTimezone) ? userTimezone : "Asia/Tehran";
  let dt = DateTime.fromJSDate(currentScheduledAt).setZone(zone);

  switch (repeatType) {
    case "daily":
      dt = dt.plus({ days: 1 });
      break;
    case "weekly":
      dt = dt.plus({ weeks: 1 });
      break;
    case "monthly":
      dt = dt.plus({ months: 1 });
      break;
    case "yearly":
      dt = dt.plus({ years: 1 });
      break;
    default:
      return null;
  }

  return dt.toJSDate();
}

/**
 * Formats a Date object to user's localized date string (e.g. "September 20" or "Today" or "Tomorrow").
 */
export function formatReminderDate(date: Date, userTimezone: string = "Asia/Tehran"): { dateStr: string; timeStr: string } {
  const zone = isValidTimezone(userTimezone) ? userTimezone : "Asia/Tehran";
  const dt = DateTime.fromJSDate(date).setZone(zone);
  const now = DateTime.now().setZone(zone);

  let dateStr: string;
  if (dt.hasSame(now, "day")) {
    dateStr = "Today (" + dt.toFormat("LLLL d, yyyy") + ")";
  } else if (dt.hasSame(now.plus({ days: 1 }), "day")) {
    dateStr = "Tomorrow (" + dt.toFormat("LLLL d, yyyy") + ")";
  } else {
    dateStr = dt.toFormat("LLLL d, yyyy");
  }

  const timeStr = dt.toFormat("HH:mm");

  return { dateStr, timeStr };
}
