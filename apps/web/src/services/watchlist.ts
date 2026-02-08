// apps/web/src/services/watchlist.ts

export type WatchlistItem = {
  id: number;
  query: string;
  min_price: number | null;
  max_price: number | null;
  created_at: string;
};

async function json<T>(resp: Response): Promise<T> {
  const data: Record<string, unknown> = await resp.json().catch(() => ({}));
  if (!resp.ok) throw new Error(typeof data.message === "string" ? data.message : `HTTP ${resp.status}`);
  return data as T;
}

const REQ_TIMEOUT = 8000;

export async function getWatchlist(): Promise<WatchlistItem[]> {
  const resp = await fetch("/api/watchlist", {
    credentials: "include",
    signal: AbortSignal.timeout(REQ_TIMEOUT),
  });
  const data = await json<{ items: WatchlistItem[] }>(resp);
  return data.items;
}

export async function addToWatchlist(
  query: string,
  minPrice?: number | null,
  maxPrice?: number | null,
): Promise<WatchlistItem> {
  const resp = await fetch("/api/watchlist", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ query, minPrice, maxPrice }),
    signal: AbortSignal.timeout(REQ_TIMEOUT),
  });
  const data = await json<{ item: WatchlistItem }>(resp);
  return data.item;
}

export async function removeFromWatchlist(id: number): Promise<void> {
  const resp = await fetch(`/api/watchlist/${id}`, {
    method: "DELETE",
    credentials: "include",
    signal: AbortSignal.timeout(REQ_TIMEOUT),
  });
  await json<{ ok: boolean }>(resp);
}

export async function collectSnapshot(id: number): Promise<{ count: number }> {
  const resp = await fetch(`/api/watchlist/${id}/snapshot`, {
    method: "POST",
    credentials: "include",
    signal: AbortSignal.timeout(REQ_TIMEOUT),
  });
  return json<{ count: number }>(resp);
}

export type HistoryPoint = { platform: string; price: number; collected_at: string };

export async function getHistory(id: number, days = 30): Promise<{ query: string; history: HistoryPoint[] }> {
  const resp = await fetch(`/api/watchlist/${id}/history?days=${days}`, {
    credentials: "include",
    signal: AbortSignal.timeout(REQ_TIMEOUT),
  });
  return json<{ query: string; history: HistoryPoint[] }>(resp);
}

export async function collectAllSnapshots(): Promise<{ items: number; total: number }> {
  const resp = await fetch("/api/watchlist/snapshot-all", {
    method: "POST",
    credentials: "include",
    signal: AbortSignal.timeout(REQ_TIMEOUT),
  });
  return json<{ items: number; total: number }>(resp);
}
