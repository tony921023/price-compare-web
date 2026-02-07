// apps/web/src/services/auth.ts
export type User = { id: number; email: string; createdAt: string };

async function json<T>(resp: Response): Promise<T> {
  const data: Record<string, unknown> = await resp.json().catch(() => ({}));
  if (!resp.ok) throw new Error(typeof data.message === "string" ? data.message : `HTTP ${resp.status}`);
  return data as T;
}

/**
 * ✅ 重點：credentials: "include"
 * 讓跨 port（5173 -> 8787）時 cookie-session 能被瀏覽器存/帶上
 * （如果你是用 Vite proxy 讓 /api 走同源，也不會有副作用）
 */
export async function me(): Promise<User | null> {
  const resp = await fetch("/api/auth/me", { credentials: "include" });
  const data = await json<{ user: User | null }>(resp);
  return data.user;
}

export async function register(email: string, password: string): Promise<User> {
  const resp = await fetch("/api/auth/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ email, password }),
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
  });
  const data = await json<{ user: User }>(resp);
  return data.user;
}

export async function logout(): Promise<void> {
  await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
}