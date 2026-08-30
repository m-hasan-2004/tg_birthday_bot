import { and, eq } from "drizzle-orm";
import { db, DB } from "../db/index.js";
import { birthdayReminders, people } from "../db/schema.js";
import type { BirthdayReminder } from "../types/index.js";

export class BirthdayService {
  constructor(private readonly database: DB = db) {}

  private async verifyPersonOwnership(userId: string, personId: string): Promise<boolean> {
    const [person] = await this.database
      .select({ id: people.id })
      .from(people)
      .where(and(eq(people.id, personId), eq(people.userId, userId)))
      .limit(1);

    return Boolean(person);
  }

  async getBirthdayRemindersForPerson(userId: string, personId: string): Promise<BirthdayReminder[]> {
    const isOwner = await this.verifyPersonOwnership(userId, personId);
    if (!isOwner) return [];

    let results = await this.database
      .select()
      .from(birthdayReminders)
      .where(eq(birthdayReminders.personId, personId))
      .orderBy(birthdayReminders.daysBefore);

    // If no reminders exist yet, seed default offset (0 - on the day)
    if (results.length === 0) {
      const defaultOffsets = [0];
      const newRows = defaultOffsets.map((daysBefore) => ({
        personId,
        daysBefore,
        reminderTime: "09:00",
        enabled: true,
      }));

      await this.database.insert(birthdayReminders).values(newRows);

      results = await this.database
        .select()
        .from(birthdayReminders)
        .where(eq(birthdayReminders.personId, personId))
        .orderBy(birthdayReminders.daysBefore);
    }

    return results as unknown as BirthdayReminder[];
  }

  async toggleBirthdayReminderOffset(
    userId: string,
    personId: string,
    daysBefore: number
  ): Promise<BirthdayReminder | null> {
    const isOwner = await this.verifyPersonOwnership(userId, personId);
    if (!isOwner) return null;

    const [existing] = await this.database
      .select()
      .from(birthdayReminders)
      .where(and(eq(birthdayReminders.personId, personId), eq(birthdayReminders.daysBefore, daysBefore)))
      .limit(1);

    if (existing) {
      const [updated] = await this.database
        .update(birthdayReminders)
        .set({ enabled: !existing.enabled, updatedAt: new Date() })
        .where(eq(birthdayReminders.id, existing.id))
        .returning();

      return updated as unknown as BirthdayReminder;
    } else {
      // Find current reminder time if any exists for this person
      const [firstReminder] = await this.database
        .select({ reminderTime: birthdayReminders.reminderTime })
        .from(birthdayReminders)
        .where(eq(birthdayReminders.personId, personId))
        .limit(1);

      const reminderTime = firstReminder?.reminderTime || "09:00";

      const [inserted] = await this.database
        .insert(birthdayReminders)
        .values({
          personId,
          daysBefore,
          reminderTime,
          enabled: true,
        })
        .returning();

      return inserted as unknown as BirthdayReminder;
    }
  }

  async addCustomBirthdayReminderOffset(
    userId: string,
    personId: string,
    daysBefore: number
  ): Promise<BirthdayReminder | null> {
    const isOwner = await this.verifyPersonOwnership(userId, personId);
    if (!isOwner) return null;

    if (daysBefore < 0 || !Number.isInteger(daysBefore)) {
      throw new Error("Offset days must be a positive integer.");
    }

    const [existing] = await this.database
      .select()
      .from(birthdayReminders)
      .where(and(eq(birthdayReminders.personId, personId), eq(birthdayReminders.daysBefore, daysBefore)))
      .limit(1);

    if (existing) {
      if (!existing.enabled) {
        const [updated] = await this.database
          .update(birthdayReminders)
          .set({ enabled: true, updatedAt: new Date() })
          .where(eq(birthdayReminders.id, existing.id))
          .returning();
        return updated as unknown as BirthdayReminder;
      }
      return existing as unknown as BirthdayReminder;
    }

    // Get person's current reminder time
    const [firstReminder] = await this.database
      .select({ reminderTime: birthdayReminders.reminderTime })
      .from(birthdayReminders)
      .where(eq(birthdayReminders.personId, personId))
      .limit(1);

    const reminderTime = firstReminder?.reminderTime || "09:00";

    const [inserted] = await this.database
      .insert(birthdayReminders)
      .values({
        personId,
        daysBefore,
        reminderTime,
        enabled: true,
      })
      .returning();

    return inserted as unknown as BirthdayReminder;
  }

  async setPersonBirthdayReminderTime(
    userId: string,
    personId: string,
    reminderTime: string
  ): Promise<void> {
    const isOwner = await this.verifyPersonOwnership(userId, personId);
    if (!isOwner) return;

    await this.database
      .update(birthdayReminders)
      .set({ reminderTime, updatedAt: new Date() })
      .where(eq(birthdayReminders.personId, personId));
  }

  async deleteBirthdayReminderOffset(
    userId: string,
    personId: string,
    daysBefore: number
  ): Promise<boolean> {
    const isOwner = await this.verifyPersonOwnership(userId, personId);
    if (!isOwner) return false;

    await this.database
      .delete(birthdayReminders)
      .where(and(eq(birthdayReminders.personId, personId), eq(birthdayReminders.daysBefore, daysBefore)));

    return true;
  }
}

export const birthdayService = new BirthdayService();
