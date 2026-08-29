import net from "net";

/**
 * Checks if a port is available.
 */
export function isPortAvailable(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once("error", (err: any) => {
      if (err.code === "EADDRINUSE") {
        resolve(false);
      } else {
        resolve(false);
      }
    });
    server.once("listening", () => {
      server.close(() => {
        resolve(true);
      });
    });
    server.listen(port);
  });
}

/**
 * Finds the first available port starting from startingPort.
 */
export async function findAvailablePort(startingPort: number, maxAttempts: number = 20): Promise<number> {
  let port = startingPort;
  for (let i = 0; i < maxAttempts; i++) {
    const available = await isPortAvailable(port);
    if (available) {
      return port;
    }
    port++;
  }
  return startingPort;
}
