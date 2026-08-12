interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  first<T = Record<string, unknown>>(): Promise<T | null>;
  all<T = Record<string, unknown>>(): Promise<{ results: T[] }>;
  run(): Promise<unknown>;
}

interface D1Database {
  prepare(query: string): D1PreparedStatement;
  batch<T = unknown>(statements: D1PreparedStatement[]): Promise<T[]>;
}

interface Env {
  DB: D1Database;
  TELEGRAM_BOT_USERNAME?: string;
  TELEGRAM_CLIENT_ID?: string;
  TELEGRAM_CLIENT_SECRET?: string;
  SESSION_SECRET?: string;
  DRIVE_BRIDGE_URL?: string;
  DRIVE_BRIDGE_SECRET?: string;
}
