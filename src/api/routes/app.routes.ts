import { Hono } from "hono";
import { authService } from "../../services/auth.service.js";
import { userService } from "../../services/user.service.js";
import { personService } from "../../services/person.service.js";
import { noteService } from "../../services/note.service.js";
import { reminderService } from "../../services/reminder.service.js";
import { birthdayService } from "../../services/birthday.service.js";
import { getNextBirthday, formatBirthday, formatReminderDate } from "../../utils/dates.js";
import { logger } from "../../utils/logger.js";
import { DateTime } from "luxon";
import { env } from "../../config/env.js";

type AppEnv = {
  Variables: {
    userId: string;
  };
};

export const appRoutes = new Hono<AppEnv>();

appRoutes.onError((err, c) => {
  logger.error(`App Route Error on [${c.req.method}] ${c.req.path}:`, err);
  return c.json({
    error: err.message || "Internal server error",
    details: String(err),
    stack: err.stack,
    path: c.req.path,
    method: c.req.method,
  }, 500);
});

// Auth Middleware for all application API routes
appRoutes.use("*", async (c, next) => {
  const authHeader = c.req.header("Authorization") || c.req.header("authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    logger.warn(`Auth failed: missing or invalid Bearer header for ${c.req.path}. AuthHeader: ${authHeader}`);
    return c.json({ error: "Unauthorized: Missing or invalid Bearer token" }, 401);
  }

  const token = authHeader.replace("Bearer ", "").trim();
  const session = authService.verifySessionToken(token);
  if (!session || !session.userId) {
    logger.warn(`Auth failed: invalid or expired session token for ${c.req.path}`);
    return c.json({ error: "Invalid or expired session token" }, 401);
  }

  const user = await userService.findById(session.userId);
  if (!user || user.isDisabled) {
    logger.warn(`Auth failed: user disabled or not found for ID ${session.userId}`);
    return c.json({ error: "Your account has been disabled or not found." }, 403);
  }

  c.set("userId", session.userId);
  await next();
});

// 1. Dashboard Aggregator
appRoutes.get("/dashboard", async (c) => {
  try {
    const userId = c.get("userId");
    const user = await userService.findById(userId);
    if (!user) return c.json({ error: "User not found" }, 404);

    const peopleList = await personService.listPeopleByUser(userId);
    const upcomingReminders = await reminderService.listUpcomingRemindersByUser(userId);

    const upcomingBirthdays: Array<{
      personId: string;
      name: string;
      birthday: string;
      formattedBirthday: string;
      daysUntil: number;
    }> = [];

    for (const p of peopleList) {
      if (p.birthday) {
        const nextBday = getNextBirthday(p.birthday, user.timezone);
        if (nextBday) {
          upcomingBirthdays.push({
            personId: p.id,
            name: p.name,
            birthday: p.birthday,
            formattedBirthday: formatBirthday(p.birthday),
            daysUntil: nextBday.daysUntil,
          });
        }
      }
    }

    upcomingBirthdays.sort((a, b) => a.daysUntil - b.daysUntil);

    const formattedReminders = upcomingReminders.map((r) => {
      const { dateStr, timeStr } = formatReminderDate(r.scheduledAt, user.timezone);
      return {
        id: r.id,
        title: r.title,
        personId: r.personId,
        personName: r.personName,
        isBirthdayReminder: r.isBirthdayReminder,
        dateStr,
        timeStr,
        repeatType: r.repeatType,
      };
    });

    return c.json({
      user: {
        id: user.id,
        name: user.name,
        birthday: user.birthday ? formatBirthday(user.birthday) : null,
        timezone: user.timezone,
        role: user.role,
      },
      stats: {
        peopleCount: peopleList.length,
        remindersCount: upcomingReminders.length,
      },
      upcomingBirthdays: upcomingBirthdays.slice(0, 5),
      upcomingReminders: formattedReminders.slice(0, 10),
    });
  } catch (err: any) {
    logger.error("Error fetching dashboard:", err);
    return c.json({ error: err?.message || "Failed to fetch dashboard", details: String(err) }, 500);
  }
});

// 2. Profile
appRoutes.get("/profile", async (c) => {
  const userId = c.get("userId");
  const user = await userService.findById(userId);
  if (!user) return c.json({ error: "User not found" }, 404);

  return c.json({ user });
});

appRoutes.put("/profile", async (c) => {
  const userId = c.get("userId");
  const body = await c.req.json();
  const updated = await userService.updateProfile(userId, body);
  return c.json({ user: updated });
});

// 3. People
appRoutes.get("/people", async (c) => {
  const userId = c.get("userId");
  const peopleList = await personService.listPeopleByUser(userId);
  const formatted = peopleList.map((p) => ({
    ...p,
    formattedBirthday: p.birthday ? formatBirthday(p.birthday) : null,
  }));
  return c.json({ people: formatted });
});

appRoutes.post("/people", async (c) => {
  const userId = c.get("userId");
  const { name, birthday, note } = await c.req.json();
  if (!name || typeof name !== "string") {
    return c.json({ error: "Name is required" }, 400);
  }

  const person = await personService.createPerson(userId, { name, birthday, note });
  return c.json({ person }, 201);
});

appRoutes.get("/people/:id", async (c) => {
  const userId = c.get("userId");
  const personId = c.req.param("id");
  const person = await personService.getPersonById(userId, personId);
  if (!person) return c.json({ error: "Person not found" }, 404);

  const notes = await noteService.listNotesByPerson(userId, personId);
  const birthdayReminders = await birthdayService.getBirthdayRemindersForPerson(userId, personId);

  return c.json({
    person: {
      ...person,
      formattedBirthday: person.birthday ? formatBirthday(person.birthday) : null,
    },
    notes,
    birthdayReminders,
  });
});

