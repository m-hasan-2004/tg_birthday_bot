# 🎂 Birthday & Reminder Telegram Bot + Web App

A **simple, fast, modern, production-ready Telegram Bot & Web App** for remembering birthdays, people, personal notes, and reminders.

Built with **TypeScript**, **GrammY**, **Hono**, **PostgreSQL (Drizzle ORM)**, and **Luxon**.

---

## 🌟 Core Features

### 1. Telegram Experience
* Use the application entirely through native Telegram buttons and commands (`/start`, `/menu`, `/admin`).
* Manage contacts, track birthdays, write personal notes, and create recurring reminders.
* **Step-by-Step Birthday Reminder Wizard**:
  - Select Person
  - View Person's Date (e.g. `September 14`)
  - Select Reminder Occasions (`1 month before`, `1 week before`, `1 day before`, `On the day`)
  - Select Reminder Time (`09:00`, `10:00`, `12:00`, `18:00`)
  - Review Summary Screen $\rightarrow$ Save
* **Unified Reminders Display**: Both scheduled one-time/recurring reminders and configured birthday reminders appear dynamically in your Reminders list.

### 2. Web App Experience
* Fast, glassmorphic **Telegram Mini App / Web App** at `/app`.
* Clean 4-tab user navigation: `🏠 Home`, `👥 People`, `⏰ Reminders`, `👤 Profile` (+ `🛡️ Admin` for owner/admin).
* Real-time bidirectional sync with Telegram bot: everything created in Telegram instantly appears in the Web App and vice versa.

---

## 🛡️ Admin Access & Identity

The application determines administrator access from the authenticated Telegram account.

The initial application owner is configured through `OWNER_TELEGRAM_ID`:

```env
OWNER_TELEGRAM_ID=5138117035
```

### Role Resolution Logic:
1. If Telegram ID matches `OWNER_TELEGRAM_ID` → **OWNER**
2. Otherwise, if the user has an active **ADMIN** record → **ADMIN**
3. Otherwise → **USER**

* **Strict Separation & No Mode Switch**:
  - **OWNER / ADMIN** accounts automatically receive the **Admin Panel**.
  - Normal **USER** accounts automatically receive the **normal application**.
  - Normal users receive `HTTP 403 Forbidden` on all `/api/admin/*` endpoints.
  - The **OWNER** cannot be demoted by an **ADMIN**.

---

## 🏗️ Architecture Overview

```text
                    ┌────────────────────────┐
                    │  Telegram Bot (Inline) │
                    └───────────┬────────────┘
                                │
                                ▼
  ┌─────────────────────────────────────────────────────────────┐
  │                 Unified Hono / GrammY Server                │
  │                                                             │
  │   • POST /api/webhook       • Telegram Bot Handlers         │
  │   • GET/POST /api/cron      • Notification Dispatcher       │
  │   • POST /api/auth/*        • Telegram HMAC & Dev Auth      │
  │   • GET/POST /api/admin/*   • Admin Stats, Users, Audits    │
  │   • GET/POST /api/*         • Shared Application REST API   │
  │   • GET /app                • Glassmorphic Frontend         │
  └──────────────┬───────────────────────────────┬──────────────┘
                 │                               │
                 ▼                               ▼
       ┌───────────────────┐           ┌───────────────────┐
       │   PostgreSQL DB   │           │    Web App / TMA  │
       │   (Drizzle ORM)   │           │ (Telegram WebApp) │
       └───────────────────┘           └───────────────────┘
```

---

## 🛠️ Technology Stack

| Layer | Technology | Purpose |
| :--- | :--- | :--- |
| **Language** | [TypeScript](https://www.typescriptlang.org/) (Strict Mode) | End-to-end type safety |
| **Telegram Framework** | [GrammY](https://grammy.dev/) | Modern Telegram Bot & Webhooks |
| **Web Server & API** | [Hono](https://hono.dev/) | High-performance universal serverless framework |
| **Database & ORM** | [PostgreSQL](https://www.postgresql.org/) + [Drizzle ORM](https://orm.drizzle.team/) | Serverless database with zero-overhead queries |
| **Date & Timezone** | [Luxon](https://moment.github.io/luxon/) | IANA timezones, leap years (Feb 29), and recurrence |
| **Validation** | [Zod](https://zod.dev/) | Schema & environment variables validation |
| **Test Runner** | [Vitest](https://vitest.dev/) | Fast automated unit, integration, and E2E tests |

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
