import { db } from '../src/db/index.js';
import { users } from '../src/db/schema.js';
import { count } from 'drizzle-orm';

export const config = { runtime: 'nodejs', maxDuration: 25 };

export default async function handler(req, res) {
  const start = Date.now();
  try {
    const totalUsers = await db.select({ count: count() }).from(users);
    res.status(200).json({
      ok: true,
      time_ms: Date.now() - start,
      totalUsers: totalUsers[0]?.count,
      dbUrlPrefix: (process.env.DATABASE_URL || '').substring(0, 35) + '...',
    });
  } catch (err) {
    res.status(500).json({
      ok: false,
      time_ms: Date.now() - start,
      error: err && err.message,
      stack: err && err.stack,
    });
  }
}
