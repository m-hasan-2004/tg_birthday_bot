import { getRequestListener } from "@hono/node-server";
import { app } from "../src/api/server.js";

export const config = {
  runtime: "nodejs",
  maxDuration: 30,
};

export default getRequestListener(app.fetch);
