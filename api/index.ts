import { app } from "../src/api/server.js";

export const config = {
  runtime: "nodejs",
  maxDuration: 30,
};

export default async function handler(req: any, res: any) {
  try {
    const path = req.url || "/";
    const fullUrl = 'https://tg-birthday-bot.vercel.app' + path;

    const headers = new Headers();
    for (const [key, value] of Object.entries(req.headers)) {
      if (value !== undefined) {
        const lower = key.toLowerCase();
        if (lower !== "host" && lower !== "content-length") {
          if (Array.isArray(value)) {
            for (const v of value) headers.append(key, v);
          } else {
            headers.set(key, value as string);
          }
        }
      }
    }

    let body: any = undefined;
    if (req.method !== "GET" && req.method !== "HEAD") {
      if (req.body !== undefined && req.body !== null) {
        body = typeof req.body === "string" ? req.body : JSON.stringify(req.body);
      } else {
        const chunks: Buffer[] = [];
        for await (const chunk of req) {
          chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
        }
        if (chunks.length > 0) {
          body = Buffer.concat(chunks).toString("utf-8");
        }
      }
    }

    if (body && !headers.has("content-type")) {
      headers.set("content-type", "application/json");
    }

    const webReq = new Request(fullUrl, {
      method: req.method,
      headers,
      body: (req.method !== "GET" && req.method !== "HEAD" && body && body.length > 0) ? body : undefined,
    });

    const webRes = await app.fetch(webReq);

    webRes.headers.forEach((val: string, key: string) => {
      const lower = key.toLowerCase();
      if (lower !== "content-length" && lower !== "transfer-encoding" && lower !== "content-encoding") {
        try {
          res.setHeader(key, val);
        } catch {}
      }
    });

    const responseText = await webRes.text();
    res.status(webRes.status).send(responseText);
  } catch (err: any) {
    console.error("Vercel Serverless Error:", err);
    res.status(500).json({ error: err?.message || "Internal Server Error" });
  }
}
