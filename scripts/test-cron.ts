import { neon } from '@neondatabase/serverless';

const DB_URL = 'postgresql://neondb_owner:npg_GY67EDWONsjg@ep-wispy-wildflower-b1gsxcmj.c-5.eu-central-1.aws.neon.tech/neondb?sslmode=require';

async function main() {
  const sql = neon(DB_URL);
  const users = await sql`SELECT id, telegram_id, name, timezone FROM users`;
  console.log('USERS IN DB:', JSON.stringify(users, null, 2));

  const reminders = await sql`SELECT id, user_id, title, scheduled_at, status FROM reminders ORDER BY created_at DESC LIMIT 10`;
  console.log('REMINDERS IN DB:', JSON.stringify(reminders, null, 2));

  console.log('UTC NOW:', new Date().toISOString());
}

main().catch(console.error);
