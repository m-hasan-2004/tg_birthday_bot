export const config = { runtime: 'nodejs', maxDuration: 25 };

export default async function handler(req, res) {
  const results = [];
  const start = Date.now();

  try {
    results.push('importing hono...');
    const h = await import('hono');
    results.push('hono OK: ' + Object.keys(h).join(','));

    results.push('importing grammy...');
    const g = await import('grammy');
    results.push('grammy OK: ' + typeof g.Bot);

    results.push('importing @neondatabase/serverless...');
    const n = await import('@neondatabase/serverless');
    results.push('neon OK: ' + typeof n.neon);

    results.push('importing dotenv...');
    const d = await import('dotenv');
    results.push('dotenv OK');

    results.push('importing zod...');
    const z = await import('zod');
    results.push('zod OK');

    results.push('ALL DONE in ' + (Date.now() - start) + 'ms');
    res.status(200).json({ ok: true, results });
  } catch (err) {
    results.push('ERROR: ' + (err && err.message));
    res.status(500).json({ ok: false, results, error: err && err.message, stack: err && err.stack });
  }
}
