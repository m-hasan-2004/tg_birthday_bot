import { eq, ilike, or, count, desc } from "drizzle-orm";
import { db, DB } from "../db/index.js";
import { users } from "../db/schema.js";
import type { SessionState, User, UserRole } from "../types/index.js";
import { isValidTimezone } from "../utils/dates.js";
import { env } from "../config/env.js";

export class UserService {
  constructor(private readonly database: DB = db) {}

  /**
   * Deterministically resolves role based on server-side OWNER_TELEGRAM_ID and ADMIN_TELEGRAM_IDS
   */
  resolveUserRole(telegramId: string | number): UserRole {
    const tid = String(telegramId).trim();
    if (env.OWNER_TELEGRAM_ID && tid === env.OWNER_TELEGRAM_ID.trim()) {
      return "owner";
    }
    if (env.ADMIN_TELEGRAM_IDS) {
      const adminIds = env.ADMIN_TELEGRAM_IDS.split(",").map((s) => s.trim());
      if (adminIds.includes(tid)) {
        return "admin";
      }
    }
    return "user";
  }

  async findByTelegramId(telegramId: string | number): Promise<User | null> {
    const tid = String(telegramId);
    const result = await this.database
      .select()
      .from(users)
      .where(eq(users.telegramId, tid))
      .limit(1);

    if (result.length === 0) return null;

    const user = result[0] as unknown as User;
    // Always ensure owner role if telegram ID matches configured owner
    const computedRole = this.resolveUserRole(tid);
    if (computedRole === "owner" && user.role !== "owner") {
      await this.database.update(users).set({ role: "owner" }).where(eq(users.id, user.id));
      user.role = "owner";
    }

    return user;
  }

  async findById(userId: string): Promise<User | null> {
    const result = await this.database
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (result.length === 0) return null;
    return result[0] as unknown as User;
  }

  async createUser(data: {
    telegramId: string | number;
    name: string;
    birthday?: string | null;
    additionalInfo?: string | null;
    timezone?: string;
    role?: UserRole;
  }): Promise<User> {
    const tid = String(data.telegramId);
    const tz = data.timezone && isValidTimezone(data.timezone) ? data.timezone : "Europe/Berlin";
    const assignedRole = data.role || this.resolveUserRole(tid);

    const [inserted] = await this.database
      .insert(users)
      .values({
        telegramId: tid,
        name: data.name.trim(),
        birthday: data.birthday ? data.birthday.trim() : null,
        additionalInfo: data.additionalInfo ? data.additionalInfo.trim() : null,
        timezone: tz,
        role: assignedRole,
        isDisabled: false,
        sessionState: null,
      })
      .returning();

    return inserted as unknown as User;
  }

  async updateProfile(
    userId: string,
    data: {
      name?: string;
      birthday?: string | null;
      additionalInfo?: string | null;
      timezone?: string;
      role?: UserRole;
      isDisabled?: boolean;
    }
  ): Promise<User | null> {
    const updatePayload: Partial<typeof users.$inferInsert> = {
      updatedAt: new Date(),
    };

    if (data.name !== undefined) {
      updatePayload.name = data.name.trim();
    }
    if (data.birthday !== undefined) {
      updatePayload.birthday = data.birthday ? data.birthday.trim() : null;
    }
    if (data.additionalInfo !== undefined) {
      updatePayload.additionalInfo = data.additionalInfo ? data.additionalInfo.trim() : null;
    }
    if (data.timezone !== undefined) {
      if (isValidTimezone(data.timezone)) {
        updatePayload.timezone = data.timezone.trim();
      }
    }
    if (data.role !== undefined) {
      updatePayload.role = data.role;
    }
    if (data.isDisabled !== undefined) {
      updatePayload.isDisabled = data.isDisabled;
    }

    const [updated] = await this.database
      .update(users)
      .set(updatePayload)
      .where(eq(users.id, userId))
      .returning();

    return (updated as unknown as User) || null;
  }

  async listAllUsers(
    search?: string,
    limit: number = 50,
    offset: number = 0
  ): Promise<{ users: User[]; total: number }> {
    const whereClause = search
      ? or(ilike(users.name, `%${search}%`), ilike(users.telegramId, `%${search}%`))
      : undefined;

    const [totalCount] = await this.database
      .select({ count: count() })
      .from(users)
      .where(whereClause);

    const userList = await this.database
      .select()
      .from(users)
      .where(whereClause)
      .orderBy(desc(users.createdAt))
      .limit(limit)
      .offset(offset);

    return {
      users: userList as unknown as User[],
      total: Number(totalCount?.count || 0),
    };
  }

  async setUserDisabled(userId: string, isDisabled: boolean): Promise<User | null> {
    const [updated] = await this.database
      .update(users)
      .set({ isDisabled, updatedAt: new Date() })
      .where(eq(users.id, userId))
      .returning();

    return (updated as unknown as User) || null;
  }

  async setUserRole(
    adminUserId: string,
    targetUserId: string,
    newRole: UserRole
  ): Promise<{ success: boolean; user?: User; error?: string }> {
    const targetUser = await this.findById(targetUserId);
    if (!targetUser) return { success: false, error: "User not found" };

    const adminUser = await this.findById(adminUserId);
    if (!adminUser || (adminUser.role !== "owner" && adminUser.role !== "admin")) {
      return { success: false, error: "Unauthorized" };
    }

    // Owner cannot be demoted
    if (targetUser.role === "owner" && newRole !== "owner") {
      return { success: false, error: "The Owner account cannot be demoted." };
    }

    // Only owner can promote someone to owner or admin
    if (newRole === "owner" && adminUser.role !== "owner") {
      return { success: false, error: "Only the Owner can assign the Owner role." };
    }

    const [updated] = await this.database
      .update(users)
      .set({ role: newRole, updatedAt: new Date() })
      .where(eq(users.id, targetUserId))
      .returning();

    return { success: true, user: updated as unknown as User };
  }

  async getSessionState(userId: string): Promise<SessionState | null> {
    const user = await this.findById(userId);
    return user?.sessionState || null;
  }

  async setSessionState(userId: string, state: SessionState | null): Promise<void> {
    await this.database
      .update(users)
      .set({ sessionState: state as unknown as Record<string, unknown>, updatedAt: new Date() })
      .where(eq(users.id, userId));
  }

  async clearSessionState(userId: string): Promise<void> {
    await this.setSessionState(userId, null);
  }
}

export const userService = new UserService();
