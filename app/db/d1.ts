export interface D1PreparedStatementLike {
  bind(...values: unknown[]): D1PreparedStatementLike;
  run<T = unknown>(): Promise<T>;
  all<T = unknown>(): Promise<{ results?: T[]; success?: boolean }>;
  first<T = unknown>(): Promise<T | null>;
}

export interface D1DatabaseLike {
  prepare(query: string): D1PreparedStatementLike;
  batch?(statements: D1PreparedStatementLike[]): Promise<unknown[]>;
}

export function getWorkerEnv(context?: unknown): Record<string, any> {
  const candidate = (context as any)?.cloudflare?.env;
  return candidate && typeof candidate === "object" ? candidate : {};
}

/**
 * The production binding intentionally has a hyphen, so always use bracket
 * notation. DB is only a local-development fallback and is not configured in
 * the production Wrangler file.
 */
export function getD1Database(context?: unknown): D1DatabaseLike | null {
  const env = getWorkerEnv(context);
  const database = env["teenliwa-v2"] || env.DB;
  return database && typeof database.prepare === "function" ? database as D1DatabaseLike : null;
}

export function toFils(amountAed: number): number {
  if (!Number.isFinite(amountAed) || amountAed < 0) {
    throw new Error("Amount must be a finite non-negative AED value");
  }
  const fils = Math.round(amountAed * 100);
  if (!Number.isSafeInteger(fils)) throw new Error("Amount is outside the supported range");
  return fils;
}

export function fromFils(amountFils: unknown): number {
  const value = Number(amountFils);
  return Number.isSafeInteger(value) ? value / 100 : 0;
}

export function isD1Success(result: any): boolean {
  if (result?.success === false) return false;
  if (result?.meta?.changes !== undefined) return Number(result.meta.changes) > 0;
  if (result?.meta?.rows_written !== undefined) return Number(result.meta.rows_written) > 0;
  return true;
}
