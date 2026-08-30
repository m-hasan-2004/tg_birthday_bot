import type { VercelRequest, VercelResponse } from "@vercel/node";

export const config = {
  runtime: "nodejs",
  maxDuration: 30,
};

let cachedHandler: ((req: VercelRequest, res: VercelResponse) => any) | null = null;
let initError: Error | null = null;

async function getHandler() {
  if (initError) throw initError;
  if (cachedHandler) return cachedHandler;

  try {
    console.log("[api/index] Starting dynamic import of hono/vercel...");
    const { handle } = await import("hono/vercel");
    console.log("[api/index] hono/vercel imported OK");

    console.log("[api/index] Starting dynamic import of ../src/api/server.js...");
    const { app } = await import("../src/api/server.js");
    console.log("[api/index] server.js imported OK, app:", typeof app);

    cachedHandler = handle(app);
    return cachedHandler;
  } catch (err: any) {
    console.error("[api/index] INIT ERROR:", err);
    initError = err;
    throw err;
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const h = await getHandler();
    return h(req, res);
  } catch (err: any) {
    console.error("[api/index] Handler error:", err);
    res.status(500).json({
      error: "Server initialization failed",
      message: err?.message || String(err),
      stack: err?.stack,
      name: err?.name,
    });
  }
}
