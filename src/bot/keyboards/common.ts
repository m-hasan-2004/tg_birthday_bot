import { InlineKeyboard } from "grammy";
import type { BirthdayReminder, Person } from "../../types/index.js";
import { env } from "../../config/env.js";

export function getMainMenuKeyboard(user?: { role?: string; telegramId?: string }): InlineKeyboard {
  const keyboard = new InlineKeyboard()
    .text("👥 People", "menu_people")
    .text("➕ Add Person", "menu_add_person")
    .row()
    .text("⏰ Reminders", "menu_reminders")
    .text("👤 My Profile", "menu_profile")
    .row();

  const isOwnerOrAdmin =
    user &&
    (user.role === "owner" ||
      user.role === "admin" ||
      (env.OWNER_TELEGRAM_ID && String(user.telegramId) === env.OWNER_TELEGRAM_ID.trim()));

  if (isOwnerOrAdmin) {
    keyboard.text("🛡️ Admin Panel", "menu_admin").row();
  }

  const webAppUrl = env.WEB_APP_URL || (env.WEBHOOK_URL ? `${env.WEBHOOK_URL.replace(/\/$/, "")}/app` : "");
  if (webAppUrl) {
    keyboard.webApp("🚀 Open Web App", webAppUrl).row();
  }

  return keyboard;
}

export function getBackToMenuKeyboard(): InlineKeyboard {
  return new InlineKeyboard().text("← Back", "open_menu");
}

export function getProfileKeyboard(): InlineKeyboard {
  return new InlineKeyboard()
    .text("✏️ Edit", "profile_edit_menu")
    .row()
    .text("← Back", "open_menu");
}

export function getProfileEditKeyboard(): InlineKeyboard {
  return new InlineKeyboard()
    .text("👤 Edit Name", "profile_edit_name")
    .text("🎂 Edit Birthday", "profile_edit_birthday")
    .row()
    .text("ℹ️ Edit Information", "profile_edit_info")
    .text("🌍 Edit Timezone", "profile_edit_tz")
    .row()
    .text("← Back", "menu_profile");
}

export function getPeopleListKeyboard(peopleList: Person[]): InlineKeyboard {
  const keyboard = new InlineKeyboard();

  for (const p of peopleList) {
    const icon = p.birthday ? "🎂" : "👤";
    keyboard.text(`${icon} ${p.name}`, `view_person_${p.id}`).row();
  }

  keyboard.text("➕ Add Person", "menu_add_person").row();
  keyboard.text("← Back", "open_menu");
  return keyboard;
}

export function getPersonDetailsKeyboard(person: Person): InlineKeyboard {
  const keyboard = new InlineKeyboard()
    .text("📝 Notes", `person_notes_${person.id}`)
    .text("⏰ Set Reminders", `rem_wiz_sel_person_${person.id}`)
    .row();

  if (person.birthday) {
    keyboard.text("🎂 Birthday Offsets", `person_bday_rem_${person.id}`).row();
  }

  keyboard
    .text("✏️ Edit", `person_edit_${person.id}`)
    .text("🗑 Delete", `person_delete_${person.id}`)
    .row()
    .text("← Back", "menu_people");

  return keyboard;
}

export function getBirthdayRemindersKeyboard(
  personId: string,
  reminders: BirthdayReminder[]
): InlineKeyboard {
  const keyboard = new InlineKeyboard();

  // Known presets: 30, 14, 7, 3, 1, 0
  const presets = [30, 14, 7, 3, 1, 0];
  const reminderMap = new Map<number, BirthdayReminder>();
  for (const r of reminders) {
    reminderMap.set(r.daysBefore, r);
  }

  // Display standard presets
  for (const days of presets) {
    const r = reminderMap.get(days);
    const isChecked = r ? r.enabled : false;
    let label = `${days} days before`;
    if (days === 0) label = "On the birthday";
    else if (days === 7) label = "1 week before";
    else if (days === 30) label = "1 month before";

    const checkIcon = isChecked ? "☑" : "☐";
    keyboard.text(`${checkIcon} ${label}`, `bday_toggle_${personId}_${days}`).row();
  }

  // Display custom offsets (any offset not in standard presets)
  for (const r of reminders) {
    if (!presets.includes(r.daysBefore)) {
      const checkIcon = r.enabled ? "☑" : "☐";
      keyboard
        .text(`${checkIcon} ${r.daysBefore} days before (Custom)`, `bday_toggle_${personId}_${r.daysBefore}`)
        .text("❌", `bday_del_${personId}_${r.daysBefore}`)
        .row();
    }
  }

  // Custom offset button & Time setting button
  const reminderTime = reminders[0]?.reminderTime || "09:00";
  keyboard
    .text("+ Custom", `bday_custom_${personId}`)
    .text(`🕘 Time (${reminderTime})`, `bday_time_${personId}`)
    .row()
    .text("Save", `view_person_${personId}`)
    .row()
    .text("← Back", `view_person_${personId}`);

  return keyboard;
}

