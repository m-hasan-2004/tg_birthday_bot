import { pgTable, uuid, text, varchar, timestamp, boolean, integer, jsonb, index, uniqueIndex } from "drizzle-orm/pg-core";

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    telegramId: varchar("telegram_id", { length: 64 }).notNull().unique(),
    name: text("name").notNull(),
    birthday: varchar("birthday", { length: 20 }),
    additionalInfo: text("additional_info"),
    timezone: varchar("timezone", { length: 64 }).notNull().default("Europe/Berlin"),
    role: varchar("role", { length: 20 }).notNull().default("user"), // 'user' | 'admin' | 'owner'
    isDisabled: boolean("is_disabled").notNull().default(false),
    sessionState: jsonb("session_state"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("users_telegram_id_idx").on(table.telegramId),
  ]
);

export const people = pgTable(
  "people",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    birthday: varchar("birthday", { length: 20 }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("people_user_id_idx").on(table.userId),
  ]
);

export const notes = pgTable(
  "notes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    personId: uuid("person_id")
      .notNull()
      .references(() => people.id, { onDelete: "cascade" }),
    content: text("content").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("notes_person_id_idx").on(table.personId),
  ]
);

export const reminders = pgTable(
  "reminders",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    personId: uuid("person_id").references(() => people.id, { onDelete: "set null" }),
    title: text("title").notNull(),
    scheduledAt: timestamp("scheduled_at", { withTimezone: true }).notNull(),
    repeatType: varchar("repeat_type", { length: 20 }).notNull().default("none"), // 'none' | 'daily' | 'weekly' | 'monthly' | 'yearly'
    status: varchar("status", { length: 20 }).notNull().default("pending"), // 'pending' | 'completed' | 'cancelled'
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("reminders_user_id_idx").on(table.userId),
    index("reminders_scheduled_at_idx").on(table.scheduledAt),
    index("reminders_status_idx").on(table.status),
  ]
);

export const birthdayReminders = pgTable(
  "birthday_reminders",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    personId: uuid("person_id")
      .notNull()
      .references(() => people.id, { onDelete: "cascade" }),
    daysBefore: integer("days_before").notNull(),
    reminderTime: varchar("reminder_time", { length: 10 }).notNull().default("09:00"),
    enabled: boolean("enabled").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("birthday_reminders_person_id_idx").on(table.personId),
  ]
);

export const notificationLogs = pgTable(
  "notification_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    reminderType: varchar("reminder_type", { length: 20 }).notNull(), // 'birthday' | 'general'
    referenceId: uuid("reference_id").notNull(),
    notificationKey: varchar("notification_key", { length: 150 }).notNull(),
    sentAt: timestamp("sent_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("notification_logs_key_idx").on(table.notificationKey),
    index("notification_logs_user_id_idx").on(table.userId),
  ]
);

export const auditLogs = pgTable(
  "audit_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    adminId: uuid("admin_id").references(() => users.id, { onDelete: "set null" }),
    action: text("action").notNull(),
    targetType: varchar("target_type", { length: 50 }).notNull(),
    targetId: varchar("target_id", { length: 64 }),
    details: jsonb("details"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("audit_logs_admin_id_idx").on(table.adminId),
    index("audit_logs_target_idx").on(table.targetType, table.targetId),
  ]
);
