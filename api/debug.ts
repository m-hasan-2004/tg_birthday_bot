import type { VercelRequest, VercelResponse } from '@vercel/node';

export default function handler(_req: VercelRequest, res: VercelResponse) {
  res.status(200).json({
    ok: true,
    timestamp: new Date().toISOString(),
    node: process.version,
    env_keys: Object.keys(process.env).filter(k => !k.startsWith('_')).sort(),
    vercel: process.env.VERCEL || 'not-set',
  });
}