export function getSkipKeyboard(skipActionCallback: string, backCallback?: string): InlineKeyboard {
  const keyboard = new InlineKeyboard().text("Skip", skipActionCallback);
  if (backCallback) {
    keyboard.row().text("← Back", backCallback);
  }
  return keyboard;
}

export function getRecurrenceKeyboard(prefix: string): InlineKeyboard {
  return new InlineKeyboard()
    .text("No", `${prefix}_none`)
    .row()
    .text("Every day", `${prefix}_daily`)
    .row()
    .text("Every week", `${prefix}_weekly`)
    .row()
    .text("Every month", `${prefix}_monthly`)
    .row()
    .text("Every year", `${prefix}_yearly`);
}

export function getTimePresetKeyboard(prefix: string): InlineKeyboard {
  return new InlineKeyboard()
    .text("08:00", `${prefix}_08:00`)
    .text("09:00", `${prefix}_09:00`)
    .text("10:00", `${prefix}_10:00`)
    .row()
    .text("12:00", `${prefix}_12:00`)
    .text("14:00", `${prefix}_14:00`)
    .text("18:00", `${prefix}_18:00`)
    .row()
    .text("20:00", `${prefix}_20:00`)
    .text("21:00", `${prefix}_21:00`)
    .row()
    .text("← Back", "open_menu");
}

export function getMonthPickerKeyboard(prefix: string, allowSkip: boolean = false): InlineKeyboard {
  const months = [
    ["Jan (01)", "01"],
    ["Feb (02)", "02"],
    ["Mar (03)", "03"],
    ["Apr (04)", "04"],
    ["May (05)", "05"],
    ["Jun (06)", "06"],
    ["Jul (07)", "07"],
    ["Aug (08)", "08"],
    ["Sep (09)", "09"],
    ["Oct (10)", "10"],
    ["Nov (11)", "11"],
    ["Dec (12)", "12"],
  ];

  const keyboard = new InlineKeyboard();
  for (let i = 0; i < months.length; i += 3) {
    keyboard
      .text(months[i][0], `${prefix}_m_${months[i][1]}`)
      .text(months[i + 1][0], `${prefix}_m_${months[i + 1][1]}`)
      .text(months[i + 2][0], `${prefix}_m_${months[i + 2][1]}`)
      .row();
  }

  if (allowSkip) {
    keyboard.text("Skip", `${prefix}_skip`).row();
  }
  keyboard.text("← Back", "open_menu");
  return keyboard;
}

export function getDayPickerKeyboard(prefix: string, month: string): InlineKeyboard {
  const keyboard = new InlineKeyboard();
  const daysInMonth = [4, 6, 9, 11].includes(parseInt(month, 10))
    ? 30
    : parseInt(month, 10) === 2
    ? 29
    : 31;

  for (let d = 1; d <= daysInMonth; d++) {
    const dayStr = String(d).padStart(2, "0");
    keyboard.text(String(d), `${prefix}_d_${month}_${dayStr}`);
    if (d % 7 === 0) keyboard.row();
  }

  if (daysInMonth % 7 !== 0) keyboard.row();
  keyboard.text("← Change Month", `${prefix}_back_month`);
  return keyboard;
}
