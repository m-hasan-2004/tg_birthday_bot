# Production Deployment & Setup Guide: Birthday & Reminder App

This guide provides a complete, step-by-step process for configuring, deploying, and maintaining the **Birthday & Reminder App**, consisting of a Telegram Bot, Telegram Mini App/Web App, PostgreSQL database, API endpoints, administrator panel, and scheduled birthday/reminder processing.

The recommended production architecture is:

```text
Telegram
   │
   ├── Telegram Bot
   │
   └── Telegram Mini App
            │
            ▼
        Vercel
   ┌─────────────────┐
   │ Web Application │
   │ API Routes      │
   │ Telegram Webhook│
   │ Cron Endpoint   │
   └────────┬────────┘
            │
            ▼
      Neon PostgreSQL
```

The recommended stack is:

* **GitHub** — source code repository
* **Vercel** — application hosting/serverless deployment
* **Neon** — managed PostgreSQL
* **Telegram Bot API** — bot and Mini App integration
* **Drizzle ORM** — PostgreSQL database access
* **Vercel Cron** — scheduled reminder execution

For a small/personal deployment, these services may be usable within their respective free tiers. Free-tier limits are provider-specific and can change, so always verify the current limits before relying on a $0 production deployment.

---

# Table of Contents

1. [Prerequisites](#1-prerequisites)
2. [Project Structure](#2-project-structure)
3. [Local Setup & Development](#3-local-setup--development)
4. [Create the Telegram Bot](#4-create-the-telegram-bot)
5. [Create the Neon PostgreSQL Database](#5-create-the-neon-postgresql-database)
6. [Configure Environment Variables](#6-configure-environment-variables)
7. [Initialize the Database](#7-initialize-the-database)
8. [Import Existing Data](#8-import-existing-data)
9. [Run Tests Locally](#9-run-tests-locally)
10. [Push the Project to GitHub](#10-push-the-project-to-github)
11. [Deploy to Vercel](#11-deploy-to-vercel)
12. [Configure Vercel Environment Variables](#12-configure-vercel-environment-variables)
13. [Deploy the Production Database Schema](#13-deploy-the-production-database-schema)
14. [Configure the Telegram Webhook](#14-configure-the-telegram-webhook)
15. [Configure the Telegram Mini App](#15-configure-the-telegram-mini-app)
16. [Configure Scheduled Reminders](#16-configure-scheduled-reminders)
17. [Administrator & Security Configuration](#17-administrator--security-configuration)
18. [Production Verification](#18-production-verification)
19. [Production Testing](#19-production-testing)
20. [Backup & Data Re-Import](#20-backup--data-re-import)
21. [Updating the Application](#21-updating-the-application)
22. [Troubleshooting](#22-troubleshooting)
23. [Environment Variables Reference](#23-environment-variables-reference)
24. [Production Deployment Checklist](#24-production-deployment-checklist)
25. [Recommended Production Architecture](#25-recommended-production-architecture)

---

# 1. Prerequisites

Before starting the production deployment, install the following tools.

## 1.1 Node.js

Use a supported Node.js version compatible with the project.

Recommended:

```text
Node.js 20.x
Node.js 22.x
Node.js 24.x
```

Verify the installed version:

```bash
node --version
```

Example:

```text
v22.x.x
```

---

## 1.2 npm

Verify npm:

```bash
npm --version
```

The project requires a modern npm version, preferably npm 10 or newer.

---

## 1.3 Git

Install Git and verify:

```bash
git --version
```

---

## 1.4 GitHub Account

Create an account at:

https://github.com/

The production project should be stored in a GitHub repository so that Vercel can automatically deploy new commits.

---

## 1.5 Vercel Account

Create an account at:

https://vercel.com/

Vercel will host the application and expose the public HTTPS endpoints required by Telegram.

---

## 1.6 Neon Account

Create an account at:

https://neon.tech/

Neon will provide the managed PostgreSQL database.

PostgreSQL itself is open-source and free. Neon charges according to its hosting/compute/storage plans, including a free tier with usage limits.

---

## 1.7 Telegram Account

You need a Telegram account to create and manage the bot through:

https://t.me/BotFather

---

# 2. Project Structure

The project should contain the application source code, database schema, scripts, and deployment configuration.

A typical structure is:

```text
birthday_tg/
├── src/
├── scripts/
├── drizzle/
├── public/
├── tests/
├── .env
├── .env.example
├── .gitignore
├── package.json
├── tsconfig.json
├── drizzle.config.ts
└── vercel.json
```

The exact structure may differ depending on the implementation.

Before deployment, verify that all required project files are present.

---

# 3. Local Setup & Development

## Step 1: Clone the Repository

Clone the project:

```bash
git clone <repository-url>
```

Enter the project directory:

```bash
cd birthday_tg
```

Install dependencies:

```bash
npm install
```

---

## Step 2: Create the Local Environment File

If the project includes `.env.example`:

```bash
cp .env.example .env
```

On Windows PowerShell:

```powershell
Copy-Item .env.example .env
```

Never commit `.env` to GitHub.

---

## Step 3: Configure `.gitignore`

Make sure `.gitignore` contains:

```gitignore
.env
.env.local
.env.production
node_modules
```

The following secrets must never be committed:

```text
TELEGRAM_BOT_TOKEN
DATABASE_URL
SESSION_SECRET
WEBHOOK_SECRET
CRON_SECRET
```

---

# 4. Create the Telegram Bot

## Step 1: Open BotFather

Open:

https://t.me/BotFather

---

## Step 2: Create the Bot

Send:

```text
/newbot
```

Follow the instructions.

BotFather will provide a token similar to:

```text
123456789:AAxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

This is the:

```env
TELEGRAM_BOT_TOKEN
```

Keep this token private.

---

## Step 3: Configure Bot Commands

Use:

```text
/setcommands
```

Select your bot and enter:

```text
start - Start the bot and profile setup
menu - Open the main menu
admin - Open the administrator panel
help - Show the usage guide
```

---

# 5. Create the Neon PostgreSQL Database

The application uses PostgreSQL through Drizzle ORM.

## Step 1: Create a Neon Project

Open:

https://neon.tech/

Create a new project.

Recommended project name:

```text
birthday-tg
```

Choose a PostgreSQL database.

---

## Step 2: Copy the Connection String

Neon provides a PostgreSQL connection string similar to:

```text
postgresql://username:password@ep-example.eu-central-1.aws.neon.tech/neondb?sslmode=require
```

Copy the connection string.

This becomes:

```env
DATABASE_URL=postgresql://username:password@...
```

Use the connection string recommended by Neon for serverless applications.

---

## Step 3: Do Not Commit the Database URL

Never place the production `DATABASE_URL` inside GitHub source code.

It should only exist in:

```text
.env
```

and the Vercel Environment Variables configuration.

---

# 6. Configure Environment Variables

Create `.env` locally.

A production-style configuration looks like:

```env
NODE_ENV=production

PORT=3005

TELEGRAM_BOT_TOKEN=YOUR_TELEGRAM_BOT_TOKEN

DATABASE_URL=YOUR_NEON_POSTGRESQL_CONNECTION_STRING

SESSION_SECRET=YOUR_LONG_RANDOM_SECRET

OWNER_TELEGRAM_ID=YOUR_TELEGRAM_ID

WEBHOOK_URL=https://YOUR-APP.vercel.app

WEB_APP_URL=https://YOUR-APP.vercel.app/app

WEBHOOK_SECRET=YOUR_RANDOM_WEBHOOK_SECRET

CRON_SECRET=YOUR_RANDOM_CRON_SECRET

DEFAULT_TIMEZONE=Europe/Berlin
```

For local development, use:

```env
NODE_ENV=development
PORT=3005
```

and the same Telegram/database credentials if you are intentionally testing against the development database.

---

## 6.1 Generate Secure Secrets

Do not use simple values such as:

```text
password
123456
secret
mysecret
```

Generate secure random values with Node.js:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Run the command separately for:

```env
SESSION_SECRET=
WEBHOOK_SECRET=
CRON_SECRET=
```

Example:

```env
SESSION_SECRET=8f5e2c...
WEBHOOK_SECRET=19a7d4...
CRON_SECRET=6c9e21...
```

Use different values for each secret.

---

# 7. Initialize the Database

Make sure `DATABASE_URL` points to your intended PostgreSQL database.

Run:

```bash
npm run db:migrate
```

This applies the project's Drizzle database migrations.

Verify that the command completes without errors.

---

## Important

Database migrations should be run deliberately during deployment.

Do not execute migrations every time a user opens the application.

A production application should not perform database schema migrations from normal API requests.

---

# 8. Import Existing Data

If the project contains existing application data, import it after the database schema has been created.

Run:

```bash
npm run data:import
```

If a specific backup file must be imported:

```bash
npx tsx scripts/import-data.ts path/to/backup.json
```

Only perform data imports against the intended database.

Before importing production data, create a backup of any existing production database/data where possible.

---

# 9. Run Tests Locally

Run the complete test suite:

```bash
npm run test:all
```

The current project is expected to contain:

```text
112 tests
15 test suites
```

with a 100% pass rate.

If the number of tests changes as development continues, use the actual test output as the authoritative result rather than this documentation value.

Do not deploy if critical tests are failing.

---

# 10. Push the Project to GitHub

Create a new repository on:

https://github.com/

For example:

```text
birthday-tg
```

Initialize Git if necessary:

```bash
git init
```

Add the project files:

```bash
git add .
```

Create the initial commit:

```bash
git commit -m "Initial production deployment"
```

Set the main branch:

```bash
git branch -M main
```

Add the GitHub repository:

```bash
git remote add origin <github-repository-url>
```

Push:

```bash
git push -u origin main
```

---

## Verify Secrets Are Not Uploaded

Before pushing, check:

```bash
git status
```

`.env` should not appear as a file being committed.

The repository may contain:

```text
.env.example
```

but must not contain:

```text
.env
.env.production
.env.local
```

---

# 11. Deploy to Vercel

Open:

https://vercel.com/

Select:

```text
Add New
→ Project
```

Select the GitHub repository:

```text
birthday-tg
```

Vercel should automatically detect the project configuration.

Review the build settings.

Then select:

```text
Deploy
```

After deployment, Vercel will provide a URL such as:

```text
https://birthday-tg.vercel.app
```

This becomes the public application URL.

---

# 12. Configure Vercel Environment Variables

Open the Vercel project.

Go to:

```text
Project
→ Settings
→ Environment Variables
```

Add the following variables.

## Required Variables

```text
NODE_ENV
```

Value:

```text
production
```

---

```text
TELEGRAM_BOT_TOKEN
```

Value:

```text
YOUR_TELEGRAM_BOT_TOKEN
```

---

```text
DATABASE_URL
```

Value:

```text
YOUR_NEON_POSTGRESQL_CONNECTION_STRING
```

---

```text
SESSION_SECRET
```

Value:

```text
YOUR_RANDOM_SESSION_SECRET
```

---

```text
OWNER_TELEGRAM_ID
```

Value:

```text
YOUR_TELEGRAM_ID
```

---

## Production URLs

```text
WEBHOOK_URL
```

Example:

```text
https://birthday-tg.vercel.app
```

---

```text
WEB_APP_URL
```

Example:

```text
https://birthday-tg.vercel.app/app
```

---

## Security Variables

```text
WEBHOOK_SECRET
```

Example:

```text
YOUR_RANDOM_WEBHOOK_SECRET
```

---

```text
CRON_SECRET
```

Example:

```text
YOUR_RANDOM_CRON_SECRET
```

---

## Timezone

```text
DEFAULT_TIMEZONE
```

Value:

```text
Europe/Berlin
```

---

## Optional Port

```text
PORT
```

Value:

```text
3005
```

For Vercel serverless deployments, the platform normally manages the HTTP port. Keep `PORT` only if the application uses it internally or requires it for local development.

---

## Environment Selection

For production values, select:

```text
Production
```

If you also want the variables available during preview deployments, select:

```text
Production
Preview
Development
```

as appropriate.

---

# 13. Deploy the Production Database Schema

Once the Neon database and Vercel environment are configured, make sure the production database has all required tables.

The safest simple approach is to run the migration command locally with `DATABASE_URL` pointing to the production Neon database:

```bash
npm run db:migrate
```

Verify the migration completes successfully.

Do not run migrations against the wrong database.

Before running a migration, verify:

```text
DATABASE_URL
```

points to the intended Neon project.

---

# 14. Configure the Telegram Webhook

The Telegram webhook connects Telegram's Bot API to the application's API endpoint.

Your production webhook URL is:

```text
https://YOUR-APP.vercel.app/api/webhook
```

Set the webhook using:

```bash
curl -F "url=https://YOUR-APP.vercel.app/api/webhook" \
     -F "secret_token=YOUR_WEBHOOK_SECRET" \
     "https://api.telegram.org/botYOUR_TELEGRAM_BOT_TOKEN/setWebhook"
```

Replace:

```text
YOUR-APP.vercel.app
YOUR_WEBHOOK_SECRET
YOUR_TELEGRAM_BOT_TOKEN
```

with the real values.

A successful response should contain:

```json
{
  "ok": true,
  "result": true
}
```

---

## Verify the Webhook

You can check the Telegram webhook configuration using:

```bash
curl "https://api.telegram.org/botYOUR_TELEGRAM_BOT_TOKEN/getWebhookInfo"
```

Check that the configured URL is:

```text
https://YOUR-APP.vercel.app/api/webhook
```

If Telegram reports webhook errors, inspect the application's Vercel logs.

---

# 15. Configure the Telegram Mini App

Open:

https://t.me/BotFather

Use the Mini App/Web App configuration available for your bot.

Configure the application URL as:

```text
https://YOUR-APP.vercel.app/app
```

For example:

```text
https://birthday-tg.vercel.app/app
```

Use the application name:

```text
Birthday & Reminder App
```

Description:

```text
Remember birthdays, notes, and reminders
```

Upload the application image/icon if required.

Configure the Mini App short name, for example:

```text
app
```

Telegram will provide the Mini App entry point for the bot.

---

# 16. Configure Scheduled Reminders

The application uses:

```text
/api/cron
```

to process:

* due reminders
* birthday notifications
* scheduled alerts

Create or update:

```text
vercel.json
```

with:

```json
{
  "crons": [
    {
      "path": "/api/cron",
      "schedule": "*/15 * * * *"
    }
  ]
}
```

This schedules the endpoint every 15 minutes.

---

## 16.1 Commit the Cron Configuration

Run:

```bash
git add vercel.json
```

Then:

```bash
git commit -m "Configure reminder cron"
```

Push:

```bash
git push
```

Vercel will automatically deploy the new commit.

---

## 16.2 Cron Security

The application should protect the cron endpoint from arbitrary public requests.

The project provides:

```env
CRON_SECRET=...
```

If the application's existing `/api/cron` implementation expects a bearer secret, configure it according to that implementation.

Do not expose the cron secret to frontend JavaScript.

Do not place the cron secret in publicly accessible files.

---

## 16.3 Cron Frequency

The example configuration runs every 15 minutes:

```text
*/15 * * * *
```

This means the application checks for due reminders approximately every 15 minutes.

A reminder scheduled for a particular minute may therefore be processed during the next cron execution rather than exactly at that minute.

If exact-to-the-minute notification delivery becomes a requirement, the scheduling architecture should be reconsidered.

---

# 17. Administrator & Security Configuration

## 17.1 Owner

Set:

```env
OWNER_TELEGRAM_ID=YOUR_TELEGRAM_ID
```

For example:

```env
OWNER_TELEGRAM_ID=5138117035
```

Use the actual Telegram ID of the application owner.

---

## 17.2 Owner Behavior

When the configured owner connects:

* The account is automatically assigned the `OWNER` role.
* `/start` can open the appropriate owner experience.
* `/admin` opens the administrator panel.
* The owner can promote users to administrators if supported by the application.
* The owner can enable or disable accounts if supported.
* The owner cannot be demoted by another administrator if this is enforced by the application authorization logic.

---

## 17.3 Additional Administrators

If supported by the project, configure:

```env
ADMIN_TELEGRAM_IDS=123456789,987654321
```

Use comma-separated Telegram IDs.

Example:

```env
ADMIN_TELEGRAM_IDS=123456789,987654321
```

Do not add spaces unless the application's environment parser explicitly supports them.

---

## 17.4 Normal Users

Normal users should:

* Receive the normal application experience.
* Not receive administrator privileges.
* Be blocked from protected administrator API endpoints.
* Receive `HTTP 403 Forbidden` when attempting unauthorized administrator operations.

The application should enforce authorization on the server.

Do not rely on hiding administrator UI elements in the frontend as a security mechanism.

---

## 17.5 No Client-Side Mode Switching

The user's role should be determined server-side from the authenticated account.

Do not trust a frontend value such as:

```text
isAdmin=true
```

for authorization.

All administrator operations must be checked on the server.

---

# 18. Production Verification

After deployment, verify the following.

## 18.1 Application

Open:

```text
https://YOUR-APP.vercel.app/app
```

The application should load successfully.

---

## 18.2 Database

Verify:

```bash
npm run db:migrate
```

completes successfully against the production Neon database.

---

## 18.3 Telegram Bot

Open your bot in Telegram.

Send:

```text
/start
```

Verify that the bot responds.

---

## 18.4 Webhook

Verify:

```text
/api/webhook
```

is receiving Telegram updates.

Use:

```bash
curl "https://api.telegram.org/botYOUR_TELEGRAM_BOT_TOKEN/getWebhookInfo"
```

---

## 18.5 Mini App

Open the Telegram Mini App.

Verify:

* Telegram authentication works.
* The user profile is loaded.
* Birthday/person data can be viewed.
* New birthdays can be created.
* Reminders can be created.
* Existing reminders can be edited.
* Data persists after closing and reopening the application.

---

## 18.6 Administrator

Using the owner Telegram account:

```text
/admin
```

Verify that the administrator panel is available.

Test:

* User management
* Account enable/disable
* Administrator promotion
* Protected administrator routes

where applicable.

---

# 19. Production Testing

Perform a complete end-to-end test.

## Test 1: Create a Person

Create a test person:

```text
Name: Test User
Birthday: Tomorrow
```

Confirm that the data appears in the application.

---

## Test 2: Create a Reminder

Create a reminder with:

```text
1 month
1 week
1 day
On the day
```

Select the required time.

Confirm that the reminder appears immediately in the Reminders list.

---

## Test 3: Verify Persistence

Close the Telegram Mini App.

Open it again.

Verify that the created data remains available.

---

## Test 4: Test Cron

Create a test reminder that will become due during the next cron execution.

Verify that:

```text
/api/cron
```

processes the reminder correctly.

---

## Test 5: Test Authorization

Using a normal user account, attempt to access:

```text
/api/admin/*
```

The server should return:

```text
HTTP 403 Forbidden
```

---

# 20. Backup & Data Re-Import

The application includes a data import utility.

Run:

```bash
npm run data:import
```

For a specific backup:

```bash
npx tsx scripts/import-data.ts path/to/backup.json
```

---

## Backup Recommendations

Production data should be backed up regularly.

At minimum, maintain a backup strategy for:

* users
* birthdays
* people
* reminders
* settings
* administrator information
* any other persistent application data

Do not rely on the application itself as the only copy of production data.

Store backups separately from the production application.

---

# 21. Updating the Application

When a new version is ready:

## Step 1: Run Tests

```bash
npm run test:all
```

---

## Step 2: Commit Changes

```bash
git add .
git commit -m "Update application"
```

---

## Step 3: Push

```bash
git push
```

Vercel automatically creates a new deployment from the GitHub commit.

---

## Step 4: Run Database Migrations if Required

If the release contains database schema changes:

```bash
npm run db:migrate
```

Run this against the production Neon database before relying on the new application version.

---

## Step 5: Verify Production

After deployment:

* Open the Mini App.
* Test Telegram `/start`.
* Test `/admin` using the owner account.
* Test creating a birthday.
* Test creating a reminder.
* Check Vercel logs.
* Check database connectivity.
* Check scheduled reminder execution.

---

# 22. Troubleshooting

## Problem: Application cannot connect to PostgreSQL

Check:

```text
DATABASE_URL
```

Verify that:

* The connection string is correct.
* The Neon project is active.
* The Vercel environment variable is configured.
* The latest deployment contains the environment variable.
* The database schema has been migrated.

After changing Vercel environment variables, redeploy the application.

---

## Problem: Telegram bot does not respond

Check the webhook:

```bash
curl "https://api.telegram.org/botYOUR_TELEGRAM_BOT_TOKEN/getWebhookInfo"
```

Verify:

```text
https://YOUR-APP.vercel.app/api/webhook
```

is configured.

Then check Vercel logs for webhook errors.

---

## Problem: Mini App does not open

Verify the Mini App URL:

```text
https://YOUR-APP.vercel.app/app
```

It must be publicly accessible over HTTPS.

Check the URL configured in BotFather.

---

## Problem: Administrator panel does not appear

Verify:

```env
OWNER_TELEGRAM_ID=YOUR_TELEGRAM_ID
```

Make sure the Telegram ID is the numeric Telegram user ID, not the username.

Also verify that the production environment variable is configured in Vercel.

---

## Problem: Reminders are not being processed

Check:

```text
/api/cron
```

Verify that:

* `vercel.json` contains the cron configuration.
* The deployment containing `vercel.json` succeeded.
* The cron schedule is valid.
* The cron endpoint can access PostgreSQL.
* Due reminders are correctly identified by the database query.
* Timezone handling is correct.
* Vercel logs do not contain runtime errors.

---

## Problem: Changes to `.env` do not work

Local `.env` changes do not automatically update Vercel.

Production variables must be configured in:

```text
Vercel
→ Project
→ Settings
→ Environment Variables
```

After changing them, redeploy the application.

---

# 23. Environment Variables Reference

| Variable             | Required    | Description                                       | Example                         |
| -------------------- | ----------- | ------------------------------------------------- | ------------------------------- |
| `NODE_ENV`           | Yes         | Application environment                           | `production`                    |
| `TELEGRAM_BOT_TOKEN` | Yes         | Telegram Bot API token                            | `123456789:AA...`               |
| `DATABASE_URL`       | Yes         | PostgreSQL connection string                      | `postgresql://...`              |
| `SESSION_SECRET`     | Yes         | Authentication/session signing secret             | Random 32+ byte secret          |
| `OWNER_TELEGRAM_ID`  | Yes         | Initial application owner Telegram ID             | `5138117035`                    |
| `ADMIN_TELEGRAM_IDS` | No          | Additional administrator Telegram IDs             | `123456789,987654321`           |
| `WEBHOOK_URL`        | Production  | Public application URL                            | `https://my-app.vercel.app`     |
| `WEB_APP_URL`        | Production  | Telegram Mini App URL                             | `https://my-app.vercel.app/app` |
| `WEBHOOK_SECRET`     | Recommended | Secret used to validate Telegram webhook requests | Random secret                   |
| `CRON_SECRET`        | Recommended | Secret for protecting scheduled cron execution    | Random secret                   |
| `DEFAULT_TIMEZONE`   | No          | Default IANA timezone                             | `Europe/Berlin`                 |
| `PORT`               | No          | Local development server port                     | `3005`                          |

---

# 24. Production Deployment Checklist

## Accounts

* [ ] GitHub account created
* [ ] Vercel account created
* [ ] Neon account created
* [ ] Telegram account available
* [ ] Telegram bot created through BotFather

---

## Local Project

* [ ] Repository cloned
* [ ] `npm install` completed
* [ ] `.env` created
* [ ] `.env` excluded from Git
* [ ] Telegram bot token configured
* [ ] Neon database URL configured
* [ ] Session secret configured
* [ ] Owner Telegram ID configured
* [ ] Webhook secret configured
* [ ] Cron secret configured
* [ ] Timezone configured

---

## Database

* [ ] Neon PostgreSQL project created
* [ ] `DATABASE_URL` copied
* [ ] Database migrations applied
* [ ] Tables created
* [ ] Existing data imported if required
* [ ] Backup strategy established

---

## Testing

* [ ] `npm run test:all` passes
* [ ] Local application starts
* [ ] Telegram `/start` works locally where applicable
* [ ] Mini App loads
* [ ] Birthday creation works
* [ ] Reminder creation works
* [ ] Admin functionality works

---

## GitHub

* [ ] Repository created
* [ ] `.env` is not committed
* [ ] Source code pushed
* [ ] `vercel.json` committed

---

## Vercel

* [ ] GitHub repository imported
* [ ] Production deployment completed
* [ ] Environment variables configured
* [ ] Production deployment redeployed after environment configuration
* [ ] Application URL confirmed

---

## Telegram

* [ ] Bot commands configured
* [ ] Webhook configured
* [ ] Webhook verified with `getWebhookInfo`
* [ ] Mini App URL configured
* [ ] Mini App opens successfully

---

## Cron

* [ ] `vercel.json` configured
* [ ] `/api/cron` deployed
* [ ] Cron execution configured
* [ ] Database queries are efficient
* [ ] Reminder processing tested

---

## Security

* [ ] Telegram bot token is private
* [ ] Database URL is private
* [ ] Session secret is private
* [ ] Webhook secret is private
* [ ] Cron secret is private
* [ ] Administrator API routes require server-side authorization
* [ ] Normal users receive `403 Forbidden` for unauthorized admin operations
* [ ] No secrets are exposed in frontend code

---

# 25. Recommended Production Architecture

The recommended production setup is:

```text
                     ┌────────────────────┐
                     │      Telegram      │
                     │                    │
                     │ Bot API            │
                     │ Mini App           │
                     └─────────┬──────────┘
                               │
                               │ HTTPS
                               ▼
                     ┌────────────────────┐
                     │       Vercel       │
                     │                    │
                     │ Web Application    │
                     │ API Routes         │
                     │ Telegram Webhook   │
                     │ Scheduled Cron     │
                     └─────────┬──────────┘
                               │
                               │ DATABASE_URL
                               ▼
                     ┌────────────────────┐
                     │       Neon         │
                     │                    │
                     │ PostgreSQL         │
                     │                    │
                     │ Users              │
                     │ People             │
                     │ Birthdays          │
                     │ Reminders          │
                     │ Settings           │
                     └────────────────────┘
```

## Recommended Services

| Service          | Purpose                       |
| ---------------- | ----------------------------- |
| GitHub           | Source code                   |
| Vercel           | Web/API hosting               |
| Neon             | PostgreSQL                    |
| Telegram Bot API | Telegram integration          |
| Vercel Cron      | Scheduled reminder processing |
| Drizzle ORM      | Database access               |

---

# Final Deployment Flow

The complete deployment process is:

```text
1. Install Node.js + Git
          ↓
2. Clone project
          ↓
3. npm install
          ↓
4. Create Telegram Bot
          ↓
5. Create Neon PostgreSQL
          ↓
6. Configure local .env
          ↓
7. Run database migrations
          ↓
8. Import existing data if required
          ↓
9. Run tests
          ↓
10. Push project to GitHub
          ↓
11. Import GitHub project into Vercel
          ↓
12. Configure Vercel environment variables
          ↓
13. Deploy
          ↓
14. Run production database migrations
          ↓
15. Configure Telegram webhook
          ↓
16. Configure Telegram Mini App
          ↓
17. Configure Vercel Cron
          ↓
18. Test /start
          ↓
19. Test Mini App
          ↓
20. Test reminders
          ↓
21. Test administrator access
          ↓
22. Production deployment complete
```

## Minimal Production Stack

For this application, there is no need to start with a VPS or complicated infrastructure.

Use:

```text
GitHub
   +
Vercel
   +
Neon PostgreSQL
   +
Telegram
```

This keeps the deployment simple, serverless, and suitable for a small-to-medium Telegram application while allowing the infrastructure to scale later if usage grows.
