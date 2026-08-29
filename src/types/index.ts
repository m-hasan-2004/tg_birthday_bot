import type { RecurrenceType } from "../utils/dates.js";

export type { RecurrenceType };

export type UserRole = "user" | "admin" | "owner";

export interface SessionState {
  currentStep?: string;
  tempData?: Record<string, unknown>;
}

export interface User {
  id: string;
  telegramId: string;
  name: string;
  birthday: string | null;
  additionalInfo: string | null;
  timezone: string;
  role: UserRole;
  isDisabled: boolean;
  sessionState: SessionState | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface Person {
  id: string;
  userId: string;
  name: string;
  birthday: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface Note {
  id: string;
  personId: string;
  content: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Reminder {
  id: string;
  userId: string;
  personId: string | null;
  title: string;
  scheduledAt: Date;
  repeatType: RecurrenceType;
  status: "pending" | "completed" | "cancelled";
  createdAt: Date;
  updatedAt: Date;
}

export interface BirthdayReminder {
  id: string;
  personId: string;
  daysBefore: number;
  reminderTime: string;
  enabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface NotificationLog {
  id: string;
  userId: string;
  reminderType: "birthday" | "general";
  referenceId: string;
  notificationKey: string;
  sentAt: Date;
}

export interface AuditLog {
  id: string;
  adminId: string | null;
  action: string;
  targetType: string;
  targetId: string | null;
  details: Record<string, unknown> | null;
  createdAt: Date;
}

export interface AuthSessionPayload {
  userId: string;
  telegramId?: string;
  role?: UserRole;
}
