import { and, eq, count } from "drizzle-orm";
import { db, DB } from "../db/index.js";
import { people, notes, reminders, birthdayReminders } from "../db/schema.js";
import type { Person } from "../types/index.js";

export interface PersonWithDetails extends Person {
  notesCount: number;
  remindersCount: number;
  firstNote?: string | null;
}

export class PersonService {
  constructor(private readonly database: DB = db) {}

  async createPerson(
    userId: string,
    data: {
      name: string;
      birthday?: string | null;
      note?: string | null;
    }
  ): Promise<Person> {
    const [person] = await this.database
      .insert(people)
      .values({
        userId,
        name: data.name.trim(),
        birthday: data.birthday ? data.birthday.trim() : null,
      })
      .returning();

    // If initial note provided, add note
    if (data.note && data.note.trim().length > 0) {
      await this.database.insert(notes).values({
        personId: person.id,
        content: data.note.trim(),
      });
    }

    // If birthday provided, initialize default birthday reminder offset: 0 days before (On the day)
    if (person.birthday) {
      const defaultOffsets = [0];
      const bdayReminderRows = defaultOffsets.map((daysBefore) => ({
        personId: person.id,
        daysBefore,
        reminderTime: "09:00",
        enabled: true,
      }));
      await this.database.insert(birthdayReminders).values(bdayReminderRows);
    }

    return person as unknown as Person;
  }

  async getPersonById(userId: string, personId: string): Promise<PersonWithDetails | null> {
    const personResult = await this.database
      .select()
      .from(people)
      .where(and(eq(people.id, personId), eq(people.userId, userId)))
      .limit(1);

    if (personResult.length === 0) return null;
    const person = personResult[0] as unknown as Person;

    // Get note count and first note
    const personNotes = await this.database
      .select()
      .from(notes)
      .where(eq(notes.personId, personId));

    // Get reminders count
    const [remindersCountRes] = await this.database
      .select({ count: count() })
      .from(reminders)
      .where(and(eq(reminders.personId, personId), eq(reminders.status, "pending")));

    return {
      ...person,
      notesCount: personNotes.length,
      firstNote: personNotes.length > 0 ? personNotes[0].content : null,
      remindersCount: Number(remindersCountRes?.count || 0),
    };
  }

  async listPeopleByUser(userId: string): Promise<Person[]> {
    const results = await this.database
      .select()
      .from(people)
      .where(eq(people.userId, userId))
      .orderBy(people.name);

    return results as unknown as Person[];
  }

  async updatePerson(
    userId: string,
    personId: string,
    data: {
      name?: string;
      birthday?: string | null;
    }
  ): Promise<Person | null> {
    // Verify ownership
    const existing = await this.getPersonById(userId, personId);
    if (!existing) return null;

    const updatePayload: Partial<typeof people.$inferInsert> = {
      updatedAt: new Date(),
    };

    if (data.name !== undefined) {
      updatePayload.name = data.name.trim();
    }
    if (data.birthday !== undefined) {
      const newBirthday = data.birthday ? data.birthday.trim() : null;
      updatePayload.birthday = newBirthday;

      // If birthday was added or changed, and there were no birthday reminders yet, init defaults
      if (newBirthday && !existing.birthday) {
        const existingOffsets = await this.database
          .select()
          .from(birthdayReminders)
          .where(eq(birthdayReminders.personId, personId));

        if (existingOffsets.length === 0) {
          const defaultOffsets = [0];
          await this.database.insert(birthdayReminders).values(
            defaultOffsets.map((daysBefore) => ({
              personId,
              daysBefore,
              reminderTime: "09:00",
              enabled: true,
            }))
          );
        }
      }
    }

    const [updated] = await this.database
      .update(people)
      .set(updatePayload)
      .where(and(eq(people.id, personId), eq(people.userId, userId)))
      .returning();

    return (updated as unknown as Person) || null;
  }

  async deletePerson(userId: string, personId: string): Promise<boolean> {
    // Verify ownership
    const existing = await this.getPersonById(userId, personId);
    if (!existing) return false;

    await this.database
      .delete(people)
      .where(and(eq(people.id, personId), eq(people.userId, userId)));

    return true;
  }
}

export const personService = new PersonService();