appRoutes.put("/people/:id", async (c) => {
  const userId = c.get("userId");
  const personId = c.req.param("id");
  const body = await c.req.json();
  const updated = await personService.updatePerson(userId, personId, body);
  if (!updated) return c.json({ error: "Person not found" }, 404);
  return c.json({ person: updated });
});

appRoutes.delete("/people/:id", async (c) => {
  const userId = c.get("userId");
  const personId = c.req.param("id");
  const success = await personService.deletePerson(userId, personId);
  return c.json({ success });
});

// 4. Notes
appRoutes.get("/people/:id/notes", async (c) => {
  const userId = c.get("userId");
  const personId = c.req.param("id");
  const notes = await noteService.listNotesByPerson(userId, personId);
  return c.json({ notes });
});

appRoutes.post("/people/:id/notes", async (c) => {
  const userId = c.get("userId");
  const personId = c.req.param("id");
  const { content } = await c.req.json();
  if (!content) return c.json({ error: "Content is required" }, 400);

  const note = await noteService.addNote(userId, personId, content);
  if (!note) return c.json({ error: "Failed to add note" }, 400);
  return c.json({ note }, 201);
});

appRoutes.put("/notes/:id", async (c) => {
  const userId = c.get("userId");
  const noteId = c.req.param("id");
  const { content } = await c.req.json();
  const updated = await noteService.updateNote(userId, noteId, content);
  if (!updated) return c.json({ error: "Note not found" }, 404);
  return c.json({ note: updated });
});

appRoutes.delete("/notes/:id", async (c) => {
  const userId = c.get("userId");
  const noteId = c.req.param("id");
  const success = await noteService.deleteNote(userId, noteId);
  return c.json({ success });
});

// 5. Birthday Reminders
appRoutes.get("/people/:id/birthday-reminders", async (c) => {
  const userId = c.get("userId");
  const personId = c.req.param("id");
  const reminders = await birthdayService.getBirthdayRemindersForPerson(userId, personId);
  return c.json({ birthdayReminders: reminders });
});

appRoutes.post("/people/:id/birthday-reminders/toggle", async (c) => {
  const userId = c.get("userId");
  const personId = c.req.param("id");
  const { daysBefore } = await c.req.json();
  const updated = await birthdayService.toggleBirthdayReminderOffset(userId, personId, daysBefore);
  return c.json({ birthdayReminder: updated });
});

appRoutes.post("/people/:id/birthday-reminders/custom", async (c) => {
  const userId = c.get("userId");
  const personId = c.req.param("id");
  const { daysBefore } = await c.req.json();
  const updated = await birthdayService.addCustomBirthdayReminderOffset(userId, personId, daysBefore);
  return c.json({ birthdayReminder: updated });
});

appRoutes.post("/people/:id/birthday-reminders/time", async (c) => {
  const userId = c.get("userId");
  const personId = c.req.param("id");
  const { reminderTime } = await c.req.json();
  await birthdayService.setPersonBirthdayReminderTime(userId, personId, reminderTime);
  return c.json({ success: true });
});

// 6. Reminders
appRoutes.get("/reminders", async (c) => {
  const userId = c.get("userId");
  const remindersList = await reminderService.listUpcomingRemindersByUser(userId);
  const user = await userService.findById(userId);
  const tz = user?.timezone || env.DEFAULT_TIMEZONE || "Asia/Tehran";

  const formatted = remindersList.map((r) => {
    const { dateStr, timeStr } = formatReminderDate(r.scheduledAt, tz);
    return {
      ...r,
      dateStr,
      timeStr,
    };
  });

  return c.json({ reminders: formatted });
});

appRoutes.post("/reminders", async (c) => {
  const userId = c.get("userId");
  const { title, scheduledAt, personId, repeatType } = await c.req.json();
  if (!title || !scheduledAt) {
    return c.json({ error: "Title and scheduledAt are required" }, 400);
  }

  const user = await userService.findById(userId);
  const tz = user?.timezone || env.DEFAULT_TIMEZONE || "Asia/Tehran";

  let targetDate: Date;
  if (typeof scheduledAt === "string") {
    // If it's an ISO datetime string like "2026-09-14T10:00" without timezone
    if (scheduledAt.includes("T") && !scheduledAt.endsWith("Z") && !scheduledAt.includes("+") && !scheduledAt.includes("-", 10)) {
      const dt = DateTime.fromISO(scheduledAt, { zone: tz });
      targetDate = dt.isValid ? dt.toJSDate() : new Date(scheduledAt);
    } else {
      const dt = DateTime.fromISO(scheduledAt).setZone(tz);
      targetDate = dt.isValid ? dt.toJSDate() : new Date(scheduledAt);
    }
  } else {
    targetDate = new Date(scheduledAt);
  }

  const reminder = await reminderService.createReminder(userId, {
    title,
    scheduledAt: targetDate,
    personId: personId || null,
    repeatType: repeatType || "none",
  });

  return c.json({ reminder }, 201);
});

appRoutes.post("/reminders/:id/complete", async (c) => {
  const userId = c.get("userId");
  const reminderId = c.req.param("id");
  const user = await userService.findById(userId);
  const result = await reminderService.completeReminder(userId, reminderId, user?.timezone);
  return c.json(result);
});

appRoutes.delete("/reminders/:id", async (c) => {
  const userId = c.get("userId");
  const reminderId = c.req.param("id");
  const success = await reminderService.deleteReminder(userId, reminderId);
  return c.json({ success });
});
