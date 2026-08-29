type LogLevel = "debug" | "info" | "warn" | "error";

interface LogPayload {
  level: LogLevel;
  message: string;
  timestamp: string;
  data?: Record<string, unknown>;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
}

function sanitize(data: unknown): unknown {
  if (!data || typeof data !== "object") return data;
  
  if (Array.isArray(data)) {
    return data.map(sanitize);
  }

  const clean: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
    const lowerKey = key.toLowerCase();
    if (
      lowerKey.includes("token") ||
      lowerKey.includes("password") ||
      lowerKey.includes("secret") ||
      lowerKey.includes("key") ||
      lowerKey.includes("auth")
    ) {
      clean[key] = "[REDACTED]";
    } else if (typeof value === "object" && value !== null) {
      clean[key] = sanitize(value);
    } else {
      clean[key] = value;
    }
  }
  return clean;
}

function formatLog(level: LogLevel, message: string, data?: Record<string, unknown>, err?: unknown): string {
  const payload: LogPayload = {
    level,
    message,
    timestamp: new Date().toISOString(),
  };

  if (data) {
    payload.data = sanitize(data) as Record<string, unknown>;
  }

  if (err instanceof Error) {
    payload.error = {
      name: err.name,
      message: err.message,
      stack: process.env.NODE_ENV === "development" ? err.stack : undefined,
    };
  }

  return JSON.stringify(payload);
}

export const logger = {
  debug(message: string, data?: Record<string, unknown>) {
    if (process.env.NODE_ENV === "development" || process.env.LOG_LEVEL === "debug") {
      console.debug(formatLog("debug", message, data));
    }
  },
  info(message: string, data?: Record<string, unknown>) {
    console.log(formatLog("info", message, data));
  },
  warn(message: string, data?: Record<string, unknown>, err?: unknown) {
    console.warn(formatLog("warn", message, data, err));
  },
  error(message: string, err?: unknown, data?: Record<string, unknown>) {
    console.error(formatLog("error", message, data, err));
  },
};
