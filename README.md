# 🎂 Birthday & Reminder Telegram Bot + Web App

A **modern, full-stack, production-ready Telegram Bot & Glassmorphic Web App (Telegram Mini App)** for tracking birthdays, managing contacts, writing personal notes, and setting precise reminders.

Built with **TypeScript**, **GrammY**, **Hono**, **PostgreSQL (Drizzle ORM)**, and **Luxon**.

---

## 🌟 Core Features & Capabilities

### 1. Telegram Bot Experience
- **Interactive Inline Navigation**: Full graphical menu using Telegram Inline Keyboards (`/start`, `/menu`, `/reminders`, `/profile`, `/admin`).
- **Complete Profile & Timezone Settings**:
  - View profile details (Name, Birthday, Information, Timezone).
  - Quick timezone presets including **`🇮🇷 Asia/Tehran`**, **`🇦🇪 Asia/Dubai`**, London, Berlin, Paris, New York, Los Angeles, Tokyo, and UTC.
  - Interactive month/day birthday editor.
- **Contact & Birthday Management**:
  - Add and browse contacts with birthdays and notes.
  - Quick search and overview of upcoming birthdays.
- **Step-by-Step Reminder Wizard**:
  - Person birthday reminder offsets (`On the day`, `1 day before`, `3 days before`, `1 week before`, `2 weeks before`, `1 month before`).
  - One-time custom reminders with date presets (`Today`, `Tomorrow`, `In 2 days`, `In 1 week`, or calendar picker) and custom time inputs (e.g. `17:25`).
  - Recurrence settings (`none`, `daily`, `weekly`, `monthly`, `yearly`).

### 2. Modern Glassmorphic Web App (Telegram Mini App)
- **Universal Access**: Hosted at `/app` with dark-mode aesthetic and smooth transitions.
- **Unified Navigation Tabs**:
  - `🏠 Home / Dashboard`: Live statistics, upcoming birthdays countdown, and active reminders preview.
  - `👥 People`: Full contact directory with birthday badges and instant actions.
  - `⏰ Reminders`: Birthday reminder template chips (`🎯 On the day (0d)`, `⏰ 1d before`, `📅 3d before`, etc.) + Active reminders list with delete action.
  - `👤 Profile`: Edit Name and Birthday using standard mobile date pickers.
  - `🛡️ Admin`: System statistics, audit logs, and user management (for Owner & Admins).
- **Mobile-Native Birthday Picker**:
  - Integrates standard `<input type="date">` for native iOS rolling wheel and Android Material Date Picker on mobile devices.
- **Comprehensive Notes Management**:
  - Click on any contact from **Home** or **People** tab to open the Person Details view.
  - Full Note CRUD: **Add Note (`➕`)**, **Edit Note (`✏️`)**, and **Delete Note (`🗑`)**.
- **Real-Time Bidirectional Sync**: Changes made in the Telegram bot instantly reflect in the Web App and vice-versa.

### 3. Notifications & Accurate Timing Engine
- **Rich Message Formatting**:
  - **Birthday Alerts**: Includes title `🎂 Birthday Reminder`, person's name, formatted date, and all associated personal notes!
  - **Custom Reminders**: Formatted with `⏰ Reminder` followed by the reminder title.
- **Exact Timing & Zero Offset Skew**:
  - All reminders and dates are parsed and compared with exact timezone accuracy (defaulting to **`Asia/Tehran`**).
- **1-Minute Precision Cron & Self-Healing Trigger**:
  - Automated GitHub Actions workflow (`.github/workflows/cron.yml`) looping every 60 seconds.
  - Bot middleware & Web App background triggers automatically evaluate and dispatch due reminders.
  - Public unblocked `/api/cron` endpoint for external cron providers (e.g. cron-job.org).

---

## 🛡️ Admin Controls & Access

Admin access is resolved directly from the authenticated Telegram account:

```env
OWNER_TELEGRAM_ID=5138117035
```

- **Role Levels**:
  - **Owner**: Full access; can manage admins, view system statistics, and inspect audit logs. Cannot be disabled or demoted.
  - **Admin**: Elevated privileges to manage users and view statistics.
  - **User**: Standard personal application access.
- **Strict Role Isolation**: Admin endpoints (`/api/admin/*`) return `403 Forbidden` for standard users.

---

## 🏗️ Architecture & Stack

