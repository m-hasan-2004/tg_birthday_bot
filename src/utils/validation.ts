import { isValidTimezone, parseBirthday } from "./dates.js";

/**
 * Validates a user or person name.
 */
export function validateName(name: string): { isValid: boolean; error?: string; cleanName: string } {
  if (!name || typeof name !== "string") {
    return { isValid: false, error: "Name cannot be empty.", cleanName: "" };
  }
  const cleanName = name.trim();
  if (cleanName.length < 1) {
    return { isValid: false, error: "Name cannot be empty.", cleanName: "" };
  }
  if (cleanName.length > 100) {
    return { isValid: false, error: "Name must be 100 characters or fewer.", cleanName: cleanName.slice(0, 100) };
  }
  return { isValid: true, cleanName };
}

/**
 * Validates a birthday input string.
 */
export function validateBirthday(birthdayStr: string): { isValid: boolean; error?: string; formatted?: string } {
  if (!birthdayStr || typeof birthdayStr !== "string") {
    return { isValid: false, error: "Please enter a valid date." };
  }
  const parsed = parseBirthday(birthdayStr);
  if (!parsed) {
    return { isValid: false, error: "Invalid date format. Use Month and Day (e.g., September 14 or 09-14)." };
  }
  const formatted = `${String(parsed.month).padStart(2, "0")}-${String(parsed.day).padStart(2, "0")}`;
  return { isValid: true, formatted };
}

/**
 * Validates a custom birthday reminder offset (days before).
 * Must be a positive whole integer >= 0 and <= 365.
 */
export function validateOffsetDays(input: string | number): { isValid: boolean; offsetDays?: number; error?: string } {
  const str = String(input).trim();
  if (!/^\d+$/.test(str)) {
    return { isValid: false, error: "Offset must be a positive whole number (e.g. 45)." };
  }
  const num = parseInt(str, 10);
  if (isNaN(num) || num < 0) {
    return { isValid: false, error: "Offset must be a positive whole number (e.g. 45)." };
  }
  if (num > 365) {
    return { isValid: false, error: "Offset cannot be greater than 365 days." };
  }
  return { isValid: true, offsetDays: num };
}

/**
 * Validates a time string (HH:mm format).
 */
export function validateTimeStr(timeStr: string): { isValid: boolean; timeStr?: string; error?: string } {
  if (!timeStr) return { isValid: false, error: "Time cannot be empty." };
  const trimmed = timeStr.trim();
  const match = /^([01]?[0-9]|2[0-3]):([0-5][0-9])$/.exec(trimmed);
  if (!match) {
    return { isValid: false, error: "Invalid time format. Please use HH:mm (e.g., 09:00 or 18:30)." };
  }
  const hour = String(parseInt(match[1], 10)).padStart(2, "0");
  const minute = match[2];
  return { isValid: true, timeStr: `${hour}:${minute}` };
}

/**
 * Validates IANA timezone.
 */
export function validateTimezone(tz: string): { isValid: boolean; timezone?: string; error?: string } {
  if (!tz || !isValidTimezone(tz.trim())) {
    return { isValid: false, error: "Invalid IANA timezone. Example: Europe/Berlin or America/New_York." };
  }
  return { isValid: true, timezone: tz.trim() };
}
