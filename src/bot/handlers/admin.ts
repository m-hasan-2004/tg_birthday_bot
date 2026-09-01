import { Composer, InlineKeyboard } from "grammy";
import type { BotContext } from "../context.js";
import { adminService } from "../../services/admin.service.js";
import { userService } from "../../services/user.service.js";
import { env } from "../../config/env.js";
import { db } from "../../db/index.js";
import { users } from "../../db/schema.js";
import { eq } from "drizzle-orm";

function escapeHtml(text: string): string {
  if (!text) return "";
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export const adminHandler = new Composer<BotContext>();

function isAuthorizedAdmin(ctx: BotContext): boolean {
  if (!ctx.user) return false;
  if (env.OWNER_TELEGRAM_ID && String(ctx.from?.id) === env.OWNER_TELEGRAM_ID.trim()) return true;
  return ctx.user.role === "admin" || ctx.user.role === "owner";
}

// 1. /admin command or menu_admin callback
async function renderAdminHome(ctx: BotContext) {
  if (!isAuthorizedAdmin(ctx)) {
    const text = "⛔ <b>Access Denied:</b> Administrator privileges required.";
    if (ctx.callbackQuery) {
      await ctx.answerCallbackQuery({ text: "Access Denied", show_alert: true });
      await ctx.editMessageText(text, { parse_mode: "HTML" }).catch(() => {});
    } else {
      await ctx.reply(text, { parse_mode: "HTML" });
    }
    return;
  }

  const stats = await adminService.getSystemStats();
  const text =
    `🛡️ <b>Administrator Control Panel</b>\n\n` +
    `Welcome, <b>${escapeHtml(ctx.user?.name || "Admin")}</b> (${ctx.user?.role?.toUpperCase()})\n\n` +
    `📊 <b>System Overview:</b>\n` +
    `• Users: <b>${stats.totalUsers}</b> (Active: ${stats.activeUsers}, Disabled: ${stats.disabledUsers})\n` +
    `• Contacts: <b>${stats.totalPeople}</b>\n` +
    `• Notes: <b>${stats.totalNotes}</b>\n` +
    `• Reminders: <b>${stats.totalReminders}</b> (Pending: ${stats.pendingReminders})\n` +
    `• Audit Logs: <b>${stats.totalAuditLogs}</b>\n\n` +
    `Select a management module below:`;

  const keyboard = new InlineKeyboard()
    .text("👥 Manage Users", "admin_users").row()
    .text("📊 Detailed Statistics", "admin_stats")
    .text("📜 Audit Logs", "admin_audits").row()
    .text("🏠 Back to Main Menu", "open_menu");

  if (ctx.callbackQuery) {
    await ctx.answerCallbackQuery();
    await ctx.editMessageText(text, {
      parse_mode: "HTML",
      reply_markup: keyboard,
    }).catch(() => {});
  } else {
    await ctx.reply(text, {
      parse_mode: "HTML",
      reply_markup: keyboard,
    });
  }
}

adminHandler.command("admin", renderAdminHome);
adminHandler.callbackQuery("menu_admin", renderAdminHome);

// 2. User Management List (admin_users)
adminHandler.callbackQuery("admin_users", async (ctx) => {
  if (!isAuthorizedAdmin(ctx)) {
    await ctx.answerCallbackQuery({ text: "Access Denied", show_alert: true });
    return;
  }

  await ctx.answerCallbackQuery();
  const { users: userList, total } = await adminService.listUsersWithDetails(undefined, 30, 0);

  let text = `👥 <b>User Management (${total} Total)</b>\n\nClick any user to view detailed information, change their role, or enable/disable their account:`;

  const keyboard = new InlineKeyboard();
  for (const u of userList) {
    const statusIcon = u.isDisabled ? "🚫" : u.role === "owner" ? "👑" : u.role === "admin" ? "🛡️" : "👤";
    const statusTag = u.isDisabled ? " [Disabled]" : "";
    keyboard.text(`${statusIcon} ${u.name} (${u.role})${statusTag}`, `admin_user_${u.id}`).row();
  }

  keyboard.text("🔄 Refresh List", "admin_users").row();
  keyboard.text("← Back to Admin Panel", "menu_admin");

  await ctx.editMessageText(text, {
    parse_mode: "HTML",
    reply_markup: keyboard,
  }).catch(() => {});
});

// 3. User Details View (admin_user_<userId>)
adminHandler.callbackQuery(/^admin_user_(.+)$/, async (ctx) => {
  if (!isAuthorizedAdmin(ctx)) {
    await ctx.answerCallbackQuery({ text: "Access Denied", show_alert: true });
    return;
  }

  const userId = ctx.match[1];
  const user = await userService.findById(userId);
  if (!user) {
    await ctx.answerCallbackQuery({ text: "User not found", show_alert: true });
    return;
  }

  await ctx.answerCallbackQuery();

  const { users: userList } = await adminService.listUsersWithDetails(user.telegramId, 1, 0);
  const details = userList.find((u) => u.id === userId) || { peopleCount: 0, remindersCount: 0 };

  const statusText = user.isDisabled ? "🚫 <b>Disabled</b>" : "✅ <b>Active</b>";
  const roleBadge = user.role === "owner" ? "👑 Owner" : user.role === "admin" ? "🛡️ Admin" : "👤 Standard User";

  const text =
    `👤 <b>User Details: ${escapeHtml(user.name)}</b>\n\n` +
    `• <b>Telegram ID:</b> <code>${user.telegramId}</code>\n` +
    `• <b>Role:</b> ${roleBadge}\n` +
    `• <b>Account Status:</b> ${statusText}\n` +
    `• <b>Timezone:</b> <code>${user.timezone}</code>\n` +
    `• <b>Birthday:</b> ${user.birthday || "Not set"}\n` +
    `• <b>Total Contacts:</b> <b>${details.peopleCount}</b>\n` +
    `• <b>Total Reminders:</b> <b>${details.remindersCount}</b>\n` +
    `• <b>Joined:</b> ${new Date(user.createdAt).toLocaleString()}\n`;

  const keyboard = new InlineKeyboard();

  if (user.role !== "owner") {
    // Enable/Disable toggle
    if (user.isDisabled) {
      keyboard.text("✅ Enable Account", `admin_status_${user.id}_enable`);
    } else {
      keyboard.text("🚫 Disable Account", `admin_status_${user.id}_disable`);
    }

    // Role toggle
    if (user.role === "admin") {
      keyboard.text("👤 Demote to User", `admin_role_${user.id}_user`);
    } else {
      keyboard.text("👑 Promote to Admin", `admin_role_${user.id}_admin`);
    }
    keyboard.row();

    // Delete user button
    keyboard.text("🗑 Delete User", `admin_del_confirm_${user.id}`).row();
  }

  keyboard.text("👥 ← User List", "admin_users");
  keyboard.text("🛡️ Admin Home", "menu_admin");

  await ctx.editMessageText(text, {
    parse_mode: "HTML",
    reply_markup: keyboard,
  }).catch(() => {});
});

// 4. Toggle Status (admin_status_<userId>_<enable|disable>)
adminHandler.callbackQuery(/^admin_status_(.+)_(enable|disable)$/, async (ctx) => {
  if (!isAuthorizedAdmin(ctx)) {
    await ctx.answerCallbackQuery({ text: "Access Denied", show_alert: true });
    return;
  }

  const userId = ctx.match[1];
  const action = ctx.match[2];
  const isDisabled = action === "disable";

  await adminService.setUserStatus(ctx.user!.id, userId, isDisabled);
  await ctx.answerCallbackQuery({
    text: `User account has been ${isDisabled ? "disabled 🚫" : "enabled ✅"}!`,
    show_alert: true,
  });

  // Return to user details view
  const user = await userService.findById(userId);
  if (user) {
    const { users: userList } = await adminService.listUsersWithDetails(user.telegramId, 1, 0);
    const details = userList.find((u) => u.id === userId) || { peopleCount: 0, remindersCount: 0 };
    const statusText = user.isDisabled ? "🚫 <b>Disabled</b>" : "✅ <b>Active</b>";
    const roleBadge = user.role === "owner" ? "👑 Owner" : user.role === "admin" ? "🛡️ Admin" : "👤 Standard User";

    const text =
      `👤 <b>User Details: ${escapeHtml(user.name)}</b>\n\n` +
      `• <b>Telegram ID:</b> <code>${user.telegramId}</code>\n` +
      `• <b>Role:</b> ${roleBadge}\n` +
      `• <b>Account Status:</b> ${statusText}\n` +
      `• <b>Timezone:</b> <code>${user.timezone}</code>\n` +
      `• <b>Birthday:</b> ${user.birthday || "Not set"}\n` +
      `• <b>Total Contacts:</b> <b>${details.peopleCount}</b>\n` +
      `• <b>Total Reminders:</b> <b>${details.remindersCount}</b>\n` +
      `• <b>Joined:</b> ${new Date(user.createdAt).toLocaleString()}\n`;

    const keyboard = new InlineKeyboard();
    if (user.isDisabled) {
      keyboard.text("✅ Enable Account", `admin_status_${user.id}_enable`);
    } else {
      keyboard.text("🚫 Disable Account", `admin_status_${user.id}_disable`);
    }

    if (user.role === "admin") {
      keyboard.text("👤 Demote to User", `admin_role_${user.id}_user`);
    } else {
      keyboard.text("👑 Promote to Admin", `admin_role_${user.id}_admin`);
    }
    keyboard.row();

    keyboard.text("🗑 Delete User", `admin_del_confirm_${user.id}`).row();
    keyboard.text("👥 ← User List", "admin_users");
    keyboard.text("🛡️ Admin Home", "menu_admin");

    await ctx.editMessageText(text, {
      parse_mode: "HTML",
      reply_markup: keyboard,
    }).catch(() => {});
  }
});

// 5. Change Role (admin_role_<userId>_<role>)
adminHandler.callbackQuery(/^admin_role_(.+)_(admin|user)$/, async (ctx) => {
  if (!isAuthorizedAdmin(ctx)) {
    await ctx.answerCallbackQuery({ text: "Access Denied", show_alert: true });
    return;
  }

  const userId = ctx.match[1];
  const newRole = ctx.match[2] as "admin" | "user";

  const result = await userService.setUserRole(ctx.user!.id, userId, newRole);
  if (!result.success) {
    await ctx.answerCallbackQuery({ text: result.error || "Failed to update role", show_alert: true });
    return;
  }

  await adminService.createAuditLog(
    ctx.user!.id,
    "USER_ROLE_CHANGED",
    "user",
    userId,
    { newRole }
  );

  await ctx.answerCallbackQuery({
    text: `User role changed to ${newRole.toUpperCase()}!`,
    show_alert: true,
  });

  const user = await userService.findById(userId);
  if (user) {
    const { users: userList } = await adminService.listUsersWithDetails(user.telegramId, 1, 0);
    const details = userList.find((u) => u.id === userId) || { peopleCount: 0, remindersCount: 0 };
    const statusText = user.isDisabled ? "🚫 <b>Disabled</b>" : "✅ <b>Active</b>";
    const roleBadge = user.role === "owner" ? "👑 Owner" : user.role === "admin" ? "🛡️ Admin" : "👤 Standard User";

    const text =
      `👤 <b>User Details: ${escapeHtml(user.name)}</b>\n\n` +
      `• <b>Telegram ID:</b> <code>${user.telegramId}</code>\n` +
      `• <b>Role:</b> ${roleBadge}\n` +
      `• <b>Account Status:</b> ${statusText}\n` +
      `• <b>Timezone:</b> <code>${user.timezone}</code>\n` +
      `• <b>Birthday:</b> ${user.birthday || "Not set"}\n` +
      `• <b>Total Contacts:</b> <b>${details.peopleCount}</b>\n` +
      `• <b>Total Reminders:</b> <b>${details.remindersCount}</b>\n` +
      `• <b>Joined:</b> ${new Date(user.createdAt).toLocaleString()}\n`;

    const keyboard = new InlineKeyboard();
    if (user.isDisabled) {
      keyboard.text("✅ Enable Account", `admin_status_${user.id}_enable`);
    } else {
      keyboard.text("🚫 Disable Account", `admin_status_${user.id}_disable`);
    }

    if (user.role === "admin") {
      keyboard.text("👤 Demote to User", `admin_role_${user.id}_user`);
    } else {
      keyboard.text("👑 Promote to Admin", `admin_role_${user.id}_admin`);
    }
    keyboard.row();

    keyboard.text("🗑 Delete User", `admin_del_confirm_${user.id}`).row();
    keyboard.text("👥 ← User List", "admin_users");
    keyboard.text("🛡️ Admin Home", "menu_admin");

    await ctx.editMessageText(text, {
      parse_mode: "HTML",
      reply_markup: keyboard,
    }).catch(() => {});
  }
});

// 6. Delete User Confirmation
adminHandler.callbackQuery(/^admin_del_confirm_(.+)$/, async (ctx) => {
  if (!isAuthorizedAdmin(ctx)) {
    await ctx.answerCallbackQuery({ text: "Access Denied", show_alert: true });
    return;
  }

  const userId = ctx.match[1];
  const user = await userService.findById(userId);
  if (!user || user.role === "owner") {
    await ctx.answerCallbackQuery({ text: "Cannot delete this user.", show_alert: true });
    return;
  }

  await ctx.answerCallbackQuery();
  const text =
    `⚠️ <b>Delete User Confirmation</b>\n\n` +
    `Are you sure you want to permanently delete user <b>${escapeHtml(user.name)}</b> (<code>${user.telegramId}</code>)?\n\n` +
    `<i>This will permanently delete all their contacts, notes, and reminders.</i>`;

  const keyboard = new InlineKeyboard()
    .text("❌ Yes, Permanently Delete", `admin_del_execute_${user.id}`).row()
    .text("← Cancel", `admin_user_${user.id}`);

  await ctx.editMessageText(text, {
    parse_mode: "HTML",
    reply_markup: keyboard,
  }).catch(() => {});
});

// 7. Execute Delete User
adminHandler.callbackQuery(/^admin_del_execute_(.+)$/, async (ctx) => {
  if (!isAuthorizedAdmin(ctx)) {
    await ctx.answerCallbackQuery({ text: "Access Denied", show_alert: true });
    return;
  }

  const userId = ctx.match[1];
  const user = await userService.findById(userId);
  if (!user || user.role === "owner") {
    await ctx.answerCallbackQuery({ text: "Cannot delete this user.", show_alert: true });
    return;
  }

  await db.delete(users).where(eq(users.id, userId));
  await adminService.createAuditLog(
    ctx.user!.id,
    "USER_DELETED",
    "user",
    userId,
    { userName: user.name, telegramId: user.telegramId }
  );

  await ctx.answerCallbackQuery({ text: "User has been permanently deleted.", show_alert: true });

  // Return to users list
  const { users: userList, total } = await adminService.listUsersWithDetails(undefined, 30, 0);
  let text = `👥 <b>User Management (${total} Total)</b>\n\nClick any user to view detailed information, change their role, or enable/disable their account:`;

  const keyboard = new InlineKeyboard();
  for (const u of userList) {
    const statusIcon = u.isDisabled ? "🚫" : u.role === "owner" ? "👑" : u.role === "admin" ? "🛡️" : "👤";
    const statusTag = u.isDisabled ? " [Disabled]" : "";
    keyboard.text(`${statusIcon} ${u.name} (${u.role})${statusTag}`, `admin_user_${u.id}`).row();
  }

  keyboard.text("🔄 Refresh List", "admin_users").row();
  keyboard.text("← Back to Admin Panel", "menu_admin");

  await ctx.editMessageText(text, {
    parse_mode: "HTML",
    reply_markup: keyboard,
  }).catch(() => {});
});

// 8. Detailed Statistics (admin_stats)
adminHandler.callbackQuery("admin_stats", async (ctx) => {
  if (!isAuthorizedAdmin(ctx)) {
    await ctx.answerCallbackQuery({ text: "Access Denied", show_alert: true });
    return;
  }

  await ctx.answerCallbackQuery();
  const stats = await adminService.getSystemStats();

  const text =
    `📊 <b>Detailed System Statistics (Neon PostgreSQL)</b>\n\n` +
    `👥 <b>User Metrics:</b>\n` +
    `• Total Registered Users: <b>${stats.totalUsers}</b>\n` +
    `• Active Users: <b>${stats.activeUsers}</b>\n` +
    `• Disabled Accounts: <b>${stats.disabledUsers}</b>\n\n` +
    `📇 <b>Data Metrics:</b>\n` +
    `• Total Saved Contacts: <b>${stats.totalPeople}</b>\n` +
    `• Total Contact Notes: <b>${stats.totalNotes}</b>\n` +
    `• Total Reminders: <b>${stats.totalReminders}</b>\n` +
    `• Active/Pending Reminders: <b>${stats.pendingReminders}</b>\n` +
    `• Completed Reminders: <b>${stats.completedReminders}</b>\n\n` +
    `📜 <b>System Events:</b>\n` +
    `• Recorded Audit Logs: <b>${stats.totalAuditLogs}</b>`;

  const keyboard = new InlineKeyboard()
    .text("🔄 Refresh Statistics", "admin_stats").row()
    .text("← Back to Admin Panel", "menu_admin");

  await ctx.editMessageText(text, {
    parse_mode: "HTML",
    reply_markup: keyboard,
  }).catch(() => {});
});

// 9. Audit Logs View (admin_audits)
adminHandler.callbackQuery("admin_audits", async (ctx) => {
  if (!isAuthorizedAdmin(ctx)) {
    await ctx.answerCallbackQuery({ text: "Access Denied", show_alert: true });
    return;
  }

  await ctx.answerCallbackQuery();
  const logs = await adminService.getAuditLogs(15);

  let text = `📜 <b>Recent Audit Logs (Last 15 Events)</b>\n\n`;
  if (logs.length === 0) {
    text += `<i>No administrative actions recorded yet.</i>`;
  } else {
    for (const l of logs) {
      const timeStr = new Date(l.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
      text += `• <b>${escapeHtml(l.action)}</b> on <code>${escapeHtml(l.targetType)}</code> at ${timeStr}\n`;
    }
  }

  const keyboard = new InlineKeyboard()
    .text("🔄 Refresh Logs", "admin_audits").row()
    .text("← Back to Admin Panel", "menu_admin");

  await ctx.editMessageText(text, {
    parse_mode: "HTML",
    reply_markup: keyboard,
  }).catch(() => {});
});
