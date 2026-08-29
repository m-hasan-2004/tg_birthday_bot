import { and, count, desc, eq, ilike, or } from "drizzle-orm";
import { db, DB } from "../db/index.js";
import { users, people, notes, reminders, auditLogs } from "../db/schema.js";
import type { AuditLog, User } from "../types/index.js";
import { logger } from "../utils/logger.js";

export interface SystemStats {
  totalUsers: number;
  activeUsers: number;
  disabledUsers: number;
  totalPeople: number;
  totalNotes: number;
  totalReminders: number;
  pendingReminders: number;
  completedReminders: number;
  totalAuditLogs: number;
}

export interface UserSummaryItem extends User {
  peopleCount: number;
  remindersCount: number;
}

export class AdminService {
  constructor(private readonly database: DB = db) {}

  /**
   * Computes accurate live system statistics from PostgreSQL.
   */
  async getSystemStats(): Promise<SystemStats> {
    const [totalUsersRes] = await this.database.select({ count: count() }).from(users);
    const [activeUsersRes] = await this.database
      .select({ count: count() })
      .from(users)
      .where(eq(users.isDisabled, false));
    const [disabledUsersRes] = await this.database
      .select({ count: count() })
      .from(users)
      .where(eq(users.isDisabled, true));

    const [totalPeopleRes] = await this.database.select({ count: count() }).from(people);
    const [totalNotesRes] = await this.database.select({ count: count() }).from(notes);
    const [totalRemindersRes] = await this.database.select({ count: count() }).from(reminders);
    const [pendingRemindersRes] = await this.database
      .select({ count: count() })
      .from(reminders)
      .where(eq(reminders.status, "pending"));
    const [completedRemindersRes] = await this.database
      .select({ count: count() })
      .from(reminders)
      .where(eq(reminders.status, "completed"));

    const [totalAuditLogsRes] = await this.database.select({ count: count() }).from(auditLogs);

    return {
      totalUsers: Number(totalUsersRes?.count || 0),
      activeUsers: Number(activeUsersRes?.count || 0),
      disabledUsers: Number(disabledUsersRes?.count || 0),
      totalPeople: Number(totalPeopleRes?.count || 0),
      totalNotes: Number(totalNotesRes?.count || 0),
      totalReminders: Number(totalRemindersRes?.count || 0),
      pendingReminders: Number(pendingRemindersRes?.count || 0),
      completedReminders: Number(completedRemindersRes?.count || 0),
      totalAuditLogs: Number(totalAuditLogsRes?.count || 0),
    };
  }

  /**
   * Lists users with search and aggregated counters.
   */
  async listUsersWithDetails(
    search?: string,
    limit: number = 50,
    offset: number = 0
  ): Promise<{ users: UserSummaryItem[]; total: number }> {
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

    const detailedUsers: UserSummaryItem[] = [];

    for (const u of userList) {
      const [peopleCountRes] = await this.database
        .select({ count: count() })
        .from(people)
        .where(eq(people.userId, u.id));

      const [remindersCountRes] = await this.database
        .select({ count: count() })
        .from(reminders)
        .where(eq(reminders.userId, u.id));

      detailedUsers.push({
        ...(u as unknown as User),
        peopleCount: Number(peopleCountRes?.count || 0),
        remindersCount: Number(remindersCountRes?.count || 0),
      });
    }

    return {
      users: detailedUsers,
      total: Number(totalCount?.count || 0),
    };
  }

  /**
   * Toggles user enable/disable status and writes audit log.
   */
  async setUserStatus(
    adminUserId: string,
    targetUserId: string,
    isDisabled: boolean
  ): Promise<User | null> {
    const [updated] = await this.database
      .update(users)
      .set({ isDisabled, updatedAt: new Date() })
      .where(eq(users.id, targetUserId))
      .returning();

    if (updated) {
      await this.createAuditLog(
        adminUserId,
        isDisabled ? "USER_DISABLED" : "USER_ENABLED",
        "user",
        targetUserId,
        { userName: updated.name, telegramId: updated.telegramId }
      );
    }

    return (updated as unknown as User) || null;
  }

  /**
   * Records an audit log entry.
   */
  async createAuditLog(
    adminUserId: string | null,
    action: string,
    targetType: string,
    targetId: string | null,
    details?: Record<string, unknown>
  ): Promise<AuditLog> {
    const [inserted] = await this.database
      .insert(auditLogs)
      .values({
        adminId: adminUserId,
        action,
        targetType,
        targetId,
        details: details || null,
      })
      .returning();

    logger.info(`Audit Log: [${action}] by Admin ${adminUserId || "System"} on ${targetType}:${targetId}`);

    return inserted as unknown as AuditLog;
  }

  /**
   * Fetches recent audit logs.
   */
  async getAuditLogs(limit: number = 50): Promise<AuditLog[]> {
    const results = await this.database
      .select()
      .from(auditLogs)
      .orderBy(desc(auditLogs.createdAt))
      .limit(limit);

    return results as unknown as AuditLog[];
  }
}

export const adminService = new AdminService();
