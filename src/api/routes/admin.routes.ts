import { Hono } from "hono";
import { authService } from "../../services/auth.service.js";
import { userService } from "../../services/user.service.js";
import { adminService } from "../../services/admin.service.js";
import { logger } from "../../utils/logger.js";

type AdminEnv = {
  Variables: {
    adminUserId: string;
  };
};

export const adminRoutes = new Hono<AdminEnv>();

// Admin Auth Middleware
adminRoutes.use("*", async (c, next) => {
  const authHeader = c.req.header("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const token = authHeader.replace("Bearer ", "").trim();
  const session = authService.verifySessionToken(token);
  if (!session || !session.userId) {
    return c.json({ error: "Invalid or expired session token" }, 401);
  }

  const user = await userService.findById(session.userId);
  if (!user || user.isDisabled) {
    return c.json({ error: "Account disabled or not found" }, 403);
  }

  if (user.role !== "admin" && user.role !== "owner") {
    logger.warn(`Unauthorized admin access attempt by user ${user.id} (role: ${user.role})`);
    return c.json({ error: "Forbidden: Administrator privileges required." }, 403);
  }

  c.set("adminUserId", user.id);
  await next();
});

// 1. System Statistics
adminRoutes.get("/stats", async (c) => {
  try {
    const stats = await adminService.getSystemStats();
    return c.json({ stats });
  } catch (error) {
    logger.error("Error fetching admin stats:", error);
    return c.json({ error: "Failed to fetch admin stats" }, 500);
  }
});

// 2. List & Search Users
adminRoutes.get("/users", async (c) => {
  try {
    const search = c.req.query("search");
    const limit = parseInt(c.req.query("limit") || "50", 10);
    const offset = parseInt(c.req.query("offset") || "0", 10);

    const result = await adminService.listUsersWithDetails(search, limit, offset);
    return c.json(result);
  } catch (error) {
    logger.error("Error listing users:", error);
    return c.json({ error: "Failed to list users" }, 500);
  }
});

// 3. Disable User
adminRoutes.post("/users/:id/disable", async (c) => {
  try {
    const adminUserId = c.get("adminUserId");
    const targetUserId = c.req.param("id");

    const updated = await adminService.setUserStatus(adminUserId, targetUserId, true);
    if (!updated) return c.json({ error: "User not found" }, 404);

    return c.json({ success: true, user: updated });
  } catch (error) {
    logger.error("Error disabling user:", error);
    return c.json({ error: "Failed to disable user" }, 500);
  }
});

// 4. Enable User
adminRoutes.post("/users/:id/enable", async (c) => {
  try {
    const adminUserId = c.get("adminUserId");
    const targetUserId = c.req.param("id");

    const updated = await adminService.setUserStatus(adminUserId, targetUserId, false);
    if (!updated) return c.json({ error: "User not found" }, 404);

    return c.json({ success: true, user: updated });
  } catch (error) {
    logger.error("Error enabling user:", error);
    return c.json({ error: "Failed to enable user" }, 500);
  }
});

// 5. Audit Logs
adminRoutes.get("/audit-logs", async (c) => {
  try {
    const limit = parseInt(c.req.query("limit") || "50", 10);
    const logs = await adminService.getAuditLogs(limit);
    return c.json({ auditLogs: logs });
  } catch (error) {
    logger.error("Error fetching audit logs:", error);
    return c.json({ error: "Failed to fetch audit logs" }, 500);
  }
});

// 6. Broadcast Message (Safe test & Preview mode)
adminRoutes.post("/broadcast", async (c) => {
  try {
    const adminUserId = c.get("adminUserId");
    const { message, isPreview } = await c.req.json();

    if (!message || typeof message !== "string") {
      return c.json({ error: "Message content is required" }, 400);
    }

    const { total } = await userService.listAllUsers();

    if (isPreview) {
      return c.json({
        preview: true,
        recipientCount: total,
        formattedMessage: message,
      });
    }

    await adminService.createAuditLog(adminUserId, "BROADCAST_SENT", "system", null, {
      messagePreview: message.slice(0, 100),
      recipientCount: total,
    });

    return c.json({
      success: true,
      recipientCount: total,
      message: "Broadcast scheduled.",
    });
  } catch (error) {
    logger.error("Error in admin broadcast:", error);
    return c.json({ error: "Failed to execute broadcast" }, 500);
  }
});
