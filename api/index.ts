import { app } from "../src/api/server.js";

export const config = {
  runtime: "nodejs",
  maxDuration: 30,
};

export default async function handler(req: any, res: any) {
  try {
    const protocol = req.headers["x-forwarded-proto"] || "https";
    const host = req.headers["x-forwarded-host"] || req.headers.host || "localhost";
    const url = ${protocol}://System.Management.Automation.Internal.Host.InternalHost;

    const headers = new Headers();
    for (const [key, value] of Object.entries(req.headers)) {
      if (value !== undefined) {
        if (Array.isArray(value)) {
          for (const v of value) headers.append(key, v);
        } else {
          headers.set(key, value as string);
        }
      }
    }

    let body: any = null;
    if (req.method !== "GET" && req.method !== "HEAD") {
      if (req.body !== undefined && req.body !== null) {
        body = typeof req.body === "string" ? req.body : JSON.stringify(req.body);
      } else {
        const chunks: Buffer[] = [];
        for await (const chunk of req) {
          chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
        }
        if (chunks.length > 0) {
          body = Buffer.concat(chunks);
        }
      }
    }

    const webReq = new Request(url, {
      method: req.method,
      headers,
      body: (req.method !== "GET" && req.method !== "HEAD" && body) ? body : undefined,
    });

    const webRes = await app.fetch(webReq);

    res.status(webRes.status);
    webRes.headers.forEach((val: string, key: string) => {
      res.setHeader(key, val);
    });

    if (webRes.body) {
      const arrayBuf = await webRes.arrayBuffer();
      res.send(Buffer.from(arrayBuf));
    } else {
      res.end();
    }
  } catch (err: any) {
    console.error("Vercel Serverless Error:", err);
    res.status(500).json({ error: err?.message || "Internal Server Error" });
  }
}