```text
               ┌───────────────────────────────┐
               │    Telegram Messenger UI      │
               │ (Chat Bot & Telegram Mini App)│
               └──────────────┬────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                 Universal Hono / Node.js Server             │
│                                                             │
│   • POST /api/webhook       • Grammy Bot Middleware & State │
│   • GET/POST /api/cron      • Notification Dispatcher Engine│
│   • POST /api/auth/*        • Telegram InitData Auth        │
│   • GET/POST /api/admin/*   • Admin Management & Audits     │
│   • GET/POST /api/people    • Contact & Note CRUD           │
│   • GET/POST /api/reminders • Unified Reminder Engine       │
│   • GET /app                • Glassmorphic SPA Frontend     │
└──────────────┬───────────────────────────────┬──────────────┘
               │                               │
               ▼                               ▼
     ┌───────────────────┐           ┌───────────────────┐
     │  Neon PostgreSQL  │           │   GitHub Actions  │
     │   (Drizzle ORM)   │           │ (1-Minute Cron)   │
     └───────────────────┘           └───────────────────┘
```

| Layer | Technology |
| :--- | :--- |
| **Language** | TypeScript (Strict Mode) |
| **Telegram Framework** | [GrammY](https://grammy.dev/) |
| **Web Server & REST API** | [Hono](https://hono.dev/) |
| **Database & ORM** | [PostgreSQL (Neon)](https://neon.tech/) + [Drizzle ORM](https://orm.drizzle.team/) |
| **Date & Timezone Engine** | [Luxon](https://moment.github.io/luxon/) |
| **Testing** | [Vitest](https://vitest.dev/) (Unit & Integration Tests) |

---

## 🔌 REST API Overview

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/health` | Server health check |
| `POST` | `/api/webhook` | Telegram Bot Webhook endpoint |
| `GET/POST`| `/api/cron` | Dispatches all due birthday & custom reminders |
| `POST` | `/api/auth/telegram` | Authenticates Telegram Mini App `initData` |
| `GET` | `/api/dashboard` | Fetches dashboard stats, upcoming birthdays & reminders |
| `GET/POST`| `/api/people` | List or create contacts |
| `GET/PUT/DELETE`| `/api/people/:id` | View, update, or delete a contact |
| `GET/POST`| `/api/people/:id/notes`| List or add notes to a contact |
| `PUT/DELETE`| `/api/notes/:id` | Update or delete an existing note |
| `GET/POST`| `/api/reminders` | List or create custom/birthday reminders |
| `DELETE` | `/api/reminders/:id` | Delete a reminder |
| `GET/PUT` | `/api/profile` | View or update user profile and timezone |
| `GET` | `/api/admin/stats` | System statistics (Admin only) |
| `GET` | `/api/admin/users` | User management list (Admin only) |
| `GET` | `/api/admin/audit-logs`| Audit activity logs (Admin only) |

---

## 🚀 Quick Start (Local Development)

### 1. Prerequisites
* **Node.js**: v20+ or v22+
* **PostgreSQL**: Local PG or Cloud (e.g. Neon, Supabase)
* **Telegram Bot Token**: From [@BotFather](https://t.me/BotFather)

### 2. Installation
```bash
# Clone the repository
git clone <repo-url>
cd birthday_tg

# Install dependencies
npm install
```

### 3. Environment Setup
```bash
cp .env.example .env
```
Fill in your credentials in `.env`:
```env
PORT=3005
TELEGRAM_BOT_TOKEN=123456789:ABCdefGhIJKlmNoPQRsTUVwxyZ
DATABASE_URL=postgresql://hasan:Welcome@localhost:5432/dating_app
SESSION_SECRET=a_very_secure_random_string_32_characters
OWNER_TELEGRAM_ID=5138117035
```

### 4. Run Migrations & Re-Import Data
```bash
npm run db:migrate
npm run data:import
```

### 5. Start Development Server
```bash
npm run dev
```

* **Telegram Bot**: Send `/start` to your bot.
* **Web App**: Open [http://localhost:3005/app](http://localhost:3005/app) in your browser.

---

## 🧪 Comprehensive Automated Test Matrix

Run the automated test matrix (112 tests across 15 suites):

```bash
# Run all tests
npm run test:all

# Run specific test layers
npm run test:unit           # Unit tests (dates, timezones, validation)
npm run test:integration    # Service and notification integration tests
npm run test:persistence    # Full CREATE -> READ -> UPDATE -> READ -> DELETE matrix
npm run test:admin          # Admin stats, user management, audit logs, 403 checks
npm run test:sync           # Telegram <-> Web App bidirectional sync tests
npm run test:reminders      # Reminder flow and dynamic display tests
npm run test:e2e            # Complete zero-to-100 user journey test

# Type checking & linting
npm run lint

# Build production bundle
npm run build
```

---

## 📄 License

MIT
