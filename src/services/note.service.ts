import { and, eq } from "drizzle-orm";
import { db, DB } from "../db/index.js";
import { notes, people } from "../db/schema.js";
import type { Note } from "../types/index.js";

export class NoteService {
  constructor(private readonly database: DB = db) {}

  private async verifyPersonOwnership(userId: string, personId: string): Promise<boolean> {
    const [person] = await this.database
      .select({ id: people.id })
      .from(people)
      .where(and(eq(people.id, personId), eq(people.userId, userId)))
      .limit(1);

    return Boolean(person);
  }

  async addNote(userId: string, personId: string, content: string): Promise<Note | null> {
    const isOwner = await this.verifyPersonOwnership(userId, personId);
    if (!isOwner) return null;

    const [note] = await this.database
      .insert(notes)
      .values({
        personId,
        content: content.trim(),
      })
      .returning();

    return note as unknown as Note;
  }

  async getNoteById(userId: string, noteId: string): Promise<Note | null> {
    const result = await this.database
      .select({
        id: notes.id,
        personId: notes.personId,
        content: notes.content,
        createdAt: notes.createdAt,
        updatedAt: notes.updatedAt,
      })
      .from(notes)
      .innerJoin(people, eq(notes.personId, people.id))
      .where(and(eq(notes.id, noteId), eq(people.userId, userId)))
      .limit(1);

    if (result.length === 0) return null;
    return result[0] as unknown as Note;
  }

  async listNotesByPerson(userId: string, personId: string): Promise<Note[]> {
    const isOwner = await this.verifyPersonOwnership(userId, personId);
    if (!isOwner) return [];

    const result = await this.database
      .select()
      .from(notes)
      .where(eq(notes.personId, personId))
      .orderBy(notes.createdAt);

    return result as unknown as Note[];
  }

  async updateNote(userId: string, noteId: string, content: string): Promise<Note | null> {
    const existing = await this.getNoteById(userId, noteId);
    if (!existing) return null;

    const [updated] = await this.database
      .update(notes)
      .set({
        content: content.trim(),
        updatedAt: new Date(),
      })
      .where(eq(notes.id, noteId))
      .returning();

    return (updated as unknown as Note) || null;
  }

  async deleteNote(userId: string, noteId: string): Promise<boolean> {
    const existing = await this.getNoteById(userId, noteId);
    if (!existing) return false;

    await this.database.delete(notes).where(eq(notes.id, noteId));
    return true;
  }
}

export const noteService = new NoteService();
