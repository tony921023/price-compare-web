// apps/web/src/services/auth.ts
export type User = { id: number; email: string; createdAt: string };

async function json<T>(resp: Response): Promise<T> {
  const data: Record<string, unknown> = await resp.json().catch(() => ({}));
  if (!resp.ok) throw new Error(typeof data.message === "string" ? data.message : `HTTP ${resp.status}`);
  return data as T;
}

const REQ_TIMEOUT = 8000;

export async function me(): Promise<User | null> {
  const resp = await fetch("/api/auth/me", {
    credentials: "include",
    signal: AbortSignal.timeout(REQ_TIMEOUT),
  });
  const data = await json<{ user: User | null }>(resp);
  return data.user;
}

export async function register(email: string, password: string): Promise<User> {
  const resp = await fetch("/api/auth/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ email, password }),
    signal: AbortSignal.timeout(REQ_TIMEOUT),
  });
  const data = await json<{ user: User }>(resp);
  return data.user;
}

export async function login(email: string, password: string): Promise<User> {
  const resp = await fetch("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ email, password }),
    signal: AbortSignal.timeout(REQ_TIMEOUT),
  });
  const data = await json<{ user: User }>(resp);
  return data.user;
}

export async function logout(): Promise<void> {
  const resp = await fetch("/api/auth/logout", {
    method: "POST",
    credentials: "include",
    signal: AbortSignal.timeout(REQ_TIMEOUT),
  });
  if (!resp.ok) throw new Error(`登出失敗: HTTP ${resp.status}`);
}