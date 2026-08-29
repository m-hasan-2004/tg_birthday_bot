import fs from "fs";
import path from "path";
import { eq } from "drizzle-orm";
import { db, DB } from "../db/index.js";
import { users, people, notes, reminders, birthdayReminders } from "../db/schema.js";
import { userService } from "./user.service.js";
import { personService } from "./person.service.js";
import { noteService } from "./note.service.js";
import { reminderService } from "./reminder.service.js";
import { birthdayService } from "./birthday.service.js";
import { logger } from "../utils/logger.js";
import type { Person } from "../types/index.js";

export interface ImportPersonData {
  id?: string;
  name: string;
  birthday?: string | null;
  notes?: string[];
  birthdayReminders?: Array<{
    daysBefore: number;
    reminderTime?: string;
    enabled?: boolean;
  }>;
}

export interface ImportReminderData {
  id?: string;
  title: string;
  scheduledAt: string | Date;
  repeatType?: "none" | "daily" | "weekly" | "monthly" | "yearly";
  personName?: string;
}

export interface ImportUserData {
  id?: string;
  telegramId: string | number;
  name: string;
  birthday?: string | null;
  timezone?: string;
  role?: "user" | "admin" | "owner";
  people?: ImportPersonData[];
  reminders?: ImportReminderData[];
}

export interface ImportPayload {
  users: ImportUserData[];
}

export interface ImportResult {
  success: boolean;
  importedUsers: number;
  importedPeople: number;
  importedNotes: number;
  importedReminders: number;
  importedBirthdayReminders: number;
  errors: string[];
}

export class ImportService {
  constructor(private readonly database: DB = db) {}

  /**
   * Imports data safely and idempotently into PostgreSQL.
   */
  async importData(payload: ImportPayload): Promise<ImportResult> {
    const result: ImportResult = {
      success: true,
      importedUsers: 0,
      importedPeople: 0,
      importedNotes: 0,
      importedReminders: 0,
      importedBirthdayReminders: 0,
      errors: [],
    };

    if (!payload.users || !Array.isArray(payload.users)) {
      result.success = false;
      result.errors.push("Invalid payload: 'users' array is required.");
      return result;
    }

    for (const userData of payload.users) {
      try {
        if (!userData.telegramId || !userData.name) {
          result.errors.push(`Skipping invalid user: missing telegramId or name`);
          continue;
        }

        // 1. Create or Find User
        let user = await userService.findByTelegramId(userData.telegramId);
        if (!user) {
          user = await userService.createUser({
            telegramId: userData.telegramId,
            name: userData.name,
            birthday: userData.birthday,
            timezone: userData.timezone || "Europe/Berlin",
            role: userData.role,
          });
        } else {
          // Update profile with provided data
          user = await userService.updateProfile(user.id, {
            name: userData.name,
            birthday: userData.birthday !== undefined ? userData.birthday : user.birthday,
            timezone: userData.timezone || user.timezone,
            role: userData.role || user.role,
          });
        }

        if (!user) {
          result.errors.push(`Failed to create or update user ${userData.telegramId}`);
          continue;
        }
        result.importedUsers++;

        const userPersonMap = new Map<string, string>(); // name -> personId

        // 2. Import People
        if (userData.people && Array.isArray(userData.people)) {
          for (const pData of userData.people) {
            try {
              if (!pData.name) continue;

              // Check if person already exists for this user
              const existingPeople = await personService.listPeopleByUser(user.id);
              let person: Person | null | undefined = existingPeople.find(
                (p) => p.name.toLowerCase() === pData.name.trim().toLowerCase()
              );

              if (!person) {
                person = await personService.createPerson(user.id, {
                  name: pData.name.trim(),
                  birthday: pData.birthday || null,
                  note: pData.notes && pData.notes.length > 0 ? pData.notes[0] : null,
                });
              } else {
                // Update birthday if provided
                if (pData.birthday && pData.birthday !== person.birthday) {
                  person = await personService.updatePerson(user.id, person.id, {
                    birthday: pData.birthday,
                  });
                }
              }

              if (person) {
                userPersonMap.set(person.name.toLowerCase(), person.id);
                result.importedPeople++;

                // 3. Import additional Notes
                if (pData.notes && pData.notes.length > 1) {
                  const existingNotes = await noteService.listNotesByPerson(user.id, person.id);
                  for (let i = 1; i < pData.notes.length; i++) {
                    const noteContent = pData.notes[i];
                    if (!existingNotes.some((n) => n.content === noteContent)) {
                      await noteService.addNote(user.id, person.id, noteContent);
                      result.importedNotes++;
                    }
                  }
                }

                // 4. Import custom Birthday Reminders if provided
                if (pData.birthdayReminders && Array.isArray(pData.birthdayReminders)) {
                  for (const bRem of pData.birthdayReminders) {
                    await birthdayService.addCustomBirthdayReminderOffset(
                      user.id,
                      person.id,
                      bRem.daysBefore
                    );
                    result.importedBirthdayReminders++;
                  }
                }
              }
            } catch (pErr: any) {
              result.errors.push(`Error importing person ${pData.name}: ${pErr.message}`);
            }
          }
        }

        // 5. Import Reminders
        if (userData.reminders && Array.isArray(userData.reminders)) {
          for (const rData of userData.reminders) {
            try {
              if (!rData.title || !rData.scheduledAt) continue;

              let targetPersonId: string | null = null;
              if (rData.personName) {
                targetPersonId = userPersonMap.get(rData.personName.toLowerCase()) || null;
              }

              const existingReminders = await reminderService.listUpcomingRemindersByUser(user.id);
              const alreadyExists = existingReminders.some(
                (r) => r.title === rData.title.trim() && r.personId === targetPersonId
              );

              if (!alreadyExists) {
                await reminderService.createReminder(user.id, {
                  title: rData.title.trim(),
                  scheduledAt: new Date(rData.scheduledAt),
                  personId: targetPersonId,
                  repeatType: rData.repeatType || "none",
                });
                result.importedReminders++;
              }
            } catch (rErr: any) {
              result.errors.push(`Error importing reminder ${rData.title}: ${rErr.message}`);
            }
          }
        }
      } catch (uErr: any) {
        result.errors.push(`Error processing user ${userData.telegramId}: ${uErr.message}`);
      }
    }

    logger.info("Import process finished", result as unknown as Record<string, unknown>);
    return result;
  }

  /**
   * Imports data from a JSON file path.
   */
  async importFromFile(filePath: string): Promise<ImportResult> {
    if (!fs.existsSync(filePath)) {
      return {
        success: false,
        importedUsers: 0,
        importedPeople: 0,
        importedNotes: 0,
        importedReminders: 0,
        importedBirthdayReminders: 0,
        errors: [`File not found: ${filePath}`],
      };
    }

    const raw = fs.readFileSync(filePath, "utf-8");
    const payload = JSON.parse(raw) as ImportPayload;
    return this.importData(payload);
  }
}

export const importService = new ImportService();
