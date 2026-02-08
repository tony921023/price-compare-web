// apps/web/src/services/alerts.ts

export type Alert = {
  id: number;
  platform: string;
  target_price: number;
  is_active: boolean;
  last_triggered: string | null;
  created_at: string;
};

export type TriggeredAlert = {
  id: number;
  platform: string;
  target_price: number;
  last_triggered: string;
  query: string;
};

async function json<T>(resp: Response): Promise<T> {
  const data: Record<string, unknown> = await resp.json().catch(() => ({}));
  if (!resp.ok) throw new Error(typeof data.message === "string" ? data.message : `HTTP ${resp.status}`);
  return data as T;
}

const REQ_TIMEOUT = 8000;

export async function getAlerts(watchlistId: number): Promise<Alert[]> {
  const resp = await fetch(`/api/watchlist/${watchlistId}/alerts`, {
    credentials: "include",
    signal: AbortSignal.timeout(REQ_TIMEOUT),
  });
  const data = await json<{ alerts: Alert[] }>(resp);
  return data.alerts;
}

export async function createAlert(watchlistId: number, platform: string, targetPrice: number): Promise<Alert> {
  const resp = await fetch(`/api/watchlist/${watchlistId}/alerts`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ platform, targetPrice }),
    signal: AbortSignal.timeout(REQ_TIMEOUT),
  });
  const data = await json<{ alert: Alert }>(resp);
  return data.alert;
}

export async function deleteAlert(watchlistId: number, alertId: number): Promise<void> {
  const resp = await fetch(`/api/watchlist/${watchlistId}/alerts/${alertId}`, {
    method: "DELETE",
    credentials: "include",
    signal: AbortSignal.timeout(REQ_TIMEOUT),
  });
  await json<{ ok: boolean }>(resp);
}

export async function getTriggeredAlerts(): Promise<TriggeredAlert[]> {
  const resp = await fetch("/api/alerts/triggered", {
    credentials: "include",
    signal: AbortSignal.timeout(REQ_TIMEOUT),
  });
  const data = await json<{ alerts: TriggeredAlert[] }>(resp);
  return data.alerts;
}
