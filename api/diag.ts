import { app } from '../src/api/server.js';

export const config = { runtime: 'nodejs', maxDuration: 25 };

export default async function handler(req, res) {
  try {
    const url = 'https://tg-birthday-bot.vercel.app' + req.url;
    const bodyStr = JSON.stringify({ telegramId: '5138117035', name: 'Admin Owner' });
    
    const webReq = new Request('https://tg-birthday-bot.vercel.app/api/auth/dev-login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: bodyStr,
    });

    const webRes = await app.fetch(webReq);
    const json = await webRes.json();

    res.status(200).json({ ok: true, status: webRes.status, data: json });
  } catch (err) {
    res.status(500).json({ ok: false, error: err && err.message, stack: err && err.stack });
  }
}
